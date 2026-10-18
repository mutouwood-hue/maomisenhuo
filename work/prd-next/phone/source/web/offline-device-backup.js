/* Original JSON backup + durable event metadata. Import never clears dedup. */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./offline-event-store.js'):root.CatOfflineEventStore);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root.CatOfflineDeviceEvents?.rawExport){
   const events=root.CatOfflineDeviceEvents,g=root.__petGame;
   const bridge=api.createBridge({storage:root.localStorage,ledger:events.ledger,source:events.source,originalExport:events.rawExport,durable:root.CatOfflineDurable,uuid:()=>root.crypto.randomUUID(),
     connected:()=>root.CatOfflineSceneSync?.connected===true,reload:()=>root.location.reload()});
   g.store.exportSave=()=>{try{return bridge.exportData();}catch(e){
     const raw={},model=root.CatOfflineEventStore;for(const key of [...model.MANAGED,model.KEY]){try{raw[key]=root.localStorage.getItem(key);}catch{raw[key]={unreadable:true};}}
     raw.memoryGame=events.rawExport();root.__pgLife?.toast?.('已生成原文恢复备份，包含读取异常说明；这份文件暂不能直接导入。');
     return JSON.stringify({format:'catforest-recovery-v1',warning:e.message,raw},null,2);
   }};
   g.store.importSave=async raw=>{try{return await bridge.restore(raw);}catch(e){return {ok:false,message:e.message};}};
 }
})(typeof globalThis!=='undefined'?globalThis:this,function(db){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x)),fail=m=>{throw new Error(m);};
 const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
 function mergeIdentity(local,incoming){
   const valid=v=>{
     if(!object(v)||v.schema!==1||!Array.isArray(v.cats)||v.cats.length>256||!object(v.bindings)||Object.keys(v.bindings).length>32)fail('备份宠物身份记录无效。');
     const fs=new Set(),ids=new Set();
     for(const x of v.cats){if(typeof x.fingerprint!=='string'||!/^cat-[0-9a-f-]{36}$/i.test(x.id)||fs.has(x.fingerprint)||ids.has(x.id))fail('备份猫身份重复或无效。');fs.add(x.fingerprint);ids.add(x.id);}
     for(const [id,f]of Object.entries(v.bindings))if(!/^[0-9a-f]{32}$/.test(id)||!fs.has(f))fail('备份设备绑定无效。');return v;
   };
   const out=clone(local?valid(local):{schema:1,cats:[],bindings:{}});valid(incoming);
   for(const x of incoming.cats){const same=out.cats.find(y=>y.fingerprint===x.fingerprint||y.id===x.id);if(same&&db.canonical(same)!==db.canonical(x))fail('备份与本机猫身份冲突，未覆盖。');if(!same)out.cats.push(clone(x));}
   for(const [id,f]of Object.entries(incoming.bindings)){if(out.bindings[id]&&out.bindings[id]!==f)fail('备份属于另一只设备绑定猫，请先处理原猫事件。');out.bindings[id]=f;}
   return valid(out);
 }
 function mergeJournal(local,incoming){
   const valid=v=>{
     if(!object(v)||v.schema!==1||typeof v.clientId!=='string'||!/^[\x21-\x7e]{1,36}$/.test(v.clientId)||!object(v.devices)||Object.keys(v.devices).length>32)fail('备份同步日志无效。');
     for(const [id,d]of Object.entries(v.devices))if(!/^[0-9a-f]{32}$/.test(id)||!Number.isSafeInteger(d.nextSeq)||d.nextSeq<1||!Number.isSafeInteger(d.syncRevision)||d.syncRevision<0||!(d.pending===null||(object(d.pending)&&['ack','snapshot'].includes(d.pending.op)&&d.pending.seq===d.nextSeq&&typeof d.pending.id==='string'&&object(d.pending.data))))fail('备份同步序号或pending无效。');return v;
   };
   valid(incoming);if(!local)return clone(incoming);valid(local);
   if(local.clientId!==incoming.clientId){if(Object.keys(local.devices).length)fail('备份属于另一份设备owner，不能自动覆盖。');return clone(incoming);}
   const out=clone(local);
   for(const [id,d]of Object.entries(incoming.devices)){
     const old=out.devices[id];if(!old||old.nextSeq<d.nextSeq){out.devices[id]=clone(d);continue;}
     if(old.nextSeq===d.nextSeq){
       if(old.pending&&d.pending&&db.canonical(old.pending)!==db.canonical(d.pending))fail('备份与本机未知指令冲突，不能丢弃任何一条。');
       if(!old.pending&&d.pending)old.pending=clone(d.pending);
       if(d.syncRevision>old.syncRevision){old.syncRevision=d.syncRevision;old.lastSemantic=d.lastSemantic;}
     }
   }
   return valid(out);
 }
 function createBridge({storage,ledger,source,originalExport,durable,uuid=()=>globalThis.crypto.randomUUID(),connected=()=>false,reload=()=>{}}){
   const read=k=>{const raw=storage.getItem(k);return raw===null?null:JSON.parse(raw);};
   return {
     exportData(){
       if(durable?.required)durable.assertHealthy();source.assertHealthy();const game=JSON.parse(originalExport());
       const metadata={schema:2,ledger:ledger.snapshot(),identity:read(db.IDENTITY),adapter:read(db.JOURNAL),social:read(db.SOCIAL),memorial:db.collectMemorial(storage,game)};
       const binding=db.sha256(db.canonical({game,metadata}));game.__cflocal2Backup={...metadata,binding};
       return JSON.stringify(game,null,2);
     },
     async restore(raw){
       durable.assertHealthy();
       if(connected()||source.busy())fail('请先结束互动并断开吧唧，再导入存档。');
       ledger.assertHealthy();if(typeof raw!=='string'||raw.length>8_000_000)fail('备份文件无效或过大。');
       const release=source.freeze?.()||(()=>{});
       try{
       
       let value;try{value=JSON.parse(raw);}catch{fail('存档格式不正确，当前进度没有改变。');}
       if(!object(value))fail('存档格式不正确，当前进度没有改变。');
        const backup=value.__cflocal2Backup;delete value.__cflocal2Backup;
       let after=null;const test=source.createStore({storage:{getItem:()=>null,setItem:(k,v)=>{if(k===db.GAME)after=v;}}});
       const result=test.importSave(JSON.stringify(value));if(!result.ok)fail(result.message);
       const images=[{key:db.GAME,before:storage.getItem(db.GAME),after}];
       let records={},isolated=[],social=storage.getItem(db.SOCIAL);
       if(backup!==undefined){
         if(![1,2].includes(backup?.schema)||Object.keys(backup).sort().join(',')!==(['schema','ledger','identity','adapter','social','binding',...(backup.schema===2?['memorial']:[])].sort().join(','))||backup.ledger?.schema!==1||backup.ledger.pending!==null||!object(backup.ledger.records)||!Array.isArray(backup.ledger.isolated))fail('事件备份版本或提交记录无效，未导入。');
         const metadata={...backup};delete metadata.binding;
         if(!/^[0-9a-f]{64}$/.test(backup.binding)||backup.binding!==db.sha256(db.canonical({game:value,metadata})))fail('游戏、社交与事件结果的备份关联不符，未导入。');
         records=backup.ledger.records;isolated=backup.ledger.isolated;
         if(backup.social!==null){social=JSON.stringify(backup.social);source.validateSocial(social);images.push({key:db.SOCIAL,before:storage.getItem(db.SOCIAL),after:social});}
         if(backup.identity!==null)images.push({key:db.IDENTITY,before:storage.getItem(db.IDENTITY),after:JSON.stringify(mergeIdentity(read(db.IDENTITY),backup.identity))});
         if(backup.adapter!==null)images.push({key:db.JOURNAL,before:storage.getItem(db.JOURNAL),after:JSON.stringify(mergeJournal(read(db.JOURNAL),backup.adapter))});
       }
       for(const id of Object.keys(ledger.snapshot().records))if(!records[id])fail('这份备份缺少本机已结算的设备事件，已阻止旧进度覆盖。请使用更新的完整备份；未知指令和去重记录均保留。');
        let localGame;try{localGame=JSON.parse(originalExport());if(!object(localGame))localGame=null;}catch{localGame=null;}
        // 损坏原文不被默默重建；用户明确导入的有效备份才进入后续原子恢复。
        localGame=localGame||{cats:[],graduates:[]};
        // lastSavedAt 是导出时刻，不是进度修订号；空闲等待不能阻止原备份恢复。
         for(const record of localGame.graduates||[]){const incoming=(value.graduates||[]).find(x=>x.id===record.id);if(!incoming||db.canonical(incoming)!==db.canonical(record))fail('备份缺少本机更新的毕业纪念或存在身份/外观冲突，未覆盖。');}
         if(localGame.createdAt===value.createdAt)for(const cat of localGame.cats||[]){
           const incoming=(value.cats||[]).find(x=>x.id===cat.id);
           if(!incoming){if(!(value.graduates||[]).some(record=>record.id===cat.id))fail('备份缺少本机已领养的小猫，未覆盖。');continue;}
           if(Number.isFinite(cat.xp)&&Number.isFinite(incoming.xp)&&incoming.xp<cat.xp)fail('备份缺少本机更新的养成进度，未覆盖。');
           for(const [key,count]of Object.entries(cat.counts||{}))if(Number.isFinite(count)&&count>0&&!(incoming.counts?.[key]>=count))fail('备份缺少本机更新的照料记录，未覆盖。');
         }
        for(const group of ['completed','collected'])for(const [key,count]of Object.entries(localGame.world?.[group]||{}))if(Number.isFinite(count)&&count>0&&!(value.world?.[group]?.[key]>=count))fail('备份缺少本机更新的世界进度，未覆盖。');
        const localWorld=read(db.SOCIAL)?.world,incomingWorld=backup?.social?.world;
        if(incomingWorld&&localWorld){for(const entry of localWorld.log||[])if(!(incomingWorld.log||[]).some(x=>db.canonical(x)===db.canonical(entry)))fail('备份缺少本机世界纪念资产，未覆盖。');if(localWorld.edit&&db.canonical(localWorld.edit)!==db.canonical(incomingWorld.edit))fail('备份与本机世界编辑冲突，未覆盖。');}
        // 本机已经存在的毕业信/外观不能被旧文件抹掉或换绑。
        for(const record of localGame.graduates||[]){const incoming=(value.graduates||[]).find(x=>x.id===record.id);if(!incoming||db.canonical(incoming)!==db.canonical(record))fail('备份缺少本机更新的毕业纪念或存在身份/外观冲突，未覆盖。');}
        const localMemorial=db.collectMemorial(storage,localGame);
        let memorial=localMemorial;
        if(backup?.schema===2){db.validateMemorial(backup.memorial,value);const photos=new Map(localMemorial.photos.map(p=>[p.key,p]));for(const p of backup.memorial.photos){const old=photos.get(p.key);if(old&&db.canonical(old)!==db.canonical(p))fail('本机毕业照片与备份冲突，未覆盖。');photos.set(p.key,p);}memorial={schema:1,photos:[...photos.values()]};}
        db.planMemorialProjection(memorial,JSON.parse(after),storage);
        if(memorial.photos.length||backup?.schema===2)images.push({key:db.MEMORIAL,before:storage.getItem(db.MEMORIAL),after:JSON.stringify(memorial)});
        for(const id of Object.keys(ledger.snapshot().records))if(!records[id])fail('这份备份缺少本机已结算的设备事件，已阻止旧进度覆盖。请使用更新的完整备份；未知指令和去重记录均保留。');
       // Old game-only exports keep all local event results and owner counters.
       // An older complete backup unions receipts and takes advanced sequences.
       const token=uuid();
       after=JSON.stringify({...JSON.parse(after),__cflocal2Commit:token});
       social=JSON.stringify({...JSON.parse(social),__cflocal2Commit:token});
       images.find(x=>x.key===db.GAME).after=after;
       const socialImage=images.find(x=>x.key===db.SOCIAL);
       if(socialImage)socialImage.after=social;else images.push({key:db.SOCIAL,before:storage.getItem(db.SOCIAL),after:social});
       const next=ledger.previewRestore({records,isolated,token,images});
       durable.eventLocked=true;
       try{
         await durable.seal({game:after,social,ledger:next,token,extra:Object.fromEntries(images.filter(x=>[db.IDENTITY,db.JOURNAL,db.MEMORIAL].includes(x.key)).map(x=>[x.key,x.after]))});
         ledger.restore({images,records,isolated,token});
       }finally{durable.eventLocked=false;}
       // An import also replaces adapter/identity caches. Always reload after
       // the durable restore, even when an old page was blocked by corrupt data.
       try{source.hydrate(after,social,undefined,release);}finally{reload();}
       return {ok:true,message:'存档与事件结果已保存，正在重新打开房间。'};
       }finally{release();}
     }
   };
 }
 return {createBridge,mergeIdentity,mergeJournal};
});
