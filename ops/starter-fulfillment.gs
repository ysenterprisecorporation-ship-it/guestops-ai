/**
 * GuestOps Starter Kit fulfillment — Google Apps Script source (not deployed).
 * Bound spreadsheet: 1bHujnqRCmRwaHBs8AAoX_RLEzjIsHhtQpr7kWESAw4U
 * NO Square authentication: human/authorized sync must confirm payment in column E.
 * Trigger only manually after verifying Square receipt; never install a time trigger until approved.
 * This script CREATES DRAFTS; it does NOT send customer emails.
 */
const STARTER_SHEET_ID='1bHujnqRCmRwaHBs8AAoX_RLEzjIsHhtQpr7kWESAw4U';
const STARTER_TAB='注文・納品マスター';
const STARTER_PRICE=9800;
const STARTER_DOCS=[
  ['利用ガイド','https://docs.google.com/document/d/1MjTNyh8hjvJW5Eg2wsaRPgfMQ1nWazbs_qazdkSNNjQ/edit'],
  ['施設専用マスタープロンプト','https://docs.google.com/document/d/1SHotxS2tvQuxHSGRS4SJMqUNhKSe-W_tukvEbuZ7xuQ/edit'],
  ['施設設定・判断ワークシート','https://docs.google.com/spreadsheets/d/1X5qCRw7wOjsusOUVopX2_735z0r-WMwUDC2-Hp7Zb8c/edit']
];
function starterFulfillmentPreview(){
  return starterFulfillment_(true);
}
function starterFulfillmentCreateVerifiedDrafts(){
  // Requires authenticated account and verified customer access to all docs.
  return starterFulfillment_(false);
}
function starterFulfillment_(dryRun){
  const lock=LockService.getScriptLock();
  if(!dryRun&&!lock.tryLock(30000))throw Error('Fulfillment already running');
  try {
  const sh=SpreadsheetApp.openById(STARTER_SHEET_ID).getSheetByName(STARTER_TAB);
  if(!sh)throw Error('Order sheet not found');
  const rows=sh.getDataRange().getValues();
  const orders=new Map();
  rows.slice(1).forEach(r=>{const k=String(r[0]||'').trim();if(k)orders.set(k,(orders.get(k)||0)+1)});
  const results=[];
  for(let index=1;index<rows.length;index++){
    const row=rows[index],order=String(row[0]||'').trim(),email=String(row[2]||'').trim();
    if(!order)continue;
    const reasons=[];
    if((orders.get(order)||0)!==1)reasons.push('duplicate order');
    if(Number(row[3])!==STARTER_PRICE)reasons.push('wrong amount');
    if(row[4]!=='確認済み')reasons.push('payment not confirmed');
    if(row[5]!=='閲覧可')reasons.push('customer document access unverified');
    if(row[6]==='納品済'||row[8]||String(row[9]||'').includes('納品下書き作成：'))reasons.push('already delivered, message ID recorded, or draft created');
    if(String(row[9]||'').includes('送信済'))reasons.push('existing fulfillment audit indicates sent');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))reasons.push('invalid customer email');
    if(reasons.length){results.push({order,status:'HOLD',reasons});continue}
    if(dryRun){results.push({order,status:'READY_DRY_RUN'});continue}
    const subject='【GuestOps Starter Kit】教材受取のご案内';
    const body='このたびはGuestOps Starter Kitをご購入いただきありがとうございます。\n\n'+
      '下記の教材をご利用ください。\n'+STARTER_DOCS.map(a=>'・'+a[0]+'：'+a[1]).join('\n')+
      '\n\n※共有権限に問題がある場合は、このメールに返信してご連絡ください。\n'+
      'ワイズエンタープライズコーポレーション\n民泊AI実務キット運営窓口';
    // GmailApp.sendEmail has no guaranteed message-id return. Do not write fabricated send IDs.
    // Create a draft for manual final sending until a verified send-ID audit flow exists.
    const draft=GmailApp.createDraft(email,subject,body);
    try {
      sh.getRange(index+1,10).setValue('納品下書き作成：'+draft.getId());
    } catch(err) {
      // Avoid leaving an untracked draft after an audit-write failure.
      try {draft.deleteDraft()} catch(cleanupErr) {Logger.log('DRAFT_CLEANUP_FAILED: '+draft.getId()+' '+cleanupErr)}
      throw Error('Audit write failed for order '+order+': '+err);
    }
    results.push({order,status:'DRAFT_CREATED',draftId:draft.getId()});
  }
  Logger.log(JSON.stringify(results));
  return results;
  } finally {if(!dryRun)lock.releaseLock()}
}
