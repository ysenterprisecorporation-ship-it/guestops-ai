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
  if (Session.getEffectiveUser().getEmail().toLowerCase() !== GO_SENDER) {
    throw new Error('Wrong Google account: run only as ' + GO_SENDER);
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
  const atom = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+$/;
  if (!local.split('.').every(part => part && atom.test(part))) return false;
  if (domain.length > 253 || !domain.includes('.')) return false;
  return domain.split('.').every(label =>
    label.length >= 1 && label.length <= 63 &&
    /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label));
}

function goPaymentEligible_(p, config) {
  return !!(p && p.id && p.status === 'COMPLETED' &&
    p.location_id === config.location && p.order_id &&
    p.amount_money && p.amount_money.currency === 'JPY' &&
    Number(p.amount_money.amount) === GO_PRICE_JPY &&
    (p.refund_ids === undefined || (Array.isArray(p.refund_ids) && p.refund_ids.length === 0)) &&
    (p.refunded_money === undefined ||
      (p.refunded_money && p.refunded_money.currency === 'JPY' &&
       Number.isFinite(Number(p.refunded_money.amount)) &&
       Number(p.refunded_money.amount) === 0)) &&
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
      !order.total_money || order.total_money.currency !== 'JPY' ||
      Number(order.total_money.amount) !== GO_PRICE_JPY ||
      // A completed payment alone is insufficient if the order has been
      // refunded or returned through another tender or a later operation.
      // Missing arrays are normal; malformed/nonempty arrays fail closed.
      (order.refunds !== undefined &&
        (!Array.isArray(order.refunds) || order.refunds.length > 0)) ||
      (order.returns !== undefined &&
        (!Array.isArray(order.returns) || order.returns.length > 0)) ||
      !Array.isArray(order.line_items) || order.line_items.length !== 1) return false;
  const item = order.line_items[0];
  return item.catalog_object_id === config.catalogId &&
    String(item.quantity) === '1';
}

function goDeliveryBody_(payment, config) {
  return [
    'GuestOps Starter Kitのお申し込みありがとうございます。',
    'Squareでの決済完了を確認しました。以下が購入者用教材です。',
    '',
    '1. 利用ガイド: ' + config.guide,
    '2. 施設専用マスタープロンプト: ' + config.prompt,
    '3. 施設情報設定・20場面判断・初回テスト: ' + config.sheet,
    '',
    'まず利用ガイドの「購入直後の動作確認」をお試しください。',
    '実際のゲスト情報は匿名化し、AIの返信案は送信前に確認してください。',
    'Starterは手動運用用です。PMS連携・予約サイト自動送信は含まれません。',
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
        // A private, deleted or editable file must never be advertised as a
        // working buyer-only delivery. The audit is read-only and fail-closed.
        const materialAudit = auditStarterMaterialAccess();
        if (!materialAudit || materialAudit.ready !== true) {
          throw new Error('Buyer material access failed; no delivery attempted.');
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
          const sentMessage = GmailApp.createDraft(payment.buyer_email_address, subject,
            goDeliveryBody_(payment, config), {
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
    amount_money:{amount:9800,currency:'JPY'},buyer_email_address:'buyer@example.com',
    created_at:'2026-10-30T00:00:00Z'};
  const o = {id:'O1',state:'COMPLETED',location_id:'L1',total_money:{amount:9800,currency:'JPY'},
    line_items:[{catalog_object_id:'VAR1',quantity:'1'}]};
  function check(x, label) {if (!x) throw new Error('FAILED: ' + label);}
  check(goPaymentEligible_(p,c), 'paid valid payment');
  check(goOrderEligible_(o,p,c), 'correct product');
  check(!goPaymentEligible_(Object.assign({},p,{status:'APPROVED'}),c), 'unsettled');
  check(!goPaymentEligible_(Object.assign({},p,{amount_money:{amount:980,currency:'JPY'}}),c), 'amount');
  check(!goPaymentEligible_(Object.assign({},p,{refund_ids:['R1']}),c), 'refund');
  check(!goPaymentEligible_(Object.assign({},p,{refund_ids:{length:0}}),c), 'malformed refund IDs');
  check(!goPaymentEligible_(Object.assign({},p,{refunded_money:{amount:'invalid',currency:'JPY'}}),c), 'malformed refunded amount');
  check(!goPaymentEligible_(Object.assign({},p,{refunded_money:{amount:0,currency:'USD'}}),c), 'refunded currency mismatch');
  check(!goPaymentEligible_(Object.assign({},p,{buyer_email_address:''}),c), 'missing email');
  check(goBuyerEmailValid_('buyer+tag@example.com'), 'single valid tagged mailbox');
  check(!goBuyerEmailValid_('buyer@example.com,other@example.com'), 'recipient list blocked');
  check(!goBuyerEmailValid_('Buyer <buyer@example.com>'), 'display-name syntax blocked');
  check(!goBuyerEmailValid_('buyer@example.com;other'), 'semicolon delimiter blocked');
  check(!goBuyerEmailValid_('buyer..double@example.com'), 'invalid dot atom blocked');
  check(!goBuyerEmailValid_('buyer@example..com'), 'invalid domain blocked');
  check(!goPaymentEligible_(Object.assign({},p,{buyer_email_address:'buyer@example.com,other'}),c), 'malformed recipient rejected');

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
