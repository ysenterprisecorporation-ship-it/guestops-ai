// GuestOps Starter Kit | single-paste GAS bundle
// Generated from Code.gs and StarterCompanions.gs on 2026-11-01.
// Paste this entire file into a NEW, otherwise empty Apps Script project.
// Do not add Code.gs, StarterCompanions.gs, Deployment.gs or BuyerAccess.gs alongside it.
// No Square credentials or private buyer-material URLs are embedded.
// Initial SEND_ENABLED must remain false.

/**
 * GuestOps Starter Kit (9,800 JPY) fulfillment candidate processor.
 * GAS time-driven trigger: runStarterFulfillment.
 * FAIL CLOSED: SEND_ENABLED defaults to false; no charge or Square mutation.
 * Never publish access tokens or buyer delivery links in a public repository.
 */
const GO_SQUARE_API = 'https://connect.squareup.com/v2/';
const GO_SQUARE_VERSION = '2026-08-19';
const GO_SENDER = 'minpaku.ai.kit@gmail.com';
const GO_PRICE_JPY = 9800;

function goRequiredConfig_(props) {
  const keys = [
    'SQUARE_ACCESS_TOKEN', 'SQUARE_LOCATION_ID', 'STARTER_CATALOG_OBJECT_ID',
    'FULFILL_SINCE_ISO', 'STARTER_GUIDE_URL',
    'STARTER_PROMPT_URL', 'STARTER_SHEET_URL'
  ];
  const missing = keys.filter(k => !props.getProperty(k));
  if (missing.length) throw new Error('Missing Script Properties: ' + missing.join(', '));
  const since = props.getProperty('FULFILL_SINCE_ISO');
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(since) ||
      !Number.isFinite(Date.parse(since)) || Date.parse(since) > Date.now()) {
    throw new Error('FULFILL_SINCE_ISO must be a valid UTC past timestamp.');
  }
  // Buyer materials must be the intended Google file types, not just any
  // URL on docs.google.com. Reject a duplicated file ID before sending.
  const materialPaths = {
    STARTER_GUIDE_URL: /^https:\/\/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]+)(?:\/|$)/,
    STARTER_PROMPT_URL: /^https:\/\/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]+)(?:\/|$)/,
    STARTER_SHEET_URL: /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/|$)/
  };
  const materialIds = {};
  Object.keys(materialPaths).forEach(k => {
    const match = props.getProperty(k).match(materialPaths[k]);
    if (!match) throw new Error(k + ' must be a matching Google Docs/Sheets file URL.');
    if (materialIds[match[1]]) throw new Error('Duplicate buyer material file ID; no delivery.');
    materialIds[match[1]] = true;
  });
  const effectiveEmail = Session.getEffectiveUser().getEmail();
  if (typeof effectiveEmail !== 'string' ||
      effectiveEmail.toLowerCase() !== GO_SENDER) {
    throw new Error('Wrong or unavailable Google account: run only as ' + GO_SENDER);
  }
  return {
    token: props.getProperty('SQUARE_ACCESS_TOKEN'),
    location: props.getProperty('SQUARE_LOCATION_ID'),
    catalogId: props.getProperty('STARTER_CATALOG_OBJECT_ID'),
    since,
    enabled: props.getProperty('SEND_ENABLED') === 'true',
    guide: props.getProperty('STARTER_GUIDE_URL'),
    prompt: props.getProperty('STARTER_PROMPT_URL'),
    sheet: props.getProperty('STARTER_SHEET_URL')
  };
}

function goSquareGet_(path, config) {
  const res = UrlFetchApp.fetch(GO_SQUARE_API + path, {
    method: 'get', muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + config.token,
      'Square-Version': GO_SQUARE_VERSION,
      'Content-Type': 'application/json'
    }
  });
  const status = res.getResponseCode();
  if (status !== 200) throw new Error('Square GET failed: HTTP ' + status);
  return JSON.parse(res.getContentText());
}

/**
 * Fail closed on malformed 200 responses. Square can omit `payments` when
 * there are no matches, but a non-array payments field is not an empty page.
 */
function goValidatePaymentPage_(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response) ||
      (response.payments !== undefined && !Array.isArray(response.payments)) ||
      (response.cursor !== undefined && typeof response.cursor !== 'string') ||
      (response.errors !== undefined &&
        (!Array.isArray(response.errors) || response.errors.length > 0))) {
    throw new Error('Unexpected Square payment list response; no delivery attempted.');
  }
  return response;
}

/**
 * Accept one plain ASCII mailbox only. Gmail's recipient parser treats commas,
 * semicolons and display-name syntax as address lists; never trust a loose
 * "contains @ and dot" check for buyer-only delivery.
 * Internationalized domains must arrive as ASCII/Punycode; otherwise manual review.
 */
function goBuyerEmailValid_(email) {
  if (typeof email !== 'string' || email.length > 254) return false;
  const parts = email.split('@');
  if (parts.length !== 2 || parts[0].length > 64) return false;
  const local = parts[0];
  const domain = parts[1];
  // Never deliver paid materials to reserved documentation/test domains.
  // Such addresses can appear in an internal sales ledger as dummy orders.
  const lowerDomain = domain.toLowerCase();
  if (lowerDomain === 'localhost' ||
      /(?:^|\.)(?:invalid|test|example|localhost)$/.test(lowerDomain) ||
      /^(?:example\.com|example\.net|example\.org)$/.test(lowerDomain)) return false;
  const atom = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+$/;
  if (!local.split('.').every(part => part && atom.test(part))) return false;
  if (domain.length > 253 || !domain.includes('.')) return false;
  return domain.split('.').every(label =>
    label.length >= 1 && label.length <= 63 &&
    /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label));
}

/**
 * Square Money.amount is an integer in the smallest currency unit. Accept a
 * safe integer or its canonical decimal string (some API clients serialize
 * int64 as strings). Never coerce arrays, null, booleans or exponent strings:
 * Number(...) would silently turn these malformed responses into 9,800/0.
 */
function goMoneyEquals_(money, expected) {
  if (!money || money.currency !== 'JPY') return false;
  const amount = money.amount;
  return (typeof amount === 'number' &&
      Number.isSafeInteger(amount) && amount === expected) ||
    (typeof amount === 'string' &&
      /^(0|[1-9][0-9]*)$/.test(amount) && amount === String(expected));
}

function goPaymentEligible_(p, config) {
  return !!(p && p.id && p.status === 'COMPLETED' &&
    p.location_id === config.location && p.order_id &&
    goMoneyEquals_(p.amount_money, GO_PRICE_JPY) &&
    (p.refund_ids === undefined || (Array.isArray(p.refund_ids) && p.refund_ids.length === 0)) &&
    (p.refunded_money === undefined ||
      goMoneyEquals_(p.refunded_money, 0)) &&
    // An explicit tip must be zero JPY. A tip must not be silently treated
    // as part of the fixed-price 9,800 JPY Starter purchase.
    (p.tip_money === undefined || goMoneyEquals_(p.tip_money, 0)) &&
    p.created_at && Date.parse(p.created_at) >= Date.parse(config.since) &&
    goBuyerEmailValid_(p.buyer_email_address) &&
    p.buyer_email_address.toLowerCase() !== GO_SENDER);
}

