/* Actual device events only. Original rules plan results in an isolated store. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./offline-event-store.js'):root.CatOfflineEventStore);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.CatOfflineDeviceEvents=api.mount(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(db){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const fail=(message,code='EVENT_REJECTED')=>Object.assign(new Error(message),{code});
  const fingerprint=pet=>JSON.stringify([pet.createdAt,pet.id,pet.joinedAt]);
  const ACTION={pet:'pet',feed:'feed',water:'drink',bath:'bath',play:'tease',sleep:'sleep'};
  const LABEL={pet:'摸摸',feed:'喂食',water:'喝水',bath:'洗澡',play:'逗猫',sleep:'睡觉'};
  function validateEvent(e,id){
    if(!e||e.source!=='native_device'||e.protocol!=='CFLOCAL2'||e.deviceId!==id||!Number.isSafeInteger(e.counter)||e.counter<1||e.eventId!==id+':'+e.counter||typeof e.petId!=='string'||!e.petId||e.petId.length>64||(e.occurredAtMs!==null&&(!Number.isSafeInteger(e.occurredAtMs)||e.occurredAtMs<0)))throw fail('设备事件来源或编号无效，未确认删除。');
    if(e.kind==='care'){if(!Object.hasOwn(ACTION,e.action))throw fail('当前固件没有此照料入口，事件已保留等待核对。','EVENT_UNSUPPORTED');}
    else if(e.kind==='gift'){
      if(!/^[0-9a-f]{32}$/.test(e.peerId)||e.peerId===id||!Number.isSafeInteger(e.peerCounter)||e.peerCounter<1||e.giftId!=='flower'||e.quantity!==1||e.peerComplete!==false)throw fail('野花收据与当前协议不符；不能据此建立双方好友。','EVENT_UNSUPPORTED');
    }else throw fail('未支持的设备事件，已保留等待升级。','EVENT_UNSUPPORTED');
  }
  function parseSocial(raw){
    let d;try{d=JSON.parse(raw);}catch{throw fail('社交原存档无法读取，事件未结算。','SOURCE_SAVE_UNSAFE');}
    if(d?.v!==1||!d.dex||!d.friends||!d.gifts||!Array.isArray(d.gifts.inbox)||!Array.isArray(d.gifts.log)||!Array.isArray(d.log))throw fail('社交原存档格式不完整，事件未结算。','SOURCE_SAVE_UNSAFE');
    return d;
  }
  function plan({event,game,social,createStore,now,runtime}){
    if(!runtime)throw fail('原照料会话上下文尚未就绪，设备事件保留。','CARE_RUNTIME_INVALID');
    const d=parseSocial(social);let staged=game;
    const store=createStore({storage:{getItem:k=>k===db.GAME?game:null,setItem:(k,v)=>{if(k!==db.GAME)throw Error('Unexpected rule key');staged=v;}},now,hostRuntime:runtime});
    if(store.getState().storageIssue)throw fail('原游戏存档无法读取，未结算设备事件。','SOURCE_SAVE_UNSAFE');
    let result;
    if(event.kind==='care'){
      const remaining=store.hostCareDelay(ACTION[event.action]);
      if(remaining>0)return {deferred:true,remainingMs:remaining};
      result=store.hostDeviceCare(ACTION[event.action]);
    }
    else {
      if((store.getState().inventory.flower||0)>=100000)throw fail('背包里的野花已满，请先整理背包；设备收据保留。');
      result=store.socialGrant({items:{flower:1},journal:{kind:'gift',msg:'收到匿名吧唧 '+event.peerId+' 的野花 ×1。'},message:'收到真实吧唧野花 ×1'});
    }
    if(store.getState().storageIssue)throw fail('原规则结果未写入计划，未确认设备事件。','SOURCE_SAVE_UNSAFE');
    const status=result.ok?'applied':'rejected',reason=result.ok?'none':result.reason||'ineligible';
    const message=result.ok?(event.kind==='care'?'设备'+LABEL[event.action]+'已按原规则结算。':'真实吧唧野花 ×1 已放入背包；好友确认尚未完成。'):'设备'+LABEL[event.action]+'未获奖励：'+result.message;
    d.dex.deviceReceipts??=[];
    d.dex.deviceReceipts.push({eventId:event.eventId,petId:event.petId,kind:event.kind,action:event.action||null,peerId:event.peerId||null,status,reason,message});
    if(event.kind==='gift'&&result.ok){
      // It is already opened by this atomic transaction. The original openGift
      // guard cannot award it a second time. No profile or mutual meet is made up.
      d.gifts.inbox.push({id:'device:'+event.eventId,from:'device:'+event.peerId,fname:'匿名吧唧 '+event.peerId,breed:null,g:{kind:'item',id:'flower',n:1,label:'野花 ×1'},at:now(),open:true,source:'native_device',eventId:event.eventId});
      d.gifts.log.unshift({t:now(),dir:'in',who:'匿名吧唧 '+event.peerId,label:'野花 ×1',eventId:event.eventId,source:'native_device'});
    }
    d.log.unshift({t:now(),icon:result.ok?'📟':'⚠️',msg:message,eventId:event.eventId});d.log=d.log.slice(0,60);
    return {game:staged,social:JSON.stringify(d),status,reason,message,result,runtime:store.hostReadCareRuntime()};
  }
  function createConsumer({ports,ledger,storage,source,durable,digest,uuid=()=>crypto.randomUUID(),now=()=>Date.now(),onResult=()=>{},fault=()=>{}}){
    let busy=false;
    return {
      get busy(){return busy;},
      assertPending(pending){
        source.assertHealthy();if(!pending||pending.op!=='ack')return;
        const r=ledger.snapshot().records[pending.data?.eventId],receipt=pending.data?.receipt,s=ports.control.getState();
        if(!r||r.identity!==source.identity()||r.event.petId!==source.wire(s).petId||r.event.counter!==pending.data.counter||receipt?.persisted!==true||receipt.saveDigest!==r.saveDigest||!['duplicate',r.status].includes(receipt.status))throw fail('未知事件确认缺少匹配的本地持久结果，已保留指令；请恢复更新的完整备份。','EVENT_HISTORY_MISSING');
        if(s.hello?.capabilities?.includes('care_receipt_v1')&&((r.reason===undefined||receipt.reason!==r.reason)||(receipt.status==='duplicate'?receipt.originalStatus!==r.status:receipt.status!==r.status)))throw fail('待确认ACK缺少原始终态原因；已保留旧字节，不能重算或升级未知指令。','EVENT_HISTORY_MISSING');
        durable.confirm(r);
      },
      async consume(valid){
        if(busy)throw fail('上一条设备事件正在确认。');busy=true;
        let phase='source',eventCounter=null;
        try {
          ledger.assertHealthy();if(!durable)throw fail('原生持久存档不可用，不能确认设备事件。');durable.assertHealthy();if(!valid())return {waiting:true};
          if(source.busy())return {waiting:true,phase:'source_busy',counter:eventCounter,message:'小猫互动结束后会自动同步。'};
          source.assertHealthy();source.flush();source.assertHealthy();
          const s=ports.control.getState(),lastAck=s.device?.lastAck??0,records=ledger.snapshot().records;
          if(!Number.isSafeInteger(lastAck)||lastAck<0||lastAck>4096)throw fail('设备已确认历史超出当前备份，暂停结算与确认。','EVENT_HISTORY_MISSING');
          for(let counter=1;counter<=lastAck;counter++)if(!records[s.hello.deviceId+':'+counter])throw fail('当前备份缺少设备已确认的事件结果，暂停新消费与确认。请恢复更新的完整备份。','EVENT_HISTORY_MISSING');
          phase='read_event';const event=await ports.events.readNext();eventCounter=event?.counter||null;
          if(!valid()||event===null)return {processed:false};
          if(source.busy())return {waiting:true,phase:'source_busy',counter:eventCounter,message:'小猫互动结束后会自动同步。'};
          source.assertHealthy();source.flush();source.assertHealthy();
          validateEvent(event,s.hello.deviceId);
          let identity,wire;
          try {identity=source.identity();wire=source.wire(s);if(wire.petId!==event.petId)throw fail('设备事件属于另一只猫，已隔离；请恢复原猫再处理。','SOURCE_IDENTITY_CHANGED');}
          catch(e){if(e.code==='SOURCE_IDENTITY_CHANGED'){ledger.isolate(event,e.message);onResult({stage:'isolated',message:e.message});}throw e;}
          let receipt=ledger.find(event),duplicate=Boolean(receipt);
          if(receipt&&receipt.identity!==identity)throw fail('事件收据属于另一存档世代，未确认。','SOURCE_IDENTITY_CHANGED');
          if(!receipt){
            const release=source.freeze?.()||(()=>{});
            try{
            source.flush(release);source.assertHealthy();
            const game=storage.getItem(db.GAME),social=storage.getItem(db.SOCIAL);
            const memoryBefore=source.capture();
            phase='plan';const planned=plan({event,game,social,createStore:source.createStore,now,runtime:source.readCareRuntime()});
            if(planned.deferred)return {waiting:true,phase:'cooldown',counter:eventCounter,message:'小猫正在缓一缓，稍后会自动同步。',remainingMs:planned.remainingMs};
            const token=uuid();planned.game=JSON.stringify({...JSON.parse(planned.game),__cflocal2Commit:token});planned.social=JSON.stringify({...JSON.parse(planned.social),__cflocal2Commit:token});
            phase='digest';const saveDigest=await digest(db.canonical({event,identity,game:planned.game,social:planned.social,status:planned.status,reason:planned.reason}));
            // Digest yields to the UI. Revalidate identity, activity, and exact
            // before-images; no old plan may overwrite a newer phone action.
            if(!valid())return {waiting:true};source.assertHealthy();
            if(source.identity()!==identity||source.wire(ports.control.getState()).petId!==event.petId){ledger.isolate(event,'结算期间切换了猫或存档世代，未确认设备事件。');throw fail('手机身份已变化，设备事件已隔离。','SOURCE_IDENTITY_CHANGED');}
            if((release.busy?release.busy():source.busy())||source.capture()!==memoryBefore)return {waiting:true,phase:'source_changed',counter:eventCounter,message:'正在跟上小猫的最新进度。'};
            const input={event,identity,status:planned.status,reason:planned.reason,message:planned.message,saveDigest,token,images:[{key:db.GAME,before:game,after:planned.game},{key:db.SOCIAL,before:social,after:planned.social}]},decision=ledger.preview(input);
            durable.eventLocked=true;
            phase='native_commit';try{await durable.seal({game:planned.game,social:planned.social,ledger:decision.next,token});fault('native-committed');}finally{durable.eventLocked=false;}
            // Native owns the complete decision before any original key changes.
            // Finish its projection even after pause; only the subsequent ACK is
            // conditional on this connection still being explicitly authorized.
            phase='project';receipt=ledger.commit(input);
            fault('committed');source.hydrate(planned.game,planned.social,planned.runtime,release);fault('hydrated');
            }finally{release();}
          }
          phase='confirm_receipt';source.assertHealthy();ledger.assertHealthy();durable.confirm(receipt);if(!valid())return {processed:true,acknowledged:false};
          // Only a receipt whose original game AND social images completed can
          // reach the adapter. Source/storage errors are never quarantined.
          if(s.hello?.capabilities?.includes('care_receipt_v1')&&receipt.reason===undefined)throw fail('此历史收据未保存原终态原因，已保留设备事件，不能猜测或重新结算。','EVENT_HISTORY_MISSING');
          phase='ack';fault('before-ack');const reply=await ports.events.acknowledge({eventId:event.eventId,status:duplicate?'duplicate':receipt.status,originalStatus:receipt.status,reason:receipt.reason??(receipt.status==='applied'?'none':'ineligible'),persisted:true,saveDigest:receipt.saveDigest});
          if(reply?.status!=='device_persisted'||reply.eventId!==event.eventId)throw fail('设备尚未持久确认事件移出队列。');
          fault('acknowledged');onResult({stage:receipt.status,message:receipt.message,eventId:event.eventId,duplicate});return {processed:true,acknowledged:true};
        } catch(error){if(error&&typeof error==='object'){error.syncPhase=phase;error.eventCounter=eventCounter;}throw error;} finally {busy=false;}
      }
    };
  }
  function mount(root){
    const storage=root.localStorage,ledger=root.CatOfflineEventLedger,g=root.__petGame,rawExport=g?.store.exportSave.bind(g.store),rawImport=g?.store.importSave.bind(g.store);
    let hydrationError=null,activeFreeze=null;
    const originalBusy=()=>!g?.state()?.ready||Boolean(g.state()?.busy||g.state()?.pet?.busy||root.__pgSocial?.M||root.document.querySelector('#sc-hub.on,#life-ov.on'));
    const owned=owner=>{if(!activeFreeze||owner!==activeFreeze.release)throw fail('设备结果存储通道不属于本次事务。','CARE_RUNTIME_BUSY');return activeFreeze.lease;};
    const source={
      busy:()=>originalBusy()||Boolean(g?.store.hostCareRuntimeBusy()),
      flush(owner){if(owner&&!activeFreeze)throw fail('设备结果存储通道已释放。','CARE_RUNTIME_STALE');if(activeFreeze)owned(owner).flush();else g.store.flush();root.__pgSocial?.saveD();},
      assertHealthy(){
        if(root.CatOfflineEventStorageError)throw root.CatOfflineEventStorageError;
        if(!ledger||!g?.hostCreateStore||!root.__pgSocial?.D)throw fail('原游戏事件接口尚未就绪。');
        ledger.assertHealthy();if(hydrationError)throw hydrationError;
        if(g.state().pet.storageIssue)throw fail('手机原存档未确认保存，设备事件保留。','SOURCE_SAVE_UNSAFE');
        const game=storage.getItem(db.GAME);
        if(game===null||g.hostCreateStore({storage:{getItem:()=>game,setItem(){}}}).getState().storageIssue)throw fail('手机持久原存档无法读取，设备事件保留。','SOURCE_SAVE_UNSAFE');
        const social=storage.getItem(db.SOCIAL);parseSocial(social);
        if(db.canonical(JSON.parse(social))!==db.canonical(root.__pgSocial.D))throw fail('社交存档未确认写入，设备事件保留。','SOURCE_SAVE_UNSAFE');
      },
      identity:()=>fingerprint(g.state().pet),
      readCareRuntime:()=>g.store.hostReadCareRuntime(),
      capture(){const value=JSON.parse(rawExport());delete value.lastSavedAt;return db.canonical({game:value,runtime:g.store.hostReadCareRuntime()});},
      wire:s=>root.CatOfflineSceneMap.read({deviceId:s.hello.deviceId,hasSnapshot:s.device?.hasSnapshot===true,snapshotPetId:s.device?.snapshot?.petId}),
      createStore:options=>g.hostCreateStore(options),
      validateSocial:parseSocial,
      freeze(){
        if(activeFreeze||g.store.hostCareRuntimeBusy())throw fail('设备结果正在保存，请稍后再操作。','CARE_RUNTIME_BUSY');
        const body=root.document.body,wasInert=body.inert,durable=root.CatOfflineDurable,paused=durable?.transactionPaused;
        g.hostSuspend();const lease=g.store.hostFreezeDeviceResult();body.inert=true;if(durable)durable.transactionPaused=true;
        const rejectInput=e=>{e.preventDefault();e.stopImmediatePropagation();root.__pgLife?.toast?.('设备结果正在保存，请稍后再操作。');};
        const blockedInputs=['click','submit','change','keydown'];for(const type of blockedInputs)root.document.addEventListener(type,rejectInput,true);
        let released=false;
        const release=()=>{if(released)return;released=true;try{lease.release();}finally{for(const type of blockedInputs)root.document.removeEventListener(type,rejectInput,true);activeFreeze=null;if(durable)durable.transactionPaused=durable.available?paused:true;body.inert=wasInert;if(root.CatOfflineDurable?.available&&root.CatOfflineDurable.foreground&&!root.document.hidden){g.hostResume();g.setRoomActive(!body.classList.contains('offline-obscured'));}}};
        release.busy=()=>{owned(release);return originalBusy();};activeFreeze={release,lease};return release;
      },
      hydrate(game,social,runtime,owner){
        const lease=owned(owner);
        try {const result=runtime===undefined?lease.importSave(game):lease.hydrateDevice(game,runtime);if(!result.ok||g.state().pet.storageIssue)throw Error(result.message||'原游戏未恢复');
          const d=root.__pgSocial.D;for(const k of Object.keys(d))delete d[k];Object.assign(d,parseSocial(social));root.__pgSocial.hostRefresh();
        }catch(e){hydrationError=fail('持久结算已提交，画面尚未恢复；请重新打开应用，事件不会再次领奖。'+e.message,'EVENT_RELOAD_REQUIRED');throw hydrationError;}
      }
    };
    const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const api={createConsumer:ports=>createConsumer({ports,ledger,storage,source,durable:root.CatOfflineDurable,digest:db.sha256,uuid:()=>root.crypto.randomUUID(),onResult:r=>{api.lastResult=r;}}),lastResult:null,
      dexHtml(d){const rows=d.dex?.deviceReceipts||[];return '<section class="lf-sec"><h4>真实吧唧收据 <small>已结算或明确未获奖；不等于双方好友确认</small></h4><div class="sc-ev">'+rows.slice(-30).reverse().map(x=>'<span>📟 <b>'+escape(x.message)+'</b><small>'+escape(x.eventId)+'</small></span>').join('')+(rows.length?'':'<p class="lf-empty">尚无真实设备事件</p>')+'</div></section>';},source,ledger};
    // Backup hooks are installed below after the original source exists. Their
    // metadata is outside the original game schema and never grants an event.
    api.rawExport=rawExport;api.rawImport=rawImport;
    return api;
  }
  return {createConsumer,validateEvent,plan,parseSocial,mount,fingerprint};
});
