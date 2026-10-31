import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const docs = fileURLToPath(new URL('../docs/', import.meta.url));
const origin = 'https://ysenterprisecorporation-ship-it.github.io';
const prefix = '/guestops-ai/';
const required = [
  '/',
  '/starter/',
  '/starter/order/',
  '/starter/upgrade/',
  '/partners/',
];

test('public sales and diagnosis pages are discoverable without exposing paid delivery routes', () => {
  const xml = readFileSync(resolve(docs, 'sitemap.xml'), 'utf8');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.ok(xml.includes('http://www.sitemaps.org/schemas/sitemap/0.9'));
  assert.equal(new Set(urls).size, urls.length, 'duplicate sitemap entries');
  for (const path of required) {
    assert.ok(urls.includes(origin + prefix + path.slice(1)), 'missing public route: ' + path);
  }
  for (const entry of urls) {
    const url = new URL(entry);
    assert.equal(url.origin, origin, 'unexpected external domain');
    assert.ok(url.pathname.startsWith(prefix), 'URL outside published project');
    assert.equal(url.search, '', 'sitemap URL must not contain query data');
    assert.equal(url.hash, '', 'sitemap URL must not contain fragments');
    assert.doesNotMatch(url.pathname, /after-purchase|requested|fulfillment|private/i, 'paid delivery route exposed');
    const relative = url.pathname.slice(prefix.length);
    assert.ok(existsSync(resolve(docs, relative, 'index.html')), 'missing published HTML: ' + entry);
  }
  const robots = readFileSync(resolve(docs, 'robots.txt'), 'utf8');
  assert.ok(robots.includes('Sitemap: ' + origin + prefix + 'sitemap.xml'));
});