/** Re-read the payment immediately before delivery; reject refunds or changed buyers. */
function goPaymentStillEligible_(listed, latest, config) {
  return goPaymentEligible_(latest, config) &&
    latest.id === listed.id &&
    latest.order_id === listed.order_id &&
    latest.buyer_email_address.toLowerCase() === listed.buyer_email_address.toLowerCase();
}

function goOrderEligible_(order, payment, config) {
  if (!order || order.id !== payment.order_id ||
      // OPEN orders remain mutable and are not confirmed fully paid. Require
      // the terminal COMPLETED state before issuing buyer-only materials.
      order.state !== 'COMPLETED' ||
      order.location_id !== config.location ||
      !goMoneyEquals_(order.total_money, GO_PRICE_JPY) ||
      // A completed payment alone is insufficient if the order has been
      // refunded or returned through another tender or a later operation.
      // Missing arrays are normal; malformed/nonempty arrays fail closed.
      (order.refunds !== undefined &&
        (!Array.isArray(order.refunds) || order.refunds.length > 0)) ||
      (order.returns !== undefined &&
        (!Array.isArray(order.returns) || order.returns.length > 0)) ||
      !Array.isArray(order.line_items) || order.line_items.length !== 1) return false;
  const item = order.line_items[0];
  // Square's quantity is a canonical decimal string. Reject arrays/objects:
  // String([1]) and custom toString() values could otherwise masquerade as '1'.
  return !!item && typeof item === 'object' && !Array.isArray(item) &&
    item.catalog_object_id === config.catalogId &&
    (item.quantity === '1' || item.quantity === 1);
}

function goDeliveryBody_(payment, config) {
  return [
    'GuestOps Starter Kitのお申し込みありがとうございます。',
    'Squareでの決済完了を確認しました。以下が購入者用教材です。',
    '',
    '1. 利用ガイド: ' + config.guide,
    '2. 施設専用マスタープロンプト: ' + config.prompt,
    '3. 施設情報・20場面判断・清掃設備点検・月額移行条件シート: ' + config.sheet,
    '',
    '【最初の3ステップ】',
    '1. 利用ガイドの「購入直後の動作確認」を開いてください。',
    '2. 設定シートは閲覧専用です。Googleスプレッドシートの［ファイル］→［コピーを作成］でご自身のDriveに保存し、コピーに施設情報を入力してください。',
    '3. 20場面の架空例で判断基準を確認してから、AIの返信案を人が確認して利用してください。',
    '',
    '清掃・設備10項目の点検は宿泊準備ごとに新しいコピーを使い、施設コード・点検日・責任者承認を記録してください。',
    '実際のゲスト情報は匿名化し、予約者の氏名・カード情報を外部AIに入力しないでください。',
    'Starterは手動運用用です。PMS連携・予約サイト自動送信・料金自動変更は含まれません。',
    '',
    '照合番号: ' + payment.id,
    'お問い合わせ: ' + GO_SENDER,
    'GuestOps AI 運営窓口'
  ].join('\n');
}

function goKey_(paymentId) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, paymentId);
  return 'GO_SENT_' + Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

