import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeLeads, rankLeads, transitionLead, type LeadRecord } from '../src/LeadPipeline';

const base: LeadRecord = {
  project: '1',
  companyName: 'Example Hotel',
  sourceUrl: 'https://example.com',
  officialContact: 'info@example.com',
  contactType: 'email',
  fitScore: 90,
  fitEvidence: ['hotel operator'],
  deliveryRisk: 'low',
  status: 'new',
};

test('dedupeLeads removes duplicate contacts', () => {
  const result = dedupeLeads([base, { ...base, companyName: 'Example Hotel 2' }]);
  assert.equal(result.length, 1);
});

test('transitionLead enforces valid transitions', () => {
  const qualified = transitionLead(base, 'qualified', '2026-10-14T00:00:00Z');
  assert.equal(qualified.status, 'qualified');
  assert.throws(() => transitionLead(base, 'sent'));
});

test('rankLeads penalizes delivery risk', () => {
  const ranked = rankLeads([
    { ...base, companyName: 'Risky', fitScore: 95, deliveryRisk: 'high' },
    { ...base, companyName: 'Safe', officialContact: 'safe@example.com', fitScore: 85, deliveryRisk: 'low' },
  ]);
  assert.equal(ranked[0].companyName, 'Safe');
});
