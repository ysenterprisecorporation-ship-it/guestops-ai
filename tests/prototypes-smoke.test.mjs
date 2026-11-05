// No dependency: run browser-facing prototypes in a simulated DOM and assert scenario outputs.
// This is a DOM smoke test, not a real Chromium end-to-end test.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

function harness(file){
  const html=fs.readFileSync(file,'utf8');
  assert.match(html,/<\/html>/i);
  const script=html.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
  assert.ok(script, file+' must contain inline JS');
  const elements=new Map();
  const create=(tag='div')=>({
    tagName:tag, value:'',textContent:'',disabled:false,children:[],
    dataset:{},style:{},className:'',onclick:null, onchange:null,
    addEventListener(event,fn){this['on'+event]=fn},
    appendChild(child){this.children.push(child)},
    replaceChildren(...items){this.children=[...items]},
    click(){this.clicked=true},
  });
  const doc={
    getElementById(id){if(!elements.has(id))elements.set(id,create());return elements.get(id)},
    querySelectorAll(q){return q==='[data-case]'?['late','clean','review','normal'].map(k=>{const a=create('button');a.dataset.case=k;return a}):[]},
    createElement:create
  };
  const clicks=[],urls=[];
  const env={
    document:doc,console,JSON,Number,String,Set,Object,Error,Blob,
    navigator:{clipboard:{writeText:async text=>{clicks.push(text)}}},
    URL:{createObjectURL:(blob)=>{urls.push(blob);return 'blob:test'},revokeObjectURL:()=>{}},
    setTimeout:(f)=>f()
  };
  vm.runInNewContext(script,env,{timeout:1000,filename:file});
  return {doc,els:elements,get:id=>doc.getElementById(id),urls,clicks};
}

{
  const h=harness('docs/beds24-partner-demo/index.html');
  const event=h.get('event');
  assert.match(h.get('result').textContent || h.get('result').children.map(x=>x.textContent).join(' '),/高優先度|本人確認|未完了/);
  const analyze=h.get('analyze').onclick;
  assert.equal(typeof analyze,'function');
  for(const [kind,term] of [['late','高優先度'],['clean','清掃'],['review','低評価'],['normal','通常']]){
    const payload={late:{bookingId:'B1',propertyId:'P1',event:'checkin_due',identityVerified:false,contactReachable:false,cleaningConflict:false},
    clean:{bookingId:'B2',propertyId:'P1',event:'booking_changed',identityVerified:true,contactReachable:true,cleaningConflict:true},
    review:{bookingId:'B3',propertyId:'P1',event:'review_received',rating:2,identityVerified:true,contactReachable:true,cleaningConflict:false},
    normal:{bookingId:'B4',propertyId:'P1',event:'booking_created',identityVerified:true,contactReachable:true,cleaningConflict:false}}[kind];
    event.value=JSON.stringify(payload);analyze();
    const status=h.get('result').children.map(x=>x.textContent).join(' ');
    assert.ok(status.includes(term),kind+' '+status);
    assert.match(h.get('audit').textContent,/"externalActionsExecuted": 0/);
    assert.ok(h.get('message').textContent.length>15);
  }
  event.value='{"bad":1}';analyze();
  assert.match(h.get('inputError').textContent,/入力エラー/);
}
{
  const h=harness('docs/guestops-independent/index.html');
  h.get('sample').onclick();
  assert.match(h.get('summary').textContent,/対象4予約/);
  assert.equal(h.get('export').disabled,false);
  const rows=h.get('report').children[0].children[1].children;
  assert.equal(rows.length,4);
  assert.equal(rows[0].children[0].textContent,'緊急');
  h.get('export').onclick();
  assert.equal(h.urls.length,1);
  const csv=await h.urls[0].text();
  assert.match(csv,/bookingId/);
  assert.match(csv,/DEMO-101/);
  assert.match(csv,/DEMO-104/);
  assert.match(csv,/緊急/);
  // Quoted values, duplicate bookings and malformed CSV handling.
  h.get('csv').value='bookingId,propertyId,event,checkin,identityVerified,contactReachable,cleaningConflict,rating\n"B,01",P1,checkin_due,2026-11-05,false,true,false,\n"B,01",P1,checkin_due,2026-11-05,false,true,false,';
  h.get('run').onclick();
  assert.match(h.get('summary').textContent,/対象1予約/);
  h.get('csv').value='a,b\n"unterminated';
  h.get('run').onclick();
  assert.match(h.get('error').textContent,/検査エラー/);
  assert.equal(h.get('export').disabled,true);
}
console.log('PASS: interactive decision demo four scenarios, invalid JSON, CSV import, priority, dedup, CSV export, invalid quoting');