function runStarterFulfillment() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Another fulfillment run is active.');
  try {
    const props = PropertiesService.getScriptProperties();
    const config = goRequiredConfig_(props);
    // Never send from an unintended Google identity, even if the trigger was
    // copied or installed in a different account with valid Square credentials.
    if (config.enabled) {
      const effectiveEmail = Session.getEffectiveUser().getEmail();
      if (typeof effectiveEmail !== 'string' ||
          effectiveEmail.toLowerCase() !== GO_SENDER) {
        throw new Error('Starter fulfillment sender account mismatch; sending blocked.');
      }
    }
    // The go-live audit is not enough: each enabled trigger run must reject
    // unresolved guards left by ANY prior order, including refunded orders
    // that no longer appear in the Square payment listing. Do this before
    // fetching payments or reserving another delivery.
    if (config.enabled) {
      const guards = auditStarterDeliveryGuards();
      if (!guards ||
          !Number.isSafeInteger(guards.pendingGuardCount) ||
          !Number.isSafeInteger(guards.unrecognizedGuardCount) ||
          guards.pendingGuardCount < 0 || guards.unrecognizedGuardCount < 0 ||
          guards.pendingGuardCount > 0 || guards.unrecognizedGuardCount > 0) {
        throw new Error('Unresolved or unreadable delivery guards; sending blocked.');
      }
    }
    let cursor = '';
    const seenCursors = {};
    for (let page = 0; page < 10; page++) {
      if (cursor) {
        if (seenCursors[cursor]) throw new Error('Repeated Square pagination cursor; stopped.');
        seenCursors[cursor] = true;
      }
      let query = 'payments?limit=100&sort_order=DESC&location_id=' +
        encodeURIComponent(config.location) + '&begin_time=' +
        encodeURIComponent(config.since);
      if (cursor) query += '&cursor=' + encodeURIComponent(cursor);
      const response = goValidatePaymentPage_(goSquareGet_(query, config));
      const payments = response.payments || [];
      for (const payment of payments) {
        if (!goPaymentEligible_(payment, config)) continue;
        const key = goKey_(payment.id);
        // An order can have more than one payment; protect both identifiers.
        const orderKey = goKey_('ORDER:' + payment.order_id);
        if (props.getProperty(key) || props.getProperty(orderKey)) continue;
        const result = goSquareGet_('orders/' + encodeURIComponent(payment.order_id), config);
        if (!goOrderEligible_(result.order, payment, config)) continue;
        if (!config.enabled) {
          console.log('DRY_RUN eligible payment suffix: ' + payment.id.slice(-8));
          continue;
        }
        // The listing is only a snapshot. Re-read this exact payment to avoid
        // delivering after a refund or to a buyer address changed in Square.
        // Any missing/malformed detail stops processing before PENDING or Gmail.
        const refreshed = goSquareGet_('payments/' + encodeURIComponent(payment.id), config);
        if (!refreshed || !goPaymentStillEligible_(payment, refreshed.payment, config)) {
          throw new Error('Payment changed during fulfillment; no delivery attempted.');
        }
        // Orders can be refunded, returned or canceled after the initial read.
        // Re-fetch the order immediately before reserving the delivery guards.
        // Never rely on the earlier eligible order snapshot for live sending.
        const latestOrder = goSquareGet_('orders/' + encodeURIComponent(payment.order_id), config);
        if (!latestOrder || !goOrderEligible_(latestOrder.order, refreshed.payment, config)) {
          throw new Error('Order changed during fulfillment; no delivery attempted.');
        }
        // Check buyer-material permissions at send time, not just at setup.
        // A publicly link-shared, missing, or non-buyer-viewable file must never be advertised as a
        // working buyer-only delivery. The audit is read-only and fail-closed.
        // With opt-in provisioning, first verify all files are private.
        // Buyer-specific VIEW grants happen only AFTER both PENDING guards
        // have been reserved. Without opt-in, require pre-existing VIEW.
        const autoGrant = props.getProperty('AUTO_GRANT_BUYER_ACCESS') === 'true';
        const materialAudit = auditStarterMaterialAccess(
          autoGrant ? undefined : refreshed.payment.buyer_email_address);
        if (!materialAudit || materialAudit.ready !== true) {
          throw new Error('Buyer material access failed; no delivery attempted.');
        }
        // A missing companion script must fail BEFORE reserving PENDING guards.
        // Otherwise a paid order is permanently stuck in manual reconciliation
        // even though no permission was granted and no Gmail send was attempted.
        if (autoGrant && typeof goGrantStarterBuyerAccess_ !== 'function') {
          throw new Error('Buyer access provisioner not deployed; no delivery reserved.');
        }
        // A pause may be requested while Square API reads are in progress.
        // Re-read the live flag rather than trusting config.enabled from run start.
        if (props.getProperty('SEND_ENABLED') !== 'true') {
          throw new Error('Fulfillment paused before reserving delivery; no Gmail attempted.');
        }
        // Mark PENDING before Gmail send to fail closed on interrupted execution.
        // An unresolved PENDING record must be reviewed before any manual retry.
        const pendingAt = 'PENDING ' + new Date().toISOString();
        // Write the order guard FIRST. If the payment-key write fails,
        // the order remains blocked and no email is sent.
        props.setProperty(orderKey, pendingAt);
        props.setProperty(key, pendingAt);
        if (autoGrant) {
          // A verified buyer may receive VIEW access to the three private
          // materials. Any partial failure retains PENDING and blocks Gmail.
          if (props.getProperty('AUTO_GRANT_BUYER_ACCESS') !== 'true') {
            throw new Error('Buyer access provisioning disabled; PENDING retained.');
          }
          goGrantStarterBuyerAccess_(refreshed.payment.buyer_email_address, orderKey, key);
          const buyerAccess = auditStarterMaterialAccess(
            refreshed.payment.buyer_email_address);
          if (!buyerAccess || buyerAccess.ready !== true) {
            throw new Error('Buyer access not verified; PENDING retained.');
          }
        }
        // A pause after reservation must prevent Gmail. Keep both PENDING
        // guards for manual review; never automatically retry this order.
        if (props.getProperty('SEND_ENABLED') !== 'true') {
          throw new Error('Fulfillment paused before Gmail; PENDING retained for manual review.');
        }
        const subject = '【GuestOps AI】Starter Kit 教材のご案内';
        try {
          // GmailDraft.send() returns a GmailMessage. Capture its message ID
          // so a recorded SENT status has a concrete Gmail audit reference.
          // The PENDING guards are already stored before draft creation.
          const sentMessage = GmailApp.createDraft(refreshed.payment.buyer_email_address, subject,
            goDeliveryBody_(refreshed.payment, config), {
              name: 'GuestOps AI', replyTo: GO_SENDER
            }).send();
          const gmailId = sentMessage && sentMessage.getId();
          if (typeof gmailId !== 'string' || !gmailId) {
            throw new Error('Gmail sent without a usable message ID; manual review required.');
          }
          const sentAt = 'SENT ' + new Date().toISOString() + ' MSG:' + gmailId;
          // Keep the order guard authoritative even if the second write fails.
          props.setProperty(orderKey, sentAt);
          props.setProperty(key, sentAt);
          console.log('SENT payment suffix: ' + payment.id.slice(-8));
        } catch (e) {
          // Keep PENDING: an API exception does not prove that mail was unsent.
          console.error('Send needs manual review, payment suffix: ' + payment.id.slice(-8));
          throw e;
        }
      }
      cursor = response.cursor || '';
      if (!cursor) return;
    }
    throw new Error('Payment pagination exceeded 10 pages; investigate before next run.');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Read-only prelaunch audit: checks Square orders but NEVER sends Gmail or writes
 * Script Properties. Aggregates counts only; does not log buyer PII or tokens.
 * Run under the authorized account after configuring Script Properties.
 */
function auditStarterFulfillment() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Another fulfillment run is active.');
  try {
    const props = PropertiesService.getScriptProperties();
    const config = goRequiredConfig_(props);
    const summary = {
      scannedPayments: 0, eligiblePayments: 0, uniqueEligibleOrders: 0,
      readyToDeliver: 0, recordedSent: 0, pendingReview: 0,
      otherRecorded: 0, invalidOrders: 0, rejectedPayments: 0,
      refundedPayments: 0, missingBuyerEmail: 0, unsettledPayments: 0,
      otherRejectedPayments: 0
    };
    const seenOrders = {};
    let cursor = '';
    const seenCursors = {};
    for (let page = 0; page < 10; page++) {
      if (cursor) {
        if (seenCursors[cursor]) throw new Error('Repeated Square pagination cursor; stopped.');
        seenCursors[cursor] = true;
      }
      let query = 'payments?limit=100&sort_order=DESC&location_id=' +
        encodeURIComponent(config.location) + '&begin_time=' +
        encodeURIComponent(config.since);
      if (cursor) query += '&cursor=' + encodeURIComponent(cursor);
      const response = goValidatePaymentPage_(goSquareGet_(query, config));
      for (const payment of (response.payments || [])) {
        summary.scannedPayments++;
        if (!goPaymentEligible_(payment, config)) {
          summary.rejectedPayments++;
          if (payment && ((Array.isArray(payment.refund_ids) && payment.refund_ids.length) ||
              (payment.refunded_money && Number(payment.refunded_money.amount || 0) > 0))) {
            summary.refundedPayments++;
          } else if (!payment || !goBuyerEmailValid_(payment.buyer_email_address) ||
              payment.buyer_email_address.toLowerCase() === GO_SENDER) {
            summary.missingBuyerEmail++;
          } else if (payment.status !== 'COMPLETED') {
            summary.unsettledPayments++;
          } else {
            summary.otherRejectedPayments++;
          }
          continue;
        }
        summary.eligiblePayments++;
        if (Object.prototype.hasOwnProperty.call(seenOrders, payment.order_id)) continue;
        seenOrders[payment.order_id] = true;
        summary.uniqueEligibleOrders++;
        const key = goKey_(payment.id);
        const orderKey = goKey_('ORDER:' + payment.order_id);
        const status = [props.getProperty(key), props.getProperty(orderKey)]
          .filter(Boolean).join(' ');
        if (status) {
          if (status.includes('PENDING')) summary.pendingReview++;
          else if (status.includes('SENT')) summary.recordedSent++;
          else summary.otherRecorded++;
          continue;
        }
        const result = goSquareGet_('orders/' + encodeURIComponent(payment.order_id), config);
        if (!goOrderEligible_(result.order, payment, config)) {
          summary.invalidOrders++;
          continue;
        }
        summary.readyToDeliver++;
      }
      cursor = response.cursor || '';
      if (!cursor) {
        console.log('FULFILLMENT_AUDIT ' + JSON.stringify(summary));
        return summary;
      }
    }
    throw new Error('Payment audit exceeded 10 pages; review pagination.');
  } finally {
    lock.releaseLock();
  }
}

