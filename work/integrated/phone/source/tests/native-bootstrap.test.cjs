const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),{harness,db}=require('./event-fixture.cjs');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(root+'/web/'+f,'utf8');
function browser({native=true,entries={},failRead=false,slot=null}={}){
 const dom=new JSDOM(fs.readFileSync(root+'/android/app/src/main/assets/index.html','utf8'),{url:'https://appassets.androidplatform.net/offline/index.html'+(slot?'?slot='+slot:''),runScripts:'outside-only'}),w=dom.window,loaded=[],rpc=[];
 w.TextEncoder=TextEncoder;if(native)w.CatOfflineNative={};
 w.eval(fs.readFileSync(root+'/android/app/src/main/assets/game-01.js','utf8'));
 const beforeInsert=w.Element.prototype.after;
 w.Element.prototype.after=function(script){if(script.tagName==='SCRIPT'){
  if(native){assert.equal(w.CatOfflineDurable.available,true);for(const k of [db.GAME,db.SOCIAL,db.KEY,db.JOURNAL,db.IDENTITY])if(entries[k]!==undefined)assert.equal(w.localStorage.getItem(k),entries[k],'authority precedes '+script.src);assert.equal(typeof w.CatOfflineDurable.checkpointJournal,'function');}
  loaded.push(script.src.split('/').at(-1));queueMicrotask(()=>script.onload());
 }else beforeInsert.call(this,script);};
 const prepare=()=>{w.eval(read('offline-event-store.js'));w.eval(read('offline-durable-store.js'));};
 const port={start(){},postMessage(raw){const r=JSON.parse(raw);rpc.push(r);queueMicrotask(()=>port.onmessage({data:JSON.stringify(failRead?{requestId:r.requestId,ok:false,error:{message:'fixture unreadable authority'}}:{requestId:r.requestId,ok:true,result:{schema:1,revision:3,foreground:true,entries}})}));}};
 return {w,loaded,rpc,prepare,async boot(){const pending=w.CatOfflineDurable.boot();if(native){assert.equal(w.CatOfflineDurable.preparePort('cat-durable-port:fixture'),true);w.dispatchEvent(new w.MessageEvent('message',{data:'cat-durable-port:fixture',ports:[port]}));}await pending;},close:()=>dom.window.close()};
}
test('deferred original/Host/adapter scripts wait for Native authoritative result+owner+pending recovery, even when local social was corrupt',async()=>{
 const h=harness();h.q.push(h.gift());await h.consumer.consume(()=>true);const entries=structuredClone(h.io.nativeAuthority.entries);
 entries[db.JOURNAL]=JSON.stringify({schema:1,clientId:'durable-owner',devices:{}});
 const b=browser({entries});try{
  b.w.localStorage.setItem(db.SOCIAL,'{partial');b.prepare();assert.ok(b.w.CatOfflineEventStorageError);assert.equal(typeof b.w.CatOfflineDurable.checkpointJournal,'undefined');assert.equal(b.loaded.length,0);
  let ready=0;b.w.addEventListener('cat-offline-durable-ready',()=>ready++);await b.boot();assert.equal(ready,1);assert.equal(b.w.CatOfflineEventStorageError,undefined);assert.equal(b.loaded[0],'game-02.js');assert.equal(b.loaded.at(-1),'cflocal2-adapter.js');assert.equal(b.loaded.length,21);assert.ok(b.loaded.includes('offline-nav-icons.js')&&b.loaded.includes('offline-encounter-ui.js')&&b.loaded.includes('offline-page-icons.js'));assert.equal(b.w.document.getElementById('offline-boot-status'),null);
  assert.equal(b.rpc[0].op,'read');assert.equal(b.w.CatOfflineEventLedger.snapshot().records[h.gift().eventId].status,'applied');
 }finally{b.close();}
});
test('Native recovery failure leaves original scripts inert and never publishes adapter checkpoint callback',async()=>{
 const b=browser({failRead:true});try{b.prepare();await b.boot();assert.equal(b.loaded.length,0);assert.equal(typeof b.w.CatOfflineDurable.checkpointJournal,'undefined');assert.match(b.w.document.getElementById('offline-boot-status').textContent,/unreadable authority/);}finally{b.close();}
});
test('ordinary browser retains gameplay but cannot supply Native checkpoint or device ACK fallback',async()=>{
 const b=browser({native:false});try{b.prepare();await b.boot();assert.equal(b.loaded.length,21);assert.ok(b.loaded.includes('offline-nav-icons.js')&&b.loaded.includes('offline-encounter-ui.js')&&b.loaded.includes('offline-page-icons.js'));assert.equal(b.w.CatOfflineDurable.available,false);assert.equal(typeof b.w.CatOfflineDurable.checkpointJournal,'undefined');assert.throws(()=>b.w.CatOfflineDurable.assertHealthy(),/不可用/);}finally{b.close();}
});
test('Native A-slot recovery does not alter original B-slot save or expose raw cross-slot keys',async()=>{
 const h=harness();h.q.push(h.care());await h.consumer.consume(()=>true);const entries=h.io.nativeAuthority.entries,b=browser({entries,slot:'A'});try{
  b.w.localStorage.setItem('slot:B:'+db.GAME,'B untouched');b.prepare();await b.boot();assert.equal(b.w.localStorage.getItem('slot:B:'+db.GAME),'B untouched');assert.equal(b.w.localStorage.getItem(db.GAME),entries[db.GAME]);
 }finally{b.close();}
});
