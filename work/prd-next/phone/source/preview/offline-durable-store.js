/* Native is authoritative for device results/outbox. WebStorage is the game projection. */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./offline-event-store.js'):root.CatOfflineEventStore);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.CatOfflineDurable=api.mount(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(model){
 'use strict';
 const MARKER='cat-cflocal2-commit-marker',FIELD='__cflocal2Commit',ALLOWED=[...model.MANAGED,model.KEY,MARKER];
 const copy=x=>JSON.parse(JSON.stringify(x)),fail=m=>Object.assign(new Error(m),{code:'NATIVE_DURABILITY_REQUIRED',outcome:'unknown'});
 const stamped=(raw,token)=>JSON.stringify({...JSON.parse(raw),[FIELD]:token});
 function recover(entries,storage){
   for(const [k,v]of Object.entries(entries))if(!ALLOWED.includes(k)||typeof v!=='string')throw fail('原生权威存档格式无效。');
   const token=entries[MARKER];let project=false;
   if(token){
     if(!/^[0-9a-f-]{36}$/i.test(token))throw fail('原生提交标记无效。');
     let game,social,ledger;try{game=JSON.parse(entries[model.GAME]);social=JSON.parse(entries[model.SOCIAL]);ledger=JSON.parse(entries[model.KEY]);}catch{throw fail('原生恢复缺少完整游戏、社交或结果。');}
     if(game[FIELD]!==token||social[FIELD]!==token||ledger.commitToken!==token||ledger.pending!==null)throw fail('原生结果与恢复镜像不属于同一提交。');
     const scratch=model.createStore({getItem:k=>k===model.KEY?entries[k]:null,setItem(){throw fail('原生记录不能隐式修复。');}});scratch.assertHealthy();
     try {
       const localGame=JSON.parse(storage.getItem(model.GAME)),localSocial=JSON.parse(storage.getItem(model.SOCIAL)),localLedger=JSON.parse(storage.getItem(model.KEY));
       project=localGame?.[FIELD]!==token||localSocial?.[FIELD]!==token||localLedger?.commitToken!==token||localLedger.pending!==null||model.canonical(localLedger.records)!==model.canonical(ledger.records);
     }catch{project=true;}
   }
   let memorial=null,memorialGame=null;
    if(entries[model.MEMORIAL]!==undefined){
      if(!token)throw fail('原生纪念资产缺少原子提交标记。');
      try{const bundle=JSON.parse(entries[model.MEMORIAL]);model.validateMemorial(bundle,JSON.parse(entries[model.GAME]));if(project){memorial=bundle;memorialGame=JSON.parse(entries[model.GAME]);model.planMemorialProjection(memorial,memorialGame,storage);}else if(storage.getItem(model.MEMORIAL)!==entries[model.MEMORIAL]){const current=model.collectMemorial(storage,JSON.parse(storage.getItem(model.GAME)));storage.setItem(model.MEMORIAL,JSON.stringify(current));}}catch(e){throw fail('原生纪念资产无效或与本机照片冲突：'+e.message);}
    }
    // The adapter's entire journal is always restored before its constructor.
   // An uncheckpointed WebStorage pending can never have reached BLE.
   for(const key of [model.JOURNAL,model.IDENTITY])if(entries[key]!==undefined){storage.setItem(key,entries[key]);if(storage.getItem(key)!==entries[key])throw fail('原生身份/未知指令恢复未确认。');}
   
   if(memorial){model.projectMemorial(memorial,memorialGame,storage);storage.setItem(model.MEMORIAL,entries[model.MEMORIAL]);if(storage.getItem(model.MEMORIAL)!==entries[model.MEMORIAL])throw fail('纪念包投影未确认。');}
    if(project)for(const key of [model.GAME,model.SOCIAL,model.KEY]){storage.setItem(key,entries[key]);if(storage.getItem(key)!==entries[key])throw fail('原生结果投影未恢复，设备确认仍暂停。');}
     return {token:token||null,projected:project};
 }
 function createClient({rpc,storage,onFailure=()=>{}}){
   let revision=0,entries={},available=false,failed=null,queue=Promise.resolve(),queued=0;
   const client={foreground:true,eventLocked:false,
     get available(){return available&&!failed;},get marker(){return entries[MARKER]||null;},
     assertHealthy(){if(!available||failed)throw failed||fail('原生持久存档通道不可用，不确认设备事件。');},
     async initialize(){const result=await rpc('read',{});if(result?.schema!==1||!Number.isSafeInteger(result.revision)||result.revision<0||!result.entries||Array.isArray(result.entries))throw fail('原生存档读取证据不完整。');
       recover(result.entries,storage);revision=result.revision;entries=copy(result.entries);client.foreground=result.foreground===true;available=true;return result;
     },
     checkpoint(updates){
       try{client.assertHealthy();if(!updates||!Object.keys(updates).length||Object.entries(updates).some(([k,v])=>!ALLOWED.includes(k)||typeof v!=='string'))throw fail('原生持久化内容不完整。');if(queued>=8)throw fail('原生持久化队列繁忙。');}
       catch(e){return Promise.reject(e);}
       const snapshot=copy(updates);queued++;
       const result=queue.then(async()=>{
         client.assertHealthy();
         try{
           let response;
           try{response=await rpc('commit',{expectedRevision:revision,updates:snapshot});}
           catch(firstError){
             // A lost reply may follow a completed fsync/rename. Read authority,
             // admit only our exact decision, then re-checkpoint to obtain a
             // fresh sync certificate; a read alone never certifies persistence.
             const authority=await rpc('read',{});
             if(authority?.schema!==1||!Number.isSafeInteger(authority.revision)||authority.revision<revision||authority.revision>revision+1||!authority.entries||Array.isArray(authority.entries))throw firstError;
             const old=entries,merged={...old,...snapshot};
             if(model.canonical(authority.entries)!==model.canonical(old)&&model.canonical(authority.entries)!==model.canonical(merged))throw firstError;
             response=await rpc('commit',{expectedRevision:authority.revision,updates:snapshot});
           }
           if(response?.persisted!==true||!Number.isSafeInteger(response.revision)||response.revision<revision||response.revision>revision+1||Object.entries(snapshot).some(([k,v])=>response.hashes?.[k]!==model.sha256(v)))throw fail('原生落盘回执或原文哈希不符。');
           revision=response.revision;Object.assign(entries,snapshot);client.foreground=response.foreground===true;return response;
         }catch(e){failed=fail('原生持久提交结果未确认，请重新打开应用恢复；设备事件保留。');try{onFailure(failed);}catch{}throw failed;}
       }).finally(()=>{queued--;});queue=result.catch(()=>{});return result;
     },
     async checkpointJournal(raw){
       const updates={[model.JOURNAL]:raw},identity=storage.getItem(model.IDENTITY);if(identity!==null)updates[model.IDENTITY]=identity;
       const result=await client.checkpoint(updates);return {persisted:result.persisted,journalSha256:result.hashes[model.JOURNAL]};
     },
     async seal({game,social,ledger,token,extra={}}){
       const updates={[model.GAME]:game,[model.SOCIAL]:social,[model.KEY]:JSON.stringify(ledger),[MARKER]:token,...extra};
        if(!Object.hasOwn(updates,model.MEMORIAL)){const memorial=model.collectMemorial(storage,JSON.parse(game));if(memorial.photos.length||entries[model.MEMORIAL]!==undefined)updates[model.MEMORIAL]=JSON.stringify(memorial);}
        if(updates[model.MEMORIAL]!==undefined)model.planMemorialProjection(JSON.parse(updates[model.MEMORIAL]),JSON.parse(game),storage);
       const identity=storage.getItem(model.IDENTITY);if(identity!==null&&!Object.hasOwn(updates,model.IDENTITY))updates[model.IDENTITY]=identity;
       const journal=storage.getItem(model.JOURNAL);if(journal!==null&&!Object.hasOwn(updates,model.JOURNAL))updates[model.JOURNAL]=journal;
       return client.checkpoint(updates);
     },
     confirm(record){client.assertHealthy();let data;try{data=JSON.parse(entries[model.KEY]);}catch{throw fail('Native权威结果缺失，不能重播事件确认。');}
       const r=data?.records?.[record.event.eventId];if(!r||model.canonical(r)!==model.canonical(record))throw fail('本地收据未由原生持久记录确认。');
     },
     stampGame(value){return client.marker?{...value,[FIELD]:client.marker}:value;}
   };return client;
 }
 function mount(root){
   let port=null,sequence=0,booted=false;const pending=new Map();let resolvePort;
   const portReady=new Promise(resolve=>{resolvePort=resolve;});
   const raw=root.CatOfflineEventRawStorage||root.localStorage;
   const rpc=(op,args)=>new Promise((resolve,reject)=>{
     if(!port){reject(fail('原生存档端口未连接。'));return;}
     const requestId='store_'+(++sequence),timer=root.setTimeout(()=>{pending.delete(requestId);reject(fail('原生存档结果未确认。'));},15000);
     pending.set(requestId,{resolve,reject,timer});try{port.postMessage(JSON.stringify({requestId,op,...args}));}catch(e){root.clearTimeout(timer);pending.delete(requestId);reject(e);}
   });
   const client=createClient({rpc,storage:raw,onFailure:error=>{
     client.transactionPaused=true;root.__petGame?.setRoomActive(false);
     const d=root.document;if(!d.body||d.getElementById('offline-durable-recovery'))return;
     const dialog=d.createElement('dialog');dialog.id='offline-durable-recovery';dialog.setAttribute('aria-label','恢复本地存档');
     const message=d.createElement('p');message.textContent=error.message;const button=d.createElement('button');button.textContent='重新打开并恢复';button.style.minHeight='48px';button.onclick=()=>root.location.reload();dialog.append(message,button);d.body.append(dialog);dialog.showModal();
   }});client.required=Boolean(root.CatOfflineNative);
   const checkpointJournal=client.checkpointJournal.bind(client);delete client.checkpointJournal;
   client.preparePort=token=>{
     if(root!==root.top||port||typeof token!=='string'||!token.startsWith('cat-durable-port:'))return false;
     const bind=event=>{if(event.data!==token||event.ports?.length!==1||port)return;root.removeEventListener('message',bind);port=event.ports[0];
       port.onmessage=message=>{let response;try{response=JSON.parse(message.data);}catch{return;}
         if(response.type==='foreground'){client.foreground=response.foreground===true;if(root.CatOfflineHost)client.foreground?root.CatOfflineHost.resume():root.CatOfflineHost.suspend();return;}
         const request=pending.get(response.requestId);if(!request)return;pending.delete(response.requestId);root.clearTimeout(request.timer);response.ok===true?request.resolve(response.result):request.reject(fail(response.error?.message||'原生存档失败。'));
       };port.start();resolvePort();
     };root.addEventListener('message',bind);return true;
   };
   client.boot=async()=>{
     if(booted)return;booted=true;
     try{
       if(root.CatOfflineNative){
         await Promise.race([portReady,new Promise((_,reject)=>root.setTimeout(()=>reject(fail('原生存档恢复通道未连接。')),15000))]);
         await client.initialize();
         root.CatOfflineEventLedger=model.createStore(raw);root.CatOfflineEventLedger.recover();delete root.CatOfflineEventStorageError;
         const social=raw.getItem(model.SOCIAL);if(social!==null){const d=JSON.parse(social);if(d?.v!==1||!d.dex||!d.gifts||!d.friends)throw fail('社交原文仍无法读取，恢复已暂停。');}
         client.checkpointJournal=checkpointJournal;root.dispatchEvent(new root.Event('cat-offline-durable-ready'));
       }
       for(const placeholder of root.document.querySelectorAll('script[data-offline-src]'))await new Promise((resolve,reject)=>{
         const name=placeholder.dataset.offlineSrc;if(!/^[a-z0-9-]+\.js$/.test(name)){reject(fail('脚本清单无效。'));return;}
         const script=root.document.createElement('script');script.src=name;script.async=false;script.onload=resolve;script.onerror=()=>reject(fail('房间资源无法读取。'));placeholder.after(script);
       });
       if(root.CatOfflineNative&&!client.foreground)root.CatOfflineHost?.suspend();
       root.document.getElementById('offline-boot-status')?.remove();
     }catch(e){
       const status=root.document.getElementById('offline-boot-status');if(status){status.replaceChildren();const p=root.document.createElement('p');p.textContent=e.message;status.append(p);const b=root.document.createElement('button');b.textContent='重新打开';b.onclick=()=>root.location.reload();status.append(b);}
     }
   };
   return client;
 }
 return {createClient,recover,MARKER,FIELD,stamped,mount};
});