/** No API calls or emails. Run this first in Apps Script. */
function testStarterFulfillmentRules() {
  const c = {location:'L1',catalogId:'VAR1',since:'2026-10-29T00:00:00Z'};
  const p = {id:'P1',status:'COMPLETED',location_id:'L1',order_id:'O1',
    amount_money:{amount:9800,currency:'JPY'},buyer_email_address:'buyer@valid-domain.jp',
    created_at:'2026-10-30T00:00:00Z'};
  const o = {id:'O1',state:'COMPLETED',location_id:'L1',total_money:{amount:9800,currency:'JPY'},
    line_items:[{catalog_object_id:'VAR1',quantity:'1'}]};
  function check(x, label) {if (!x) throw new Error('FAILED: ' + label);}
  check(goPaymentEligible_(p,c), 'paid valid payment');
  // Account-gate regression: a wrong identity must fail before payment retrieval.
  const actualSender = Session.getEffectiveUser().getEmail();
  check(typeof actualSender === 'string' &&
    actualSender.toLowerCase() === GO_SENDER, 'test executed by authorized sender');
  check(goOrderEligible_(o,p,c), 'correct product');
  check(!goPaymentEligible_(Object.assign({},p,{status:'APPROVED'}),c), 'unsettled');
  check(!goPaymentEligible_(Object.assign({},p,{amount_money:{amount:980,currency:'JPY'}}),c), 'amount');
  check(!goPaymentEligible_(Object.assign({},p,{refund_ids:['R1']}),c), 'refund');
  check(!goPaymentEligible_(Object.assign({},p,{refund_ids:{length:0}}),c), 'malformed refund IDs');
  check(!goPaymentEligible_(Object.assign({},p,{refunded_money:{amount:'invalid',currency:'JPY'}}),c), 'malformed refunded amount');
  check(!goPaymentEligible_(Object.assign({},p,{refunded_money:{amount:0,currency:'USD'}}),c), 'refunded currency mismatch');
  check(goPaymentEligible_(Object.assign({},p,{tip_money:{amount:0,currency:'JPY'}}),c), 'zero JPY tip allowed');
  check(!goPaymentEligible_(Object.assign({},p,{tip_money:{amount:100,currency:'JPY'}}),c), 'nonzero tip blocked');
  check(!goPaymentEligible_(Object.assign({},p,{tip_money:{amount:0,currency:'USD'}}),c), 'tip currency mismatch blocked');
  check(!goPaymentEligible_(Object.assign({},p,{tip_money:{amount:[0],currency:'JPY'}}),c), 'malformed tip blocked');
  check(!goPaymentEligible_(Object.assign({},p,{buyer_email_address:''}),c), 'missing email');
  check(goBuyerEmailValid_('buyer+tag@valid-domain.jp'), 'single valid tagged mailbox');
  check(!goBuyerEmailValid_('test@example.invalid'), 'reserved invalid TLD blocked');
  check(!goBuyerEmailValid_('test@example.com'), 'reserved example.com blocked');
  check(!goBuyerEmailValid_('test@shop.test'), 'reserved test TLD blocked');
  check(!goBuyerEmailValid_('buyer@valid-domain.jp,other@example.com'), 'recipient list blocked');
  check(!goBuyerEmailValid_('Buyer <buyer@valid-domain.jp>'), 'display-name syntax blocked');
  check(!goBuyerEmailValid_('buyer@valid-domain.jp;other'), 'semicolon delimiter blocked');
  check(!goBuyerEmailValid_('buyer..double@example.com'), 'invalid dot atom blocked');
  check(!goBuyerEmailValid_('buyer@example..com'), 'invalid domain blocked');
  check(!goPaymentEligible_(Object.assign({},p,{buyer_email_address:'buyer@valid-domain.jp,other'}),c), 'malformed recipient rejected');

  check(!goOrderEligible_(Object.assign({},o,{line_items:[{catalog_object_id:'OTHER',quantity:'1'}]}),p,c), 'wrong item');
  check(!goOrderEligible_(Object.assign({},o,{line_items:[{catalog_object_id:'VAR1',quantity:'2'}]}),p,c), 'quantity');
  check(!goPaymentEligible_(Object.assign({},p,{refunded_money:{amount:9800,currency:'JPY'}}),c), 'refunded amount');
  check(!goPaymentEligible_(Object.assign({},p,{created_at:'2026-10-28T00:00:00Z'}),c), 'before monitoring window');
  check(!goPaymentEligible_(Object.assign({},p,{buyer_email_address:GO_SENDER}),c), 'self-delivery blocked');
  check(!goPaymentEligible_(Object.assign({},p,{location_id:'OTHER'}),c), 'wrong payment location');
  check(!goPaymentEligible_(Object.assign({},p,{amount_money:{amount:9800,currency:'USD'}}),c), 'wrong currency');
  check(!goOrderEligible_(Object.assign({},o,{location_id:'OTHER'}),p,c), 'wrong order location');
  check(!goOrderEligible_(Object.assign({},o,{line_items:[o.line_items[0],o.line_items[0]]}),p,c), 'multiple items');
  check(!goOrderEligible_(Object.assign({},o,{total_money:{amount:9700,currency:'JPY'}}),p,c), 'wrong order total');
  check(!goOrderEligible_(Object.assign({},o,{state:'CANCELED'}),p,c), 'canceled order');
  check(!goOrderEligible_(Object.assign({},o,{state:'DRAFT'}),p,c), 'draft order');
  check(!goOrderEligible_(Object.assign({},o,{state:'OPEN'}),p,c), 'open order must not be fulfilled');
  check(!goOrderEligible_(Object.assign({},o,{state:undefined}),p,c), 'missing order state must fail closed');
  check(!goOrderEligible_(Object.assign({},o,{refunds:[{id:'REF1'}]}),p,c), 'refunded order blocked');
  check(!goOrderEligible_(Object.assign({},o,{returns:[{id:'RETURN1'}]}),p,c), 'returned order blocked');
  check(!goOrderEligible_(Object.assign({},o,{refunds:{unexpected:true}}),p,c), 'malformed refunds blocked');
  console.log('PASS: refund and fulfillment eligibility checks');
}


// ----- STARTER COMPANIONS -----

