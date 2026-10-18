/* Exact existing mounted Host fixture; production JS is read-only, Native/GATT is memory. */
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto');
const current=path.resolve(__dirname,'..'),prior=path.resolve(current,'../../ui023/source'),wait=ms=>new Promise(r=>setTimeout(r,ms));
function load(candidate){
 let source=fs.readFileSync(candidate+'/tests/v2-host-integration.test.cjs','utf8');source=source.slice(0,source.indexOf("test('production Host"));
 source=source.replace('nativeReady.then(()=>{',`const originalInterval=w.setInterval.bind(w);w.setInterval=(fn,ms)=>ms===500?12345:originalInterval(fn,ms);nativeReady.then(()=>{`);
 const old="w.eval(fs.readFileSync(root+'/web/'+file,'utf8'))";if(!source.includes(old))throw Error('mounted fixture source anchor changed');
 source=source.replace(old,`w.eval((()=>{let text=fs.readFileSync(root+'/web/'+file,'utf8');if(file==='offline-scene-sync.js')text=text.replace('const observer=new root.MutationObserver(records=>{',\`const observer=new root.MutationObserver(records=>{if(root.__observerCapture)root.__observerRecords.push(records.map(r=>({type:r.type,target:r.target.id||r.target.nodeName,attribute:r.attributeName,value:r.attributeName&&r.target.getAttribute?.(r.attributeName),inDevice:!!(r.target.nodeType===1?r.target:r.target.parentElement)?.closest('#offline-device')})));\`);return text;})())`);
 const frame='JSON.stringify({v:2,id:command.id,op:command.op,ok:true,data})';if(!source.includes(frame))throw Error('Native memory response anchor changed');source=source.replace(frame,"JSON.stringify(w.__diagnosticFailure&&command.op==='state'?{v:2,id:command.id,op:command.op,ok:false,error:{code:'BUSY',message:'Memory fixture read unavailable',outcome:'no_change'}}:{v:2,id:command.id,op:command.op,ok:true,data})");
 source+='\nmodule.exports={harness,until};';const m=new Module(candidate+'/tests/__isolated_mounted_probe.cjs',module);m.filename=candidate+'/tests/__isolated_mounted_probe.cjs';m.paths=Module._nodeModulePaths(candidate+'/tests');m._compile(source,m.filename);return m.exports;
}
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
async function probe({baseline=false,events=false,normalTrigger=false,repeats=1,presentation=false,scenario='normal',browserExport=false}={}){
 const candidate=baseline?prior:current,{harness,until}=load(candidate),h=harness({events});
 try{
  await until(()=>h.w.CatOfflineSceneSync);const mode=h.d.getElementById('offline-device-mode');mode.value='cflocal2';mode.dispatchEvent(new h.w.Event('change'));await wait(20);h.d.getElementById('offline-v2-scan').click();await until(()=>h.d.querySelector('#offline-v2-list button'));h.d.querySelector('#offline-v2-list button').click();
  const end=Date.now()+2500;while(h.w.CatOfflineSceneSync.status.stage!=='synced'&&Date.now()<end){if(h.held.length)h.held.shift()();await wait(5);}if(h.w.CatOfflineSceneSync.status.stage!=='synced')throw Error('initial production scene did not settle');
  h.d.getElementById('offline-device-diagnostics').open=true;
  if(scenario!=='normal'){
   h.d.getElementById('offline-diag-refresh').click();await until(()=>!h.d.getElementById('offline-diag-export').disabled);await wait(200);
   if(scenario==='busy'){h.raw.life={view:'world',entering:false,world:{phase:'walking'}};h.d.body.dataset.view='world';h.w.CatOfflineSceneSync.render();await until(()=>h.held.length>0);}
   if(scenario==='background'){h.w.CatOfflineHost.suspend();h.w.CatOfflineHost.resume();}
   if(scenario==='disconnect'){h.d.getElementById('offline-v2-disconnect').click();await until(()=>h.w.CatLocalV2Adapter.ports.control.getState().stage==='disconnected');}
  }
  await wait(events?1700:200);
  const before=h.commands.length,journal=h.w.localStorage.getItem('cat-cflocal2-journal-v1'),authority=JSON.stringify(h.authority),status=JSON.stringify(h.w.CatOfflineSceneSync.status);
  h.w.__observerRecords=[];h.w.__observerCapture=true;if(scenario==='readFailure')h.w.__diagnosticFailure=true;
  if(events)h.raw.room.currentAction='feed';else h.raw.pet.stats.food=50; // Memory only: no DOM/input/game reward.
  if(presentation){h.w.CatOfflineHost.openDevice();const extra=h.d.createElement('p');extra.id='future-device-presentation-fixture';extra.textContent='软件展示节点';h.d.querySelector('.offline-device-body').append(extra);extra.hidden=true;extra.hidden=false;}
  for(let i=0;i<repeats;i++){if(scenario!=='normal')h.w.CatOfflineSceneSync.render();h.d.getElementById('offline-diag-refresh').click();await until(()=>!h.d.getElementById('offline-diag-export').disabled);await wait(100);}await wait(250);
  const exportRequests=[];h.w.CatOfflineNative={exportSave:(name,text)=>exportRequests.push({name,report:JSON.parse(text)})};h.d.getElementById('offline-diag-export').click();let browserAnchorInsideDevice=null;
  if(browserExport){delete h.w.CatOfflineNative;let blob;h.w.Blob=Blob;h.w.URL.createObjectURL=value=>{blob=value;return 'blob:mounted-fixture';};h.w.URL.revokeObjectURL=()=>{};h.w.HTMLAnchorElement.prototype.click=function(){browserAnchorInsideDevice=!!this.closest('#offline-device');};h.d.getElementById('offline-diag-export').click();exportRequests.push({browser:true,report:JSON.parse(await blob.text())});}await wait(200);
  const result={baseline023:baseline,eventsEnabled:events,scenario,refreshAttempts:repeats,presentationProbe:presentation,browserAnchorInsideDevice,refreshDisabled:h.d.getElementById('offline-diag-refresh').disabled,diagnosticText:h.d.getElementById('offline-device-diagnostics').textContent,normal500msPollSuppressed:true,memorySceneChangedWithoutDOMMutation:true,priorCommands:before,commandsAfterExplicitDiagnostic:h.commands.slice(before).map(c=>({op:c.op,seq:c.seq})),journalChanged:h.w.localStorage.getItem('cat-cflocal2-journal-v1')!==journal,authorityChanged:JSON.stringify(h.authority)!==authority,beforeJournalSha256:sha(journal),afterJournalSha256:sha(h.w.localStorage.getItem('cat-cflocal2-journal-v1')),statusUnchanged:JSON.stringify(h.w.CatOfflineSceneSync.status)===status,status:h.w.CatOfflineSceneSync.status.stage,exportRequests:exportRequests.length,observerRecords:h.w.__observerRecords,sourceSha256:sha(fs.readFileSync(candidate+'/web/offline-scene-sync.js','utf8'))};
  if(normalTrigger){h.w.__observerCapture=false;h.raw.life={view:'world',entering:false,world:{phase:'walking'}};const count=h.commands.length;h.d.body.dataset.view='world';h.w.CatOfflineSceneSync.render();await until(()=>h.commands.slice(count).some(c=>c.op==='snapshot'));const newCommands=h.commands.slice(count);result.normalGameDOMTrigger={commands:newCommands.map(c=>({op:c.op,seq:c.seq})),snapshot:newCommands.find(c=>c.op==='snapshot').data};}
  return result;
 }finally{await h.close();}
}
module.exports={probe,current,prior};
