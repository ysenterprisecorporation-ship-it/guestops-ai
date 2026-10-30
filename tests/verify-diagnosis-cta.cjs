/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node CommonJS test */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'starter', 'upgrade', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'diagnosis script must exist');
const checkboxValues = [...html.matchAll(/<input type="checkbox" value="([^"]+)"/g)].map(x => x[1]);
assert.equal(checkboxValues.length, 12, 'diagnosis question count changed; update test deliberately');

function diagnose(values) {
  const result = {style: {}, innerHTML: '', scrollIntoView() {}};
  const next = {style: {}, innerHTML: ''};
  const document = {
    querySelectorAll: () => values.map(value => ({value})),
    getElementById: id => id === 'result' ? result : next
  };
  vm.runInNewContext(script + '\ndiagnose();', {document});
  return {result, next};
}

const empty = diagnose([]);
assert.equal(empty.next.style.display, 'none', 'empty selection must not show sales CTA');
assert.match(empty.result.innerHTML, /1つ以上選んで/);

const selected = diagnose(['価格運用', '低評価レビューへの効果的な返信']);
assert.equal(selected.next.style.display, 'block');
assert.match(selected.next.innerHTML, /料金・提供条件を見る/);
assert.match(selected.next.innerHTML, /\.\.\/order\//, 'Starter fallback CTA missing');
const href = selected.next.innerHTML.match(/href="(mailto:[^"]+)"/)?.[1];
assert.ok(href, 'consultation mailto CTA missing');
assert.ok(href.startsWith('mailto:minpaku.ai.kit@gmail.com?'));
assert.doesNotMatch(href, /square\.site|square\.link/i);
const body = decodeURIComponent(href.split('&body=')[1]);
assert.match(body, /導入予定施設数：/);
assert.match(body, /\n1\. .*料金を調整する/);
assert.match(body, /\n2\. .*低評価レビュー/);
assert.match(body, /選択した課題数：2件/);

const all = diagnose(checkboxValues);
const fullHref = all.next.innerHTML.match(/href="(mailto:[^"]+)"/)?.[1];
assert.ok(fullHref && fullHref.length < 2000, 'mailto exceeds conservative mobile URL budget');
const fullBody = decodeURIComponent(fullHref.split('&body=')[1]);
assert.equal((fullBody.match(/^\d\. /gm) || []).length, 3, 'include at most three priorities');
assert.doesNotMatch(html, /fetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/, 'diagnosis must not transmit data');
console.log('PASS: GuestOps diagnosis email CTA, empty state, priority summary, mobile URL size, no auto-transmission');
