import test from 'node:test';
import assert from 'node:assert/strict';
import { nextBestOffer } from '../src/OfferEngine';

test('A upgrades to P3', () => {
  assert.equal(nextBestOffer({ purchased: ['A'] })?.code, 'P3');
});

test('multi-facility buyer is routed to P30', () => {
  assert.equal(nextBestOffer({ purchased: ['A'], facilityCount: 3 })?.code, 'P30');
});

test('monthly need takes priority', () => {
  assert.equal(nextBestOffer({ purchased: ['P10'], needsMonthlySupport: true })?.code, 'MONTHLY');
});

test('fully covered buyer has no next offer', () => {
  assert.equal(nextBestOffer({ purchased: ['A','P3','P10','P30','MONTHLY'] }), null);
});
