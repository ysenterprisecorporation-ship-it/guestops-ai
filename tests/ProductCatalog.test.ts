import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogPrice } from '../src/ProductCatalog.ts';

test('canonical product prices match approved ladder', () => {
  assert.equal(catalogPrice('A'), 2980);
  assert.equal(catalogPrice('P3'), 19800);
  assert.equal(catalogPrice('P10'), 49800);
  assert.equal(catalogPrice('P30'), 99800);
  assert.equal(catalogPrice('UPGRADE_P3_FROM_A'), 16820);
  assert.equal(catalogPrice('UPGRADE_P10_FROM_A'), 46820);
  assert.equal(catalogPrice('UPGRADE_P30_FROM_A'), 96820);
});