/**
 * GuestOps Starter GAS companion modules (single-paste deployment artifact).
 * Add as ONE new Apps Script file named StarterCompanions.gs alongside Code.gs.
 * This file defines the existing Deployment and BuyerAccess helpers, unchanged.
 * Never paste it alongside the separate Deployment.gs / BuyerAccess.gs files:
 * that would duplicate function names. Does not execute on load.
 * Source blobs: Deployment.gs=2ec3eb472f48b6cfe3283d6c9cc1e1fa174270ee; BuyerAccess.gs=e0aecfbb89a34c4d761885277d1032eadf67053c
 */

// === BEGIN Deployment.gs ===
/**
 * Starter Kit production handoff helpers.
 * Add this as a separate .gs file beside Code.gs in the SAME Apps Script project.
 * No payment changes, no automatic activation of buyer email delivery.
 */
function goStarterTriggers_() {
  return ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'runStarterFulfillment');
}

/** Configuration/trigger status without revealing token, IDs, or buyer data. */
function getStarterDeploymentStatus() {
  const props = PropertiesService.getScriptProperties();
  const required = [
    'SQUARE_ACCESS_TOKEN', 'SQUARE_LOCATION_ID', 'STARTER_CATALOG_OBJECT_ID',
    'FULFILL_SINCE_ISO', 'STARTER_GUIDE_URL', 'STARTER_PROMPT_URL',
    'STARTER_SHEET_URL'
  ];
  const status = {
    authorizedAccount: Session.getEffectiveUser().getEmail().toLowerCase() === GO_SENDER,
    missingPropertyNames: required.filter(k => !props.getProperty(k)),
    sendEnabled: props.getProperty('SEND_ENABLED') === 'true',
    triggerCount: goStarterTriggers_().length
  };
  console.log('STARTER_DEPLOYMENT_STATUS ' + JSON.stringify(status));
  return status;
}

/**
 * One-action setup for the three already-created PRIVATE migration materials.
 * Resolve by exact Drive title, never by a public GitHub URL or retired ID.
 * Must run as the Starter sender while sending is OFF. Validates all three
 * before writing any property. Does NOT enable mail, sharing or payments.
 */
function configureStarterPrivateMaterials() {
  const props = PropertiesService.getScriptProperties();
  if (Session.getEffectiveUser().getEmail().toLowerCase() !== GO_SENDER) {
    throw new Error('Run only from the authorized Starter sender account.');
  }
  if (props.getProperty('SEND_ENABLED') === 'true') {
    throw new Error('Pause fulfillment before configuring private materials.');
  }
  const specs = [
    {key: 'STARTER_GUIDE_URL',
      title: 'GuestOps Starter Kit｜利用ガイド（限定共有・移行版 20261031）',
      type: 'document', mime: 'application/vnd.google-apps.document'},
    {key: 'STARTER_PROMPT_URL',
      title: 'GuestOps Starter Kit｜マスタープロンプト（限定共有・移行版 20261031）',
      type: 'document', mime: 'application/vnd.google-apps.document'},
    {key: 'STARTER_SHEET_URL',
      title: 'GuestOps Starter Kit｜施設情報・判断シート（限定共有・移行版 20261031）',
      type: 'spreadsheets', mime: 'application/vnd.google-apps.spreadsheet'}
  ];
  const updates = {};
  const seen = new Set();
  const retired = goStarterRetiredMaterialIds_();
  specs.forEach(spec => {
    const matches = DriveApp.getFilesByName(spec.title);
    if (!matches.hasNext()) throw new Error('Private material not found: ' + spec.key);
    const file = matches.next();
    if (matches.hasNext()) throw new Error('Ambiguous private material title: ' + spec.key);
    const id = file.getId();
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{20,}$/.test(id) ||
        seen.has(id) || retired.includes(id) ||
        file.getMimeType() !== spec.mime ||
        file.getSharingAccess() !== DriveApp.Access.PRIVATE ||
        file.getAccess(GO_SENDER) !== DriveApp.Permission.EDIT) {
      throw new Error('Private material validation failed: ' + spec.key);
    }
    seen.add(id);
    updates[spec.key] = 'https://docs.google.com/' + spec.type + '/d/' + id + '/edit';
  });
  // Recheck the pause immediately before committing the three URLs.
  if (props.getProperty('SEND_ENABLED') === 'true') {
    throw new Error('Fulfillment resumed during setup; no URLs written.');
  }
  props.setProperties(updates);
  const verified = auditStarterMaterialAccess();
  if (!verified || verified.ready !== true) {
    // Remain fail-closed. Sending was never enabled by this helper.
    throw new Error('Private material post-write audit failed; sending remains disabled.');
  }
  return {configuredPrivateMaterials: specs.length, sendEnabled: false,
    verified: true};
}

/**
 * One-time dry-run trigger installer.
 * Audits live Square READ-ONLY first. Never enables sending or creates a charge.
 * Requires all Script Properties to be configured and SEND_ENABLED=false.
 */
