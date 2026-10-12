const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('gas/airhost_mail_capture.gs', 'utf8');

function runtime(query) {
  const rows = [];
  const seenQueries = [];
  let messages = [];
  const sheet = {
    getLastRow: () => rows.length,
    appendRow: row => rows.push(row),
    getRange: () => ({getDisplayValues: () => rows.slice(1).map(row => [row[1]])}),
  };
  const errors = {getLastRow: () => 1, appendRow: () => assert.fail('unexpected error')};
  const thread = {getMessages: () => messages, addLabel: () => {}, getId: () => 'thread'};
  const context = {
    PropertiesService: {getScriptProperties: () => ({getProperty: key => key === 'SPREADSHEET_ID' ? 'fixture-sheet' : query})},
    SpreadsheetApp: {openById: () => ({getSheetByName: name => name === 'RAW_EMAILS' ? sheet : errors})},
    GmailApp: {getUserLabelByName: () => ({}), search: value => {seenQueries.push(value); return [thread];}},
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return {run: () => context.captureAirHostReservationEmails(), rows, seenQueries,
    setMessages: ids => {messages = ids.map(id => ({getId: () => id, getDate: () => new Date(0), getSubject: () => 'reservation', getFrom: () => 'fixture@example.invalid', getPlainBody: () => 'sanitized fixture'}));}};
}

for (const query of [null, '', 'newer_than:2d', 'from:fixture@example.invalid -label:GTOS_PROCESSED']) {
  test('reject unsafe query ' + JSON.stringify(query), () => {
    const r = runtime(query);
    assert.throws(r.run, /requires a sender filter/);
    assert.equal(r.rows.length, 0);
    assert.equal(r.seenQueries.length, 0);
  });
}
test('new message in previously processed thread is captured without duplicating old message', () => {
  const r = runtime('from:fixture@example.invalid newer_than:2d');
  r.setMessages(['first']); r.run();
  r.setMessages(['first', 'second']); r.run();
  assert.deepEqual(r.rows.slice(1).map(row => row[1]), ['first', 'second']);
  assert.equal(r.seenQueries.length, 2);
});
