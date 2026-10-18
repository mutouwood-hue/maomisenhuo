const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');const {harness,db}=require('./event-fixture.cjs');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(root+'/original/game.html','utf8');
const shim=html.match(/<script id="slot-shim">([\s\S]*?)<\/script>/)[1];
const script=fs.readFileSync(root+'/web/offline-event-store.js','utf8');
function page(entries,slot='A'){
 const dom=new JSDOM('<body></body>',{url:'https://appassets.androidplatform.net/offline/index.html?slot='+slot,runScripts:'outside-only'}),w=dom.window;
 const rawGet=w.Storage.prototype.getItem;
 for(const[k,v]of entries)w.localStorage.setItem(k,v);
 w.eval(shim);w.eval(script);return {w,dom,raw:k=>rawGet.call(w.localStorage,k)};
}
test('production pre-head recovery completes A before original scripts and leaves B byte-identical',async()=>{
 const h=harness({walFault:p=>{if(p==='image:0')throw Error('crash');}});h.q.push(h.care());await assert.rejects(h.consumer.consume(()=>true));
 const other=harness(),entries=[...[...h.io.values].map(([k,v])=>['slot:A:'+k,v]),...[...other.io.values].map(([k,v])=>['slot:B:'+k,v])];
 const p=page(entries);try{
  assert.equal(p.w.CatOfflineEventStorageError,undefined);assert.equal(JSON.parse(p.w.localStorage.getItem(db.GAME)).cats[0].counts.pet,1);
  assert.equal(JSON.parse(p.w.localStorage.getItem(db.SOCIAL)).dex.deviceReceipts.length,1);assert.equal(p.w.CatOfflineEventLedger.snapshot().pending,null);
  for(const[k,v]of other.io.values)assert.equal(p.raw('slot:B:'+k),v);
  assert.equal(p.raw(db.GAME),null,'never write an unscoped replacement');
 }finally{p.dom.window.close();}
 const built=fs.readFileSync(root+'/android/app/src/main/assets/index.html','utf8');assert.ok(built.indexOf('src="game-01.js"')<built.indexOf('src="offline-event-store.js"'));assert.ok(built.indexOf('src="offline-event-store.js"')<built.indexOf('src="game-03.js"'));
});
test('corrupt ledger or foreign recovery image blocks original Storage writes without replacing the source bytes',async()=>{
 for(const conflict of [false,true]){
  const h=harness({walFault:p=>{if(p==='prepared')throw Error('crash');}});h.q.push(h.care());await assert.rejects(h.consumer.consume(()=>true));
  if(conflict)h.io.values.set(db.SOCIAL,'foreign');else h.io.values.set(db.KEY,'{broken');
  const p=page([...h.io.values].map(([k,v])=>['slot:A:'+k,v]));try{
   assert.ok(p.w.CatOfflineEventStorageError);const before=p.w.localStorage.getItem(db.GAME);
   assert.throws(()=>p.w.localStorage.setItem(db.GAME,'overwrite'));assert.throws(()=>p.w.localStorage.removeItem(db.SOCIAL));assert.equal(p.w.localStorage.getItem(db.GAME),before);
   assert.equal(p.w.localStorage.getItem(db.KEY),h.io.getItem(db.KEY));
  }finally{p.dom.window.close();}
 }
});
test('normal original social wipe preserves event dedup, and another page ledger update stops a stale writer',async()=>{
 const h=harness();h.q.push(h.care());await h.consumer.consume(()=>true);const p=page([...h.io.values].map(([k,v])=>['slot:A:'+k,v]));try{
  const original=p.w.localStorage.getItem(db.KEY);p.w.localStorage.removeItem(db.SOCIAL);assert.equal(p.w.localStorage.getItem(db.KEY),original);
  p.w.localStorage.setItem(db.KEY,original+' ');assert.throws(()=>p.w.localStorage.setItem(db.GAME,'overwrite'),/另一页面/);
 }finally{p.dom.window.close();}
});
test('initial corrupt social JSON is preserved before the original silent default saver can overwrite it',()=>{
 const p=page([['slot:A:'+db.SOCIAL,'{broken-social']]);try{
  assert.ok(p.w.CatOfflineEventStorageError);assert.throws(()=>p.w.localStorage.setItem(db.SOCIAL,'{}'));assert.equal(p.w.localStorage.getItem(db.SOCIAL),'{broken-social');
 }finally{p.dom.window.close();}
});