function installStarterDryRunTrigger() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('SEND_ENABLED') === 'true') {
    throw new Error('Set SEND_ENABLED=false before dry-run trigger installation.');
  }
  const audit = auditStarterFulfillment(); // read-only, no Gmail, no property writes
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Another fulfillment run is active.');
  try {
    goRequiredConfig_(props);
    if (props.getProperty('SEND_ENABLED') === 'true') {
      throw new Error('SEND_ENABLED changed; no trigger installed.');
    }
    const existing = goStarterTriggers_();
    if (existing.length > 1) {
      throw new Error('Multiple fulfillment triggers found; no new trigger installed.');
    }
    const created = existing.length === 0;
    if (created) {
      ScriptApp.newTrigger('runStarterFulfillment')
        .timeBased().everyMinutes(15).create();
    }
    const result = {
      dryRunOnly: true,
      triggerCreated: created,
      triggerCount: goStarterTriggers_().length,
      auditedPayments: audit.scannedPayments,
      eligibleOrders: audit.uniqueEligibleOrders,
      pendingReview: audit.pendingReview
    };
    console.log('STARTER_DRY_RUN_INSTALL ' + JSON.stringify(result));
    return result;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Emergency pause without waiting for the running fulfillment lock.
 * The sender re-reads SEND_ENABLED before reservation and before Gmail send.
 * A Gmail operation already in progress cannot be recalled; PENDING must be
 * reconciled before any restart. No Square/price/trigger mutation occurs.
 */
function pauseStarterFulfillment() {
  PropertiesService.getScriptProperties().setProperty('SEND_ENABLED', 'false');
  console.log('STARTER_FULFILLMENT_PAUSED');
  return {sendEnabled: false};
}

/**
 * Read-only audit of paid Starter materials.
 *
 * The old "anyone with the link" permission is NOT acceptable: these URLs
 * were previously committed to a public Git repository and remain in history.
 * Require PRIVATE files and, when a buyer is supplied, explicit VIEW access
 * for that exact Square-verified mailbox. No permission changes are made.
 *
 * Do not log file IDs, URLs, or buyer email addresses.
 */
/** Immutable denylist: identifiers exposed in historical public Git commits. */
function goStarterRetiredMaterialIds_() {
  return [
    '1MjTNyh8hjvJW5Eg2wsaRPgfMQ1nWazbs_qazdkSNNjQ',
    '1SHotxS2tvQuxHSGRS4SJMqUNhKSe-W_tukvEbuZ7xuQ',
    '1X5qCRw7wOjsusOUVopX2_735z0r-WMwUDC2-Hp7Zb8c'
  ];
}

function auditStarterMaterialAccess(buyerEmail) {
  const props = PropertiesService.getScriptProperties();
  const specs = [
    {key: 'STARTER_GUIDE_URL', type: 'document',
      mime: 'application/vnd.google-apps.document'},
    {key: 'STARTER_PROMPT_URL', type: 'document',
      mime: 'application/vnd.google-apps.document'},
    {key: 'STARTER_SHEET_URL', type: 'spreadsheets',
      mime: 'application/vnd.google-apps.spreadsheet'}
  ];
  if (buyerEmail !== undefined && !goBuyerEmailValid_(buyerEmail)) {
    return {ready: false, checks: [{material: 'BUYER', status: 'INVALID_BUYER_EMAIL'}]};
  }
  const seenMaterialIds = new Set();
  const checks = specs.map(spec => {
    const url = props.getProperty(spec.key);
    const pattern = new RegExp('^https://docs\\.google\\.com/' +
      spec.type + '/d/([A-Za-z0-9_-]+)(?:/|$)');
    const match = typeof url === 'string' ? url.match(pattern) : null;
    if (!match) return {material: spec.key, status: 'INVALID_URL'};
    // Historical public Git commits exposed these OLD material identifiers.
    // Never reuse them for paid fulfillment, even after changing their permissions.
    if (goStarterRetiredMaterialIds_().includes(match[1])) {
      return {material: spec.key, status: 'RETIRED_PUBLIC_MATERIAL'};
    }
    if (seenMaterialIds.has(match[1])) return {material: spec.key, status: 'DUPLICATE_MATERIAL'};
    seenMaterialIds.add(match[1]);
    try {
      const file = DriveApp.getFileById(match[1]);
      if (file.getMimeType() !== spec.mime) {
        return {material: spec.key, status: 'WRONG_FILE_TYPE'};
      }
      // Both ANYONE and ANYONE_WITH_LINK are unsafe after historical leakage.
      if (file.getSharingAccess() !== DriveApp.Access.PRIVATE) {
        return {material: spec.key, status: 'PUBLIC_LINK_ACCESS'};
      }
      if (buyerEmail !== undefined &&
          file.getAccess(buyerEmail) !== DriveApp.Permission.VIEW) {
        return {material: spec.key, status: 'BUYER_ACCESS_NOT_VIEW_ONLY'};
      }
      return {material: spec.key, status: 'READY'};
    } catch (e) {
      return {material: spec.key, status: 'FILE_UNAVAILABLE'};
    }
  });
  const result = {ready: checks.every(c => c.status === 'READY'), checks};
  console.log('STARTER_MATERIAL_AUDIT ' + JSON.stringify(result));
  return result;
}

/**
 * Inspect ALL local delivery guards, not only payments still returned as
 * eligible by Square. A refunded, canceled or out-of-window payment can leave
 * an unresolved PENDING guard that the payment-list audit would never count.
 * No buyer identifiers, tokens, or guard keys are logged or returned.
 */
function auditStarterDeliveryGuards() {
  const entries = PropertiesService.getScriptProperties().getProperties();
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    throw new Error('Cannot inspect delivery guards.');
  }
  let pendingGuardCount = 0;
  let unrecognizedGuardCount = 0;
  let sentGuardCount = 0;
  Object.keys(entries).forEach(key => {
    if (!/^GO_SENT_[A-Za-z0-9_-]+$/.test(key)) return;
    const state = entries[key];
    if (typeof state !== 'string') {
      unrecognizedGuardCount++;
    } else if (/^PENDING(?:\s|$)/.test(state)) {
      pendingGuardCount++;
    } else if (/^SENT\s+\d{4}-\d\d-\d\dT[^\s]+\s+MSG:[^\s]+$/.test(state)) {
      sentGuardCount++;
    } else {
      unrecognizedGuardCount++;
    }
  });
  return {pendingGuardCount, unrecognizedGuardCount, sentGuardCount};
}

/**
 * Read-only go-live gate. Run after installing ONE dry-run trigger.
 * This NEVER enables sending, changes Square, creates triggers, or sends mail.
 * No tokens, file IDs, email addresses, or order identifiers are returned.
 * A pass is a preflight result, NOT evidence of a live purchase or delivery.
 */
function auditStarterGoLiveReadiness() {
  const blockers = [];
  let status;
  try {
    status = getStarterDeploymentStatus();
  } catch (e) {
    const failed = {ready: false, blockers: ['DEPLOYMENT_STATUS_UNAVAILABLE'],
      checkedAt: new Date().toISOString()};
    console.log('STARTER_GO_LIVE_READINESS ' + JSON.stringify(failed));
    return failed;
  }
  if (!status.authorizedAccount) blockers.push('WRONG_GOOGLE_ACCOUNT');
  if (status.missingPropertyNames.length) blockers.push('MISSING_PROPERTIES');
  if (status.sendEnabled) blockers.push('SEND_ALREADY_ENABLED');
  if (status.triggerCount !== 1) blockers.push('EXPECTED_EXACTLY_ONE_TRIGGER');
  // A read-only materials audit proves only that files are private, not
  // that a future buyer can open them. Unattended fulfillment requires
  // buyer-specific VIEW provisioning; otherwise a real order stalls at send.
  const autoGrant = PropertiesService.getScriptProperties()
    .getProperty('AUTO_GRANT_BUYER_ACCESS') === 'true';
  if (!autoGrant) {
    blockers.push('UNATTENDED_BUYER_ACCESS_NOT_ENABLED');
  } else if (typeof goGrantStarterBuyerAccess_ !== 'function') {
    blockers.push('BUYER_ACCESS_PROVISIONER_MISSING');
  }

  let materialReady = false;
  let paymentsAudited = false;
  let pendingReview = null;
  let pendingGuardCount = null;
  let unrecognizedGuardCount = null;
  // Do not call Square with missing, invalid or unauthorized configuration.
  if (status.authorizedAccount && status.missingPropertyNames.length === 0) {
    let configValid = false;
    try {
      goRequiredConfig_(PropertiesService.getScriptProperties());
      configValid = true;
    } catch (e) {
      blockers.push('INVALID_CONFIGURATION');
    }
    if (configValid) {
      try {
        const guards = auditStarterDeliveryGuards();
        // Never report go-live READY if the guard audit returns malformed
        // counts. Live fulfillment already rejects them; preflight must agree.
        if (!guards ||
            !Number.isSafeInteger(guards.pendingGuardCount) ||
            !Number.isSafeInteger(guards.unrecognizedGuardCount) ||
            guards.pendingGuardCount < 0 || guards.unrecognizedGuardCount < 0) {
          throw new Error('Invalid delivery guard audit counts.');
        }
        pendingGuardCount = guards.pendingGuardCount;
        unrecognizedGuardCount = guards.unrecognizedGuardCount;
        if (pendingGuardCount > 0) blockers.push('UNRESOLVED_DELIVERY_GUARDS');
        if (unrecognizedGuardCount > 0) blockers.push('UNRECOGNIZED_DELIVERY_GUARDS');
      } catch (e) {
        blockers.push('DELIVERY_GUARD_AUDIT_FAILED');
      }
      try {
        const materials = auditStarterMaterialAccess();
        materialReady = !!(materials && materials.ready === true);
        if (!materialReady) blockers.push('BUYER_MATERIALS_NOT_READY');
      } catch (e) {
        blockers.push('BUYER_MATERIAL_AUDIT_FAILED');
      }
      if (materialReady) {
        try {
          const audit = auditStarterFulfillment();
          if (!audit || !Number.isInteger(audit.pendingReview) ||
              audit.pendingReview < 0) {
            blockers.push('INVALID_SQUARE_AUDIT_RESULT');
          } else {
            paymentsAudited = true;
            pendingReview = audit.pendingReview;
            if (pendingReview > 0) blockers.push('PENDING_DELIVERY_REVIEW');
          }
        } catch (e) {
          blockers.push('SQUARE_READ_ONLY_AUDIT_FAILED');
        }
      }
    }
  }
  const result = {
    ready: blockers.length === 0,
    blockers: blockers,
    authorizedAccount: status.authorizedAccount,
    triggerCount: status.triggerCount,
    sendEnabled: status.sendEnabled,
    materialReady: materialReady,
    paymentsAudited: paymentsAudited,
    pendingReview: pendingReview,
    pendingGuardCount: pendingGuardCount,
    unrecognizedGuardCount: unrecognizedGuardCount,
    checkedAt: new Date().toISOString()
  };
  console.log('STARTER_GO_LIVE_READINESS ' + JSON.stringify(result));
  return result;
}

