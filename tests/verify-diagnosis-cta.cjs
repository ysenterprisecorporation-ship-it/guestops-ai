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

function diagnose(values, fields = {}) {
  const result = {style: {}, innerHTML: '', scrollIntoView() {}};
  const next = {style: {}, innerHTML: ''};
  const document = {
    querySelectorAll: () => values.map(value => ({value})),
    getElementById: id => ({result, nextStep: next, ...fields})[id] || null
  };
  vm.runInNewContext(script + '\ndiagnose(); goRefreshConsultationLink();', {document});
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

const fields = {
  goFacilities: {value: '4'},
  goPms: {value: 'Beds24'},
  goTiming: {value: '1か月以内'},
  goConsultationLink: {href: ''},
  goConsultationGmail: {href: ''}
};
const filled = diagnose(['価格運用'], fields);
const filledHref = filled.next.innerHTML.match(/href="(mailto:[^"]+)"/)?.[1];
assert.ok(filledHref, 'filled consultation mailto missing');
assert.equal(fields.goConsultationLink.href, filledHref, 'input change must update consultation href');
const filledBody = decodeURIComponent(filledHref.split('&body=')[1]);
assert.match(filledBody, /導入予定施設数：4/);
assert.match(filledBody, /現在利用している予約管理システム：Beds24/);
assert.match(filledBody, /希望開始時期：1か月以内/);
assert.match(filled.next.innerHTML, /メールアプリが起動しない場合/);
assert.match(filled.next.innerHTML, /id="goFacilities"/);
assert.match(filled.next.innerHTML, /id="goPms"/);
assert.match(filled.next.innerHTML, /id="goTiming"/);
const gmailHref = filled.next.innerHTML.match(/id="goConsultationGmail"[^>]*href="([^"]+)"/)?.[1];
assert.ok(gmailHref, 'browser Gmail CTA missing');
assert.ok(gmailHref.startsWith('https://mail.google.com/mail/?view=cm&fs=1&to='));
assert.equal(fields.goConsultationGmail.href, gmailHref, 'input change must update Gmail compose href');
assert.equal(decodeURIComponent(gmailHref.split('&body=')[1]), filledBody,
  'browser Gmail and default mail app must receive identical consultation body');
assert.doesNotMatch(gmailHref, /square\\.site|square\\.link/i);
assert.match(filled.next.innerHTML, /相談文をコピー/);

let copiedText = '';
const copyResult = {style: {}, innerHTML: '', scrollIntoView() {}};
const copyNext = {style: {}, innerHTML: ''};
const copyFields = {
  goFacilities: {value: '2'}, goPms: {value: 'Beds24'}, goTiming: {value: 'すぐに'}
};
const copyDocument = {
  querySelectorAll: () => [{value: '価格運用'}],
  getElementById: id => ({result: copyResult, nextStep: copyNext, ...copyFields})[id] || null
};
vm.runInNewContext(script + '\\ndiagnose(); goConsultationCopy_();', {
  document: copyDocument,
  prompt: (message, value) => { copiedText = value; }
});
assert.match(copiedText, /宛先: minpaku\\.ai\\.kit@gmail\\.com\\n件名:/,
  'copied consultation must contain real line breaks and recipient');
assert.match(copiedText, /導入予定施設数：2/);
assert.match(copiedText, /現在利用している予約管理システム：Beds24/);


const all = diagnose(checkboxValues);
const fullHref = all.next.innerHTML.match(/href="(mailto:[^"]+)"/)?.[1];
assert.ok(fullHref && fullHref.length < 2000, 'mailto exceeds conservative mobile URL budget');
const fullBody = decodeURIComponent(fullHref.split('&body=')[1]);
assert.equal((fullBody.match(/^\d\. /gm) || []).length, 3, 'include at most three priorities');
assert.doesNotMatch(html, /fetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/, 'diagnosis must not transmit data');
console.log('PASS: GuestOps diagnosis mailto, browser Gmail, copy fallback, field updates, privacy and URL budget');
