// Deterministic unit tests with fake GAS services. No customer data or email sends.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('ops/starter-fulfillment.gs','utf8');
function row(id,amount=9800,payment='確認済み',access='閲覧可',delivery='未納品',email='buyer@example.invalid',audit=''){
 const r=Array(23).fill('');r[0]=id;r[2]=email;r[3]=amount;r[4]=payment;r[5]=access;r[6]=delivery;r[9]=audit;return r;
}
function run(input,mode='preview',failAudit=false){
 const rows=[Array(23).fill(''),...input.map(r=>r.slice())],drafts=[],deleted=[],audit=[],logs=[];
 const sh={getDataRange:()=>({getValues:()=>rows}),getRange:(r,c)=>({setValue:v=>{if(failAudit)throw Error('sheet unavailable');audit.push([r,c,v]);rows[r-1][c-1]=v;}})};
 const lock={tryLock:()=>true,releaseLock:()=>{}};
 const context={SpreadsheetApp:{openById:()=>({getSheetByName:()=>sh})},LockService:{getScriptLock:()=>lock},GmailApp:{createDraft:(to,subject,body)=>{const id='fake-draft-'+drafts.length;drafts.push({to,subject,body});return{getId:()=>id,deleteDraft:()=>deleted.push(id)};}},Logger:{log:x=>logs.push(x)},Map};
 vm.createContext(context);vm.runInContext(source,context);
 let out,err;
 try{out=context[mode==='preview'?'starterFulfillmentPreview':'starterFulfillmentCreateVerifiedDrafts']()}catch(e){err=e}
 return{out,err,drafts,deleted,audit};
}
{
 const v=run([row('ok'),row('dup'),row('dup'),row('wrong',9700),row('pending',9800,'未確認'),row('access',9800,'確認済み','未確認'),row('done',9800,'確認済み','閲覧可','納品済'),row('audit',9800,'確認済み','閲覧可','未納品','buyer@example.invalid','納品下書き作成：existing')]);
 assert.equal(v.out.filter(x=>x.status==='READY_DRY_RUN').length,1);
 assert.equal(v.out.filter(x=>x.status==='HOLD').length,7);
 assert.equal(v.drafts.length,0);
}
{
 const v=run([row('unique')],'draft');
 assert.equal(v.drafts.length,1);assert.equal(v.audit.length,1);
 const w=run([row('unique',9800,'確認済み','閲覧可','未納品','buyer@example.invalid',v.audit[0][2])],'draft');
 assert.equal(w.drafts.length,0);
}
{
 const v=run([row('unique')],'draft',true);
 assert(v.err);assert.equal(v.drafts.length,1);assert.equal(v.deleted.length,1);
}
console.log('PASS: preview holds 7 unsafe orders, generates one safe draft, prevents duplicate drafts, rolls back audit failure');