// === END Deployment.gs ===

// === BEGIN BuyerAccess.gs ===
/**
 * Optional, fail-closed buyer-specific access provisioning.
 *
 * This file must be installed alongside Code.gs and Deployment.gs.
 * Disabled unless BOTH SEND_ENABLED and AUTO_GRANT_BUYER_ACCESS are "true".
 * It never changes Square, sends email, or enables fulfillment by itself.
 * Only invoke after a fresh COMPLETED payment AND COMPLETED order have been
 * verified and BOTH delivery guards have been reserved as PENDING.
 */
function goGrantStarterBuyerAccess_(buyerEmail, orderGuardKey, paymentGuardKey) {
  const props = PropertiesService.getScriptProperties();
  if (Session.getEffectiveUser().getEmail().toLowerCase() !== GO_SENDER ||
      props.getProperty('SEND_ENABLED') !== 'true' ||
      props.getProperty('AUTO_GRANT_BUYER_ACCESS') !== 'true') {
    throw new Error('Buyer access provisioning is not enabled for this sender.');
  }
  if (!goBuyerEmailValid_(buyerEmail) ||
      buyerEmail.toLowerCase() === GO_SENDER) {
    throw new Error('Invalid buyer mailbox; no access granted.');
  }

  // Never expose this helper as a standalone "share to any address" action.
  // Both delivery guards must already be PENDING for the freshly verified
  // Square order and payment. A SENT/absent/unknown guard blocks sharing.
  const guardPattern = /^GO_SENT_[A-Za-z0-9_-]{32,}$/;
  if (typeof orderGuardKey !== 'string' ||
      typeof paymentGuardKey !== 'string' ||
      !guardPattern.test(orderGuardKey) ||
      !guardPattern.test(paymentGuardKey) ||
      orderGuardKey === paymentGuardKey ||
      !/^PENDING\s/.test(props.getProperty(orderGuardKey) || '') ||
      !/^PENDING\s/.test(props.getProperty(paymentGuardKey) || '')) {
    throw new Error('Two valid PENDING delivery guards required before sharing.');
  }

  // Validate ALL three files before changing ANY permission. These must be
  // private migration copies, never the historical public-link originals.
  const specs = [
    {key: 'STARTER_GUIDE_URL', type: 'document',
      mime: 'application/vnd.google-apps.document'},
    {key: 'STARTER_PROMPT_URL', type: 'document',
      mime: 'application/vnd.google-apps.document'},
    {key: 'STARTER_SHEET_URL', type: 'spreadsheets',
      mime: 'application/vnd.google-apps.spreadsheet'}
  ];
  const seen = {};
  const targets = specs.map(spec => {
    const url = props.getProperty(spec.key);
    const pattern = new RegExp('^https://docs\\.google\\.com/' +
      spec.type + '/d/([A-Za-z0-9_-]+)(?:/|$)');
    const match = typeof url === 'string' ? url.match(pattern) : null;
    if (!match || seen[match[1]]) {
      throw new Error('Invalid or duplicate buyer material URL; no access granted.');
    }
    // Even a now-private historical file is permanently retired: its URL
    // appeared in public Git history and cannot serve as paid buyer material.
    if (goStarterRetiredMaterialIds_().includes(match[1])) {
      throw new Error('Retired public buyer material ID; no access granted.');
    }
    seen[match[1]] = true;
    const file = DriveApp.getFileById(match[1]);
    if (file.getMimeType() !== spec.mime ||
        file.getSharingAccess() !== DriveApp.Access.PRIVATE) {
      throw new Error('Buyer material is not a private expected file; no access granted.');
    }
    const access = file.getAccess(buyerEmail);
    // Never silently downgrade an editor, commenter, or owner.
    if (access !== DriveApp.Permission.NONE &&
        access !== DriveApp.Permission.VIEW) {
      throw new Error('Unexpected buyer permission; no access granted.');
    }
    return {file, access};
  });

  let grantedCount = 0;
  for (const target of targets) {
    if (target.access === DriveApp.Permission.VIEW) continue;
    // Pause requests must stop permission changes as well as Gmail.
    if (props.getProperty('SEND_ENABLED') !== 'true' ||
        props.getProperty('AUTO_GRANT_BUYER_ACCESS') !== 'true') {
      throw new Error('Buyer access provisioning paused; PENDING remains.');
    }
    target.file.addViewer(buyerEmail);
    if (target.file.getAccess(buyerEmail) !== DriveApp.Permission.VIEW ||
        target.file.getSharingAccess() !== DriveApp.Access.PRIVATE) {
      throw new Error('Buyer VIEW access not verified; PENDING remains.');
    }
    grantedCount++;
  }
  // Independent read-only verification of all three buyer-only links.
  const audit = auditStarterMaterialAccess(buyerEmail);
  if (!audit || audit.ready !== true) {
    throw new Error('Buyer material access audit failed; PENDING remains.');
  }
  return {ready: true, grantedCount};
}

