const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),readline=require('node:readline');
const model=require('../web/offline-event-store.js'),durability=require('../web/offline-durable-store.js');
const root=path.resolve(__dirname,'..'),workspace=(()=>{let p=root;while(!fs.existsSync(p+'/.tools')){const next=path.dirname(p);if(next===p)throw Error('workspace tools not found');p=next;}return p;})(),java=workspace+'/.tools/java/jdk-21.0.12.1+1/Contents/Home/bin/',json=workspace+'/.tools/downloads/json-20240303.jar',out=root+'/.build/native-durable-jvm';
fs.mkdirSync(out,{recursive:true});
const stubs=fs.readdirSync(__dirname+'/native-durable',{recursive:true}).filter(x=>x.endsWith('.java')).map(x=>__dirname+'/native-durable/'+x);
cp.execFileSync(java+'javac',['--release','17','-cp',json,'-d',out,...stubs,root+'/android/app/src/main/java/com/catforest/htmlcandidate/EventDurableBridge.java']);
function server({dir=fs.mkdtempSync(root+'/.build/durable-case-'),slot=''}={}){
 const process=cp.spawn(java+'java',['-cp',out+':'+json,'DurableRpcHarness',dir,slot]),waiting=[];
 const lines=readline.createInterface({input:process.stdout});lines.on('line',line=>{const p=waiting.shift();try{const r=JSON.parse(line);r.ok?p.resolve(r.result):p.reject(Error(r.error));}catch(e){p.reject(e);}});
 process.on('exit',code=>{for(const p of waiting.splice(0))p.reject(Error('fixture JVM exit '+code));});
 return {dir,rpc:(op,args={})=>new Promise((resolve,reject)=>{waiting.push({resolve,reject});process.stdin.write(JSON.stringify({op,...args})+'\n');}),close:()=>new Promise(resolve=>{process.once('exit',resolve);process.stdin.end();})};
}
function memory(){const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};}
const key=model.JOURNAL;
test('production Java CAS+SHA/UTF8, exact idempotent commits, strict types and bounds (JVM Android stand-ins)',async()=>{
 const s=server();try{
  assert.equal((await s.rpc('read')).revision,0);
  const first=await s.rpc('commit',{expectedRevision:0,updates:{[key]:'猫咪🌼'}});assert.equal(first.revision,1);assert.equal(first.hashes[key],model.sha256('猫咪🌼'));
  await assert.rejects(s.rpc('commit',{expectedRevision:0,updates:{[key]:'猫咪🌼'}}),/revision conflict/);assert.equal((await s.rpc('commit',{expectedRevision:1,updates:{[key]:'猫咪🌼'}})).revision,1);
  await assert.rejects(s.rpc('commit',{expectedRevision:0,updates:{[key]:'different'}}),/revision conflict/);
  for(const expectedRevision of ['1',1.5,-1,2**53])await assert.rejects(s.rpc('commit',{expectedRevision,updates:{[key]:'different'}}));
  await assert.rejects(s.rpc('commit',{expectedRevision:1,updates:{foreign:'bad'}}));await assert.rejects(s.rpc('commit',{expectedRevision:1,updates:{[key]:4}}));
  await assert.rejects(s.rpc('commit',{expectedRevision:1,updates:{[key]:'猫'.repeat(1_400_000)}}));assert.equal((await s.rpc('read')).entries[key],'猫咪🌼');
 }finally{await s.close();}
});
for(const point of ['beforeRename','afterRename','directory'])test('production Java '+point+' failure has no certificate; same JS client re-syncs exact decision',async()=>{
 const s=server(),io=memory();let fail=true;try{
  const client=durability.createClient({storage:io,rpc:(op,args)=>s.rpc(op,op==='commit'&&fail?(fail=false,{...args,...(point==='directory'?{fixtureDirectoryFailure:true}:{fixtureFailure:point})}):args)});
  await client.initialize();const r=await client.checkpointJournal('original-pending-字节');assert.equal(r.persisted,true);assert.equal(r.journalSha256,model.sha256('original-pending-字节'));
  await client.checkpointJournal('post-advanced');assert.equal((await s.rpc('read')).entries[key],'post-advanced');
 }finally{await s.close();}
});
for(const which of ['pre','post'])test('actual production commit reply lost at '+which+' checkpoint recovers same-instance CAS and accepts next command',async()=>{
 const s=server(),io=memory();let commits=0,drops=0;try{
  const client=durability.createClient({storage:io,rpc:async(op,args)=>{const result=await s.rpc(op,args);if(op==='commit'&&++commits===(which==='pre'?1:2)){drops++;throw Error('fixture private port reply lost after Java commit');}return result;}});
  await client.initialize();await client.checkpointJournal('exact pending including client/seq');await client.checkpointJournal('post nextSeq/pending null');await client.checkpointJournal('next exact command');
  assert.equal(drops,1);assert.equal(client.available,true);assert.equal((await s.rpc('read')).entries[key],'next exact command');
 }finally{await s.close();}
});
test('unrelated authority update cannot pass stale CAS; restart restores authoritative journal before any caller',async()=>{
 const s=server(),io=memory();try{
  const client=durability.createClient({storage:io,rpc:s.rpc});await client.initialize();await client.checkpointJournal('old');await s.rpc('commit',{expectedRevision:1,updates:{[model.IDENTITY]:'foreign-owner'}});
  await assert.rejects(client.checkpointJournal('new'),/未确认/);assert.equal(client.available,false);assert.equal((await s.rpc('read')).entries[key],'old');
 }finally{await s.close();}
 const resumed=server({dir:s.dir});try{const io2=memory();io2.setItem(key,'uncheckpointed');const client=durability.createClient({storage:io2,rpc:resumed.rpc});await client.initialize();assert.equal(io2.getItem(key),'old');assert.equal(io2.getItem(model.IDENTITY),'foreign-owner');}finally{await resumed.close();}
});
test('persistent directory fsync failure cannot downgrade to successful readback',async()=>{
 const s=server(),io=memory();try{
  const client=durability.createClient({storage:io,rpc:(op,args)=>s.rpc(op,op==='commit'?{...args,fixtureDirectoryFailure:true}:args)});await client.initialize();await assert.rejects(client.checkpointJournal('pending'),/未确认/);assert.equal(client.available,false);assert.equal((await s.rpc('read')).entries[key],'pending');
 }finally{await s.close();}
});
test('authority corruption/background commits fail closed; A/main have separate files',async()=>{
 const s=server();try{
  await s.rpc('foreground',{value:false});await assert.rejects(s.rpc('commit',{expectedRevision:0,updates:{[key]:'x'}}),/foreground/);await s.rpc('foreground',{value:true});await s.rpc('commit',{expectedRevision:0,updates:{[key]:'main'}});
  const a=server({dir:s.dir,slot:'A'});try{assert.equal((await a.rpc('read')).revision,0);await a.rpc('commit',{expectedRevision:0,updates:{[key]:'A'}});}finally{await a.close();}assert.equal((await s.rpc('read')).entries[key],'main');
  const p=s.dir+'/cflocal2-authority-main.json',data=JSON.parse(fs.readFileSync(p));data.body=data.body.replace('main','evil');fs.writeFileSync(p,JSON.stringify(data));await assert.rejects(s.rpc('read'),/checksum/);
 }finally{await s.close();}
});
test('private port policy restricts main document, origin and slot',async()=>{
 const s=server(),url='https://appassets.androidplatform.net/offline/index.html';try{assert.equal(await s.rpc('trusted',{url}),true);assert.equal(await s.rpc('trusted',{url:url+'?slot=A',slot:'A'}),true);
  for(const u of [url+'#x',url+'?slot=A',url.replace('https:','http:'),url.replace('/index.html','/other.html'),url.replace('.net/','.net:444/'),url.replace('//','//evil@')])assert.equal(await s.rpc('trusted',{url:u}),false);
 }finally{await s.close();}
});
test('lost/partial WebStorage uses complete Native redo; matching markers retain newer phone progress',()=>{
 const io=memory(),token='00000000-0000-4000-8000-000000000001',entries={[model.GAME]:JSON.stringify({version:2,cats:[],__cflocal2Commit:token,coins:30}),[model.SOCIAL]:JSON.stringify({v:1,__cflocal2Commit:token}),[model.KEY]:JSON.stringify({schema:1,records:{},isolated:[],pending:null,commitToken:token}),[durability.MARKER]:token,[key]:'exactNative'};
 durability.recover(entries,io);assert.equal(io.getItem(model.GAME),entries[model.GAME]);io.setItem(model.GAME,JSON.stringify({...JSON.parse(entries[model.GAME]),coins:27}));assert.equal(durability.recover(entries,io).projected,false);assert.equal(JSON.parse(io.getItem(model.GAME)).coins,27);
 io.setItem(model.SOCIAL,'partial');assert.equal(durability.recover(entries,io).projected,true);assert.equal(JSON.parse(io.getItem(model.GAME)).coins,30);assert.equal(io.getItem(key),'exactNative');
});
test('production Java authority + original game rules + event consumer recover an awarded result after all WebStorage bytes are lost',async()=>{
 const f=require('./event-fixture.cjs'),h=f.harness(),s=server(),event=h.care();h.q.push(event);
 try{
  const client=durability.createClient({storage:h.io,rpc:s.rpc});await client.initialize();
  const consumer=f.events.createConsumer({ports:h.ports,ledger:h.ledger,storage:h.io,source:h.source,durable:client,digest:model.sha256,now:()=>f.NOW});
  await consumer.consume(()=>true);assert.equal(h.store.getState().counts.pet,1);assert.equal(h.acks.length,1);
  const native=await s.rpc('read');assert.equal(JSON.parse(native.entries[model.KEY]).records[event.eventId].status,'applied');
  h.io.values.clear();const recovered=durability.createClient({storage:h.io,rpc:s.rpc});await recovered.initialize();
  const resumed=f.harness({io:h.io,queue:[event]}),second=f.events.createConsumer({ports:resumed.ports,ledger:resumed.ledger,storage:resumed.io,source:resumed.source,durable:recovered,digest:model.sha256,now:()=>f.NOW});
  await second.consume(()=>true);assert.equal(resumed.store.getState().counts.pet,1);assert.equal(resumed.acks[0].status,'duplicate');assert.equal(resumed.social.dex.deviceReceipts.length,1);
 }finally{await s.close();}
});
test('original game normal saves and actual import preserve the Native commit marker through instrumented F()',async()=>{
 const vm=require('node:vm'),s=server(),io=memory();try{
  const client=durability.createClient({storage:io,rpc:s.rpc});await client.initialize();
  const token='00000000-0000-4000-8000-000000000001';await client.checkpoint({[durability.MARKER]:token});
  const raw=fs.readFileSync(root+'/android/app/src/main/assets/game-03.js','utf8'),ctx={CatOfflineDurable:client};vm.runInNewContext(raw.slice(0,raw.indexOf('/**'))+';globalThis.factory=vu;})();',ctx);
  const store=ctx.factory({storage:io,now:()=>2000000000000});store.flush();assert.equal(JSON.parse(io.getItem(model.GAME)).__cflocal2Commit,token);
  store.act('pet');assert.equal(JSON.parse(io.getItem(model.GAME)).__cflocal2Commit,token);assert.equal(store.importSave(store.exportSave()).ok,true);assert.equal(JSON.parse(io.getItem(model.GAME)).__cflocal2Commit,token);
 }finally{await s.close();}
});
