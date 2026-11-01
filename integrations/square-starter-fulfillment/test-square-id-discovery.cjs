'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = __dirname;
const source = fs.readFileSync(path.join(root, 'Code.gs'), 'utf8') + '\n' +
  fs.readFileSync(path.join(root, 'StarterCompanions.gs'), 'utf8');
const goodVariation = id => ({
  type: 'ITEM_VARIATION', id, present_at_all_locations: true,
  item_variation_data: {
    pricing_type: 'FIXED_PRICING', price_money: {currency: 'JPY', amount: 9800}
  }
});
const goodItem = variations => ({
  type: 'ITEM', id: 'ITEM1', present_at_all_locations: true,
  item_data: {name: 'GuestOps Starter Kit 9,800円', variations}
});

function scenario(options = {}) {
  const values = new Map(Object.entries({
    SQUARE_ACCESS_TOKEN: 'fake-unit-test-token', SEND_ENABLED: 'false',
    ...options.properties
  }));
  const calls = [];
  let writes = 0;
  let gmailSends = 0;
  const props = {
    getProperty: key => values.get(key) || null,
    setProperties: entries => {
      writes++;
      Object.entries(entries).forEach(([key, value]) => values.set(key, value));
    }
  };
  const context = {
    console: {log: () => {}, error: () => {}},
    Session: {getEffectiveUser: () => ({
      getEmail: () => options.sender || 'minpaku.ai.kit@gmail.com'
    })},
    PropertiesService: {getScriptProperties: () => props},
    GmailApp: {sendEmail: () => {gmailSends++; throw Error('Email forbidden in setup');}},
    DriveApp: {getFileById: () => {throw Error('Drive mutation forbidden in setup');}}
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const responses = options.responses || {
    locations: {locations: [{id: 'LOC1', status: 'ACTIVE', currency: 'JPY'}]},
    'catalog/list?types=ITEM': {objects: [goodItem([goodVariation('VAR1')])]}
  };
  context.goSquareGet_ = endpoint => {
    calls.push(endpoint);
    if (!Object.prototype.hasOwnProperty.call(responses, endpoint)) {
      throw Error('Unexpected Square endpoint ' + endpoint);
    }
    return responses[endpoint];
  };
  const run = () => context.configureStarterSquareIdsReadOnly();
  return {run, calls, values, get writes() {return writes;},
    get gmailSends() {return gmailSends;}};
}

{
  const t = scenario();
  const result = t.run();
  assert.equal(result.squareLocationConfigured, true);
  assert.equal(result.starterCatalogVariationConfigured, true);
  assert.equal(result.sendEnabled, false);
  assert.equal(result.buyerMailSent, false);
  assert.equal(t.values.get('SQUARE_LOCATION_ID'), 'LOC1');
  assert.equal(t.values.get('STARTER_CATALOG_OBJECT_ID'), 'VAR1');
  assert.equal(t.writes, 1);
  assert.deepEqual(t.calls, ['locations', 'catalog/list?types=ITEM']);
  assert.equal(t.gmailSends, 0);
}
{
  const t = scenario({sender: 'other@example.com'});
  assert.throws(t.run, /authorized sender/);
  assert.equal(t.writes, 0);
  assert.equal(t.calls.length, 0);
}
{
  const t = scenario({properties: {SEND_ENABLED: 'true'}});
  assert.throws(t.run, /SEND_ENABLED=false/);
  assert.equal(t.writes, 0);
  assert.equal(t.calls.length, 0);
}
{
  const t = scenario({properties: {SQUARE_ACCESS_TOKEN: ''}});
  assert.throws(t.run, /SQUARE_ACCESS_TOKEN/);
  assert.equal(t.writes, 0);
}
{
  const t = scenario({responses: {
    locations: {locations: [
      {id: 'LOC1', status: 'ACTIVE', currency: 'JPY'},
      {id: 'LOC2', status: 'ACTIVE', currency: 'JPY'}
    ]}
  }});
  assert.throws(t.run, /exactly one active JPY location/);
  assert.equal(t.writes, 0);
}
{
  const t = scenario({responses: {
    locations: {locations: [{id: 'LOC1', status: 'ACTIVE', currency: 'JPY'}]},
    'catalog/list?types=ITEM': {objects: [goodItem([
      goodVariation('VAR1'), goodVariation('VAR2')
    ])]}
  }});
  assert.throws(t.run, /absent or ambiguous/);
  assert.equal(t.writes, 0);
}
{
  const t = scenario({properties: {SQUARE_LOCATION_ID: 'OTHER'}});
  assert.throws(t.run, /conflict/);
  assert.equal(t.values.get('SQUARE_LOCATION_ID'), 'OTHER');
  assert.equal(t.writes, 0);
}
{
  const t = scenario({responses: {
    locations: {locations: [{id: 'LOC1', status: 'ACTIVE', currency: 'JPY'}]},
    'catalog/list?types=ITEM': {errors: [{code: 'UNAUTHORIZED'}]}
  }});
  assert.throws(t.run, /Invalid Square catalog response/);
  assert.equal(t.writes, 0);
}
{
  const t = scenario({responses: {
    locations: {locations: [{id: 'LOC1', status: 'ACTIVE', currency: 'JPY'}]},
    'catalog/list?types=ITEM': {objects: [goodItem([goodVariation('VAR1')])],
      cursor: 'NEXT'},
    'catalog/list?types=ITEM&cursor=NEXT': {objects: [goodItem([goodVariation('VAR2')])]}
  }});
  assert.throws(t.run, /absent or ambiguous/);
  assert.equal(t.writes, 0);
}
console.log('PASS: Square ID discovery 9 scenarios; unique ID setup only, no Square writes or buyer email');