// === END BuyerAccess.gs ===

/**
 * One-action, non-sending onboarding for a newly created Starter GAS project.
 * Requires the authorized sender; never reads Square or sends mail.
 * Runs offline eligibility checks, configures only the three verified private
 * migration materials, then reports the remaining property names.
 * Does not create triggers, change prices, grant buyer access, or enable sending.
 */
function prepareStarterDryRun() {
  const props = PropertiesService.getScriptProperties();
  const email = Session.getEffectiveUser().getEmail();
  if (typeof email !== 'string' || email.toLowerCase() !== GO_SENDER) {
    throw new Error('Starter setup must run as the authorized sender.');
  }
  if (props.getProperty('SEND_ENABLED') === 'true') {
    throw new Error('Disable SEND_ENABLED before onboarding; no setup performed.');
  }
  testStarterFulfillmentRules();
  const configured = configureStarterPrivateMaterials();
  const access = auditStarterMaterialAccess();
  if (!configured || configured.verified !== true ||
      !access || access.ready !== true) {
    throw new Error('Private materials not verified; sending remains disabled.');
  }
  const status = getStarterDeploymentStatus();
  if (status.sendEnabled || !status.authorizedAccount) {
    throw new Error('Unexpected Starter setup status; no sending allowed.');
  }
  const result = {
    privateMaterialsReady: true,
    senderAuthorized: true,
    sendEnabled: false,
    remainingPropertyNames: status.missingPropertyNames,
    triggerCount: status.triggerCount,
    squareAudited: false,
    buyerMailSent: false
  };
  console.log('STARTER_DRY_RUN_PREPARED ' + JSON.stringify(result));
  return result;
}

/**
 * Optional one-click Square ID discovery, after storing ONLY the production
 * access token in Script Properties. Uses GET /locations and GET /catalog/list;
 * never changes Square data, creates a charge, grants Drive access or emails.
 * Requires MERCHANT_PROFILE_READ and ITEMS_READ in addition to fulfillment's
 * PAYMENTS_READ / ORDERS_READ. Ambiguity always blocks configuration.
 * Existing nonmatching IDs are never overwritten.
 */
function configureStarterSquareIdsReadOnly() {
  const props = PropertiesService.getScriptProperties();
  const sender = Session.getEffectiveUser().getEmail();
  if (typeof sender !== 'string' || sender.toLowerCase() !== GO_SENDER ||
      props.getProperty('SEND_ENABLED') === 'true') {
    throw new Error('Square ID discovery requires the authorized sender and SEND_ENABLED=false.');
  }
  const token = props.getProperty('SQUARE_ACCESS_TOKEN');
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('Set SQUARE_ACCESS_TOKEN privately before Square ID discovery.');
  }
  const config = {token};
  const locationResponse = goSquareGet_('locations', config);
  if (!locationResponse || Array.isArray(locationResponse) ||
      !Array.isArray(locationResponse.locations) ||
      (locationResponse.errors !== undefined &&
       (!Array.isArray(locationResponse.errors) || locationResponse.errors.length))) {
    throw new Error('Invalid Square locations response; no IDs configured.');
  }
  const activeJPY = locationResponse.locations.filter(loc =>
    loc && typeof loc.id === 'string' && loc.id.length > 0 &&
    loc.status === 'ACTIVE' && loc.currency === 'JPY');
  if (activeJPY.length !== 1) {
    throw new Error('Square requires exactly one active JPY location for automatic setup; configure IDs manually.');
  }
  const locationId = activeJPY[0].id;
  const presentAtLocation = obj =>
    obj && (obj.present_at_all_locations === true ||
      (Array.isArray(obj.present_at_location_ids) &&
       obj.present_at_location_ids.includes(locationId)));
  const candidates = new Set();
  let cursor = '';
  const cursors = new Set();
  let complete = false;
  for (let page = 0; page < 10; page++) {
    if (cursor) {
      if (cursors.has(cursor)) throw new Error('Repeated catalog cursor; no IDs configured.');
      cursors.add(cursor);
    }
    const endpoint = 'catalog/list?types=ITEM' +
      (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
    const result = goSquareGet_(endpoint, config);
    if (!result || typeof result !== 'object' || Array.isArray(result) ||
        (result.objects !== undefined && !Array.isArray(result.objects)) ||
        (result.cursor !== undefined && typeof result.cursor !== 'string') ||
        (result.errors !== undefined &&
         (!Array.isArray(result.errors) || result.errors.length))) {
      throw new Error('Invalid Square catalog response; no IDs configured.');
    }
    for (const item of (result.objects || [])) {
      if (!item || item.type !== 'ITEM' || item.is_deleted === true ||
          !item.item_data || typeof item.item_data.name !== 'string' ||
          !/starter/i.test(item.item_data.name) || !presentAtLocation(item) ||
          !Array.isArray(item.item_data.variations)) continue;
      for (const variation of item.item_data.variations) {
        if (!variation || variation.type !== 'ITEM_VARIATION' ||
            variation.is_deleted === true || !presentAtLocation(variation) ||
            typeof variation.id !== 'string' || !variation.id ||
            !variation.item_variation_data ||
            (variation.item_variation_data.pricing_type !== undefined &&
             variation.item_variation_data.pricing_type !== 'FIXED_PRICING') ||
            !goMoneyEquals_(variation.item_variation_data.price_money, GO_PRICE_JPY)) continue;
        candidates.add(variation.id);
      }
    }
    cursor = result.cursor || '';
    if (!cursor) {complete = true; break;}
  }
  if (!complete) throw new Error('Catalog pagination exceeded 10 pages; no IDs configured.');
  if (candidates.size !== 1) {
    throw new Error('Starter 9800 JPY catalog variation is absent or ambiguous; configure IDs manually.');
  }
  const catalogId = [...candidates][0];
  const currentLocation = props.getProperty('SQUARE_LOCATION_ID');
  const currentCatalog = props.getProperty('STARTER_CATALOG_OBJECT_ID');
  if ((currentLocation && currentLocation !== locationId) ||
      (currentCatalog && currentCatalog !== catalogId)) {
    throw new Error('Existing Square IDs conflict with read-only discovery; no overwrite.');
  }
  if (props.getProperty('SEND_ENABLED') === 'true') {
    throw new Error('Fulfillment enabled during discovery; no IDs configured.');
  }
  props.setProperties({
    SQUARE_LOCATION_ID: locationId,
    STARTER_CATALOG_OBJECT_ID: catalogId
  });
  const result = {
    squareLocationConfigured: true,
    starterCatalogVariationConfigured: true,
    candidateVariations: candidates.size,
    sendEnabled: false,
    squarePaymentsAudited: false,
    buyerMailSent: false
  };
  console.log('STARTER_SQUARE_IDS_CONFIGURED ' + JSON.stringify(result));
  return result;
}

