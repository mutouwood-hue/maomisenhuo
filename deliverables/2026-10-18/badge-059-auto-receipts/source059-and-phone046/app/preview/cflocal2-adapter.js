/* CFLOCAL2 journal with mandatory Native durable checkpoints. No game writers. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./local-v2-transport.js'):root.CatLocalV2Transport);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else{
    root.CatLocalV2Adapter=api;
    function attach(){
      if(api.ports||!root.CatLocalV2Native||!root.CatOfflineHost?.attachLocalV2Ports||typeof root.CatOfflineDurable?.checkpointJournal!=='function')return;
      try{api.ports=api.createPorts({bridge:root.CatLocalV2Native,storage:root.localStorage,durableCheckpoint:raw=>root.CatOfflineDurable.checkpointJournal(raw)});root.CatOfflineHost.attachLocalV2Ports(api.ports);}
      catch(error){root.dispatchEvent(new CustomEvent('cat-local-v2-error',{detail:{code:error.code,message:error.message}}));}
    }
    root.addEventListener('cat-local-v2-native-ready',attach);
    // Host publishes this capability only after Native-authoritative recovery.
    root.addEventListener('cat-offline-durable-ready',attach);
    root.addEventListener('cat-local-v2-host-ready',attach);attach();
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(transport){
'use strict';
const KEY='cat-cflocal2-journal-v1',MAX=Number.MAX_SAFE_INTEGER;
const SCENES=['home','departing','away','returning','garden','town'],ACTIONS=['idle','walk','pet','feed','water','bath','play','sleep'],WEATHER=['clear','rain','snow'];
const clone=x=>JSON.parse(JSON.stringify(x));
function fail(code,message,outcome='no_change'){return Object.assign(new Error(message),{code,outcome});}
const safe=n=>Number.isSafeInteger(n)&&n>=0;
const ascii=(s,n)=>typeof s==='string'&&s.length>0&&s.length<=n&&/^[\x21-\x7e]+$/.test(s);
const utf8len=s=>new TextEncoder().encode(s).length;
function validateScene(s){
  if(!s||!ascii(s.requestId,64)||!ascii(s.petId,64)||!safe(s.revision)||!SCENES.includes(s.scene)||!ACTIONS.includes(s.action)||!WEATHER.includes(s.weather))throw fail('INVALID_SCENE','场景或宠物标识无效。');
  const p=s.pet;
  if(!p||typeof p.name!=='string'||!p.name||utf8len(p.name)>24||/[\u0000-\u001f\ud800-\udfff]/u.test(p.name)||!ascii(p.breed,16)||!safe(p.coins)||['food','mood','clean','energy','health'].some(k=>!Number.isInteger(p[k])||p[k]<0||p[k]>100))throw fail('INVALID_SCENE','宠物状态超出设备范围。');
  if(s.utcOffsetMinutes!==undefined&&(!Number.isInteger(s.utcOffsetMinutes)||s.utcOffsetMinutes< -840||s.utcOffsetMinutes>840))throw fail('INVALID_SCENE','手机时区无效。');
  if(s.epochMs!==undefined&&(!safe(s.epochMs)||s.epochMs<1577836800000||s.epochMs>4102444800000))throw fail('INVALID_SCENE','校时时间无效。');
}
function petView(p){return Object.fromEntries(['name','breed','food','mood','clean','energy','health','coins'].map(k=>[k,p[k]]));}
function offset(s){return s.utcOffsetMinutes??-new Date(s.epochMs??Date.now()).getTimezoneOffset();}
function semantic(s){return JSON.stringify({petId:s.petId,sourceRevision:s.revision,scene:s.scene,action:s.action,weather:s.weather,utcOffsetMinutes:offset(s),pet:petView(s.pet)});}
let active=null;
class Journal{
  constructor(storage,uuid){
    if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw fail('LOCAL_STORAGE_FAILED','本地同步存档不可用。');
    this.storage=storage;this.uuid=uuid;let raw;
    try{raw=storage.getItem(KEY);}catch{throw fail('LOCAL_STORAGE_FAILED','无法读取同步存档。');}
    if(raw===null){const id=uuid();if(!ascii(id,36))throw fail('LOCAL_STORAGE_FAILED','无法建立本地同步标识。');this.write({schema:1,clientId:id,devices:{}});}
    else{
      try{this.value=JSON.parse(raw);this.raw=raw;}catch{throw fail('LOCAL_STORAGE_FAILED','同步存档损坏；已保留原内容。');}
      if(this.value?.schema!==1||!ascii(this.value.clientId,36)||!this.value.devices||typeof this.value.devices!=='object'||Array.isArray(this.value.devices)||Object.keys(this.value.devices).length>32)throw fail('LOCAL_STORAGE_FAILED','同步存档格式不支持；已保留原内容。');
      for(const [id,d] of Object.entries(this.value.devices))if(!/^[0-9a-f]{32}$/.test(id)||!safe(d.nextSeq)||d.nextSeq<1||!safe(d.syncRevision)||!(d.pending===null||(d.pending&&['snapshot','ack'].includes(d.pending.op)&&d.pending.seq===d.nextSeq&&ascii(d.pending.id,64)&&typeof d.pending.data==='object')))throw fail('LOCAL_STORAGE_FAILED','同步命令记录损坏；不会重置序号。');
    }
  }
  write(value){
    const raw=JSON.stringify(value);
    try{this.storage.setItem(KEY,raw);if(this.storage.getItem(KEY)!==raw)throw Error('readback');}
    catch{throw fail('LOCAL_STORAGE_FAILED','同步存档未确认写入；不会发送下一条指令。','unknown');}
    this.value=clone(value);
    this.raw=raw;
  }
  edit(edit){const value=clone(this.value);edit(value);this.write(value);}
  device(id,hello){
    if(!this.value.devices[id]){
      if(Object.keys(this.value.devices).length===32)throw fail('LOCAL_STORAGE_FAILED','本机同步设备记录已满。');
      if(hello.clientId!==null&&hello.clientId!==this.value.clientId)throw fail('OWNER_CONFLICT','此吧唧已有另一份手机同步存档，不能自动覆盖。');
      this.edit(v=>{v.devices[id]={nextSeq:hello.lastSeq+1,syncRevision:0,lastSemantic:null,pending:null};});
    }
    return this.value.devices[id];
  }
}
function createPorts({bridge,storage=globalThis.localStorage,uuid=()=>globalThis.crypto.randomUUID(),durableCheckpoint,...options}={}){
  if(typeof durableCheckpoint!=='function')throw fail('DURABLE_STORE_REQUIRED','原生持久存储尚未恢复，不能发送本地同步指令。');
  if(!transport?.createControl)throw fail('NOT_READY','CFLOCAL2 传输模块未加载。');
  const control=transport.createControl({bridge,...options});
  const journal=new Journal(storage,uuid);let busy=false;const readEvents=new Map(),confirmed=new Map(),careConfirmed=new Map();
  async function checkpoint(raw){
    try{
      if(typeof globalThis.crypto?.subtle?.digest!=='function')throw Error('SHA-256 unavailable');
      const bytes=new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)));
      const expected=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
      const result=await durableCheckpoint(raw);
      if(result?.persisted!==true||result.journalSha256!==expected)throw Error('Native checkpoint not confirmed');
    }catch(error){throw fail('DURABLE_CHECKPOINT_FAILED','原生同步日志未确认保存；已保留原指令，请检查存储后显式重试。','unknown');}
  }
  function ready(){
    const s=control.getState();if(s.stage!=='ready_local'||s.hello?.protocol!=='CFLOCAL2')throw fail('NOT_READY','新本地协议尚未就绪。');
    const id=s.hello.deviceId;if(!/^[0-9a-f]{32}$/.test(id))throw fail('UNSUPPORTED_PROTOCOL','设备身份格式不符。');
    if(s.hello.clientId!==null&&s.hello.clientId!==journal.value.clientId)throw fail('OWNER_CONFLICT','吧唧已有另一份手机同步存档，不能覆盖。');
    const d=journal.device(id,s.hello);return {s,id,d};
  }
  async function exclusive(action){if(busy)throw fail('BUSY','上一条同步仍在确认。');busy=true;try{return await action();}finally{busy=false;}}
  async function sendPending(id,{fresh=false}={}){
    const p=journal.value.devices[id].pending;if(!p)throw fail('NO_PENDING','没有待确认指令。');
    const attempt=control.getState(),raw=journal.raw;
    await checkpoint(raw);
    const current=control.getState();
    if(current.stage!=='ready_local'||current.hello?.deviceId!==id||current.evidence?.generation!==attempt.evidence?.generation)
      throw fail('STALE_GENERATION','保存日志期间连接已变化；原指令未改，请明确连接原设备后重试。','unknown');
    let reply;
    try{reply=await control.request(p.op,clone(p.data),{id:p.id,clientId:journal.value.clientId,seq:p.seq});}
    catch(error){
      // Only an application rejection can prove no change. Native failures may
      // follow the final write, even if their platform error says no_change.
      // A rejection does not advance seq. Retain the recoverable Native intent
      // until the clear is itself durably committed; never drop it on I/O error.
      if(error.applicationRejected===true&&error.outcome==='no_change'){
        const next=clone(journal.value);next.devices[id].pending=null;
        await checkpoint(JSON.stringify(next));journal.write(next);
      }
      throw error;
    }
    if(reply?.data?.persisted!==true||reply.data.seq!==p.seq)throw fail('MALFORMED_FRAME','缺少设备持久确认。','unknown');
    if(p.op==='ack'&&current.hello.capabilities.includes('care_receipt_v1')){
      const terminal=reply.data.lastCareResult,r=p.data.receipt,expected=r.status==='duplicate'?r.originalStatus:r.status;
      if(!terminal||terminal.eventId!==p.data.eventId||terminal.counter!==p.data.counter||terminal.action!==p.eventAction||terminal.persisted!==true||terminal.status!==expected||terminal.reason!==r.reason||terminal.saveDigest!==r.saveDigest)throw fail('MALFORMED_FRAME','设备终态与原持久收据不一致，保留原指令。','unknown');
    }
    const next=clone(journal.value),d=next.devices[id];d.nextSeq=p.seq+1;
    if(p.op==='snapshot'){d.syncRevision=p.data.revision;d.lastSemantic=p.semantic;}d.pending=null;
    // Keep the exact original pending in RAM/Web Storage until Native confirms
    // the post-ACK state. A failed/unknown post checkpoint therefore retries
    // the same command, even if the device already committed it.
    await checkpoint(JSON.stringify(next));journal.write(next);
    if(p.op==='snapshot'){
      // Exact recovery proves the old durable snapshot only. The device may
      // have rebooted, so its old epoch must not satisfy this connection's
      // fresh-clock requirement or suppress the next current snapshot.
      const stillCurrent=control.getState();
      if(fresh&&stillCurrent.stage==='ready_local'&&stillCurrent.hello?.deviceId===id&&stillCurrent.evidence?.generation===attempt.evidence?.generation)
        confirmed.set(id,{generation:attempt.evidence?.generation,semantic:p.semantic,revision:p.data.revision,clock:p.data.epochMs!==undefined,petId:p.data.petId});
      else confirmed.delete(id);
    }
    if(p.op==='ack')readEvents.delete(p.data.eventId);
    return reply;
  }
  const scenes={
    pushScene(input){return exclusive(async()=>{
      validateScene(input);const {s,id,d}=ready();if(d.pending)throw fail('PENDING_UNKNOWN','上一条指令结果待确认，请显式重试。','unknown');
      if(['garden','town'].includes(input.scene)&&!s.hello.capabilities.includes('scene_places_v1'))throw fail('SCENE_UNAVAILABLE','此吧唧未声明小镇/花园区分能力。');
      const content=semantic(input);
      if(d.lastSemantic===content&&confirmed.get(id)?.generation===s.evidence?.generation&&confirmed.get(id)?.semantic===content&&(input.epochMs===undefined||confirmed.get(id)?.clock))return {status:'device_persisted',revision:d.syncRevision,duplicate:true};
      const revision=Math.max(d.syncRevision,s.device?.snapshot?.revision||0)+1;if(!safe(revision)||d.nextSeq>MAX)throw fail('SEQUENCE_EXHAUSTED','同步序号已用尽。');
      const data={petId:input.petId,revision,scene:input.scene,action:input.action,weather:input.weather,pet:petView(input.pet)};if(input.epochMs!==undefined){data.epochMs=input.epochMs;data.utcOffsetMinutes=offset(input);}
      journal.edit(v=>{v.devices[id].pending={id:input.requestId,seq:d.nextSeq,op:'snapshot',data,semantic:content};});
      const reply=await sendPending(id,{fresh:true});return {status:'device_persisted',revision,duplicate:reply.data.duplicate===true};
    });},
    retryPending(command){return exclusive(async()=>{if(command?.origin!=='explicit_user_action')throw fail('USER_ACTION_REQUIRED','请显式确认重试同步。');const {id}=ready();return sendPending(id);});},
    resumePending(connection){return exclusive(async()=>{
      const {s,id,d}=ready();
      if(connection?.deviceId!==id||connection.generation!==s.evidence?.generation)throw fail('STALE_GENERATION','原设备连接已变化，保留原指令。','unknown');
      if(!d.pending)throw fail('NO_PENDING','没有待恢复指令。');
      // Recovery reuses the exact Native-checkpointed id/seq/data. It never
      // creates a result, skips an event or turns a new connection into an ACK.
      return sendPending(id);
    });},
    getPending(){const {id}=ready();return clone(journal.value.devices[id].pending);}
  };
  async function confirmCare(s,id,d){
    if(!s.hello.capabilities.includes('care_bath_v1')||careConfirmed.get(id)===s.evidence?.generation)return;
    if(d.pending)throw fail('PENDING_UNKNOWN','原指令恢复后再启用清洁照料。','unknown');
    const support={careBathV1:true};
    if(s.hello.capabilities.includes('mobile_context_v1'))support.mobileContextV1=true;
    const confirmation=await control.request('care_capabilities',support,{clientId:journal.value.clientId});
    const c=confirmation?.data,after=control.getState();
    if(c?.careBathV1!==true||c.confirmed!==true||c.deviceId!==id||c.clientId!==journal.value.clientId||after.stage!=='ready_local'||after.hello?.deviceId!==id||after.evidence?.generation!==s.evidence?.generation||(support.mobileContextV1===true&&c.mobileContextV1!==true))throw fail('CARE_CONFIRMATION_FAILED','清洁与手机信息支持暂未就绪，设备事件仍保留。');
    careConfirmed.set(id,s.evidence.generation);
  }
  const events={
    async readNext(){
      const {s,id,d}=ready();
      await confirmCare(s,id,d);
      let r=await control.request('events');
      if(r?.data?.blocked?.reason==='care_bath_confirmation_required'&&s.hello.capabilities.includes('care_bath_v1')){
        // Firmware's actual gate wins over a RAM capability cache. Re-negotiate
        // this same verified owner once, then read the unchanged FIFO head.
        console.info('[CFLOCAL2] care_gate_reconfirm');careConfirmed.delete(id);const current=ready();
        if(current.id!==id||current.s.evidence?.generation!==s.evidence?.generation)throw fail('STALE_GENERATION','连接已变化，设备事件仍保留。');
        await confirmCare(current.s,id,current.d);r=await control.request('events');
      }
      if(r?.data?.blocked)throw fail('CARE_CONFIRMATION_REQUIRED','清洁支持暂未就绪，设备事件已保留。');
      const e=r?.data?.event;
      if(e===null)return null;
      if(!e||e.source!=='native_device'||e.protocol!=='CFLOCAL2'||e.deviceId!==id||!safe(e.counter)||e.counter<1||e.eventId!==id+':'+e.counter||!ascii(e.petId,64)||!['care','gift'].includes(e.kind)||(e.occurredAtMs!==null&&!safe(e.occurredAtMs)))throw fail('MALFORMED_FRAME','设备事件不完整，未确认删除。');
      if(e.kind==='care'&&!ACTIONS.includes(e.action))throw fail('MALFORMED_FRAME','未知照料事件。');
      if(e.kind==='gift'&&(!/^[0-9a-f]{32}$/.test(e.peerId)||!safe(e.peerCounter)||e.peerCounter<1||e.giftId!=='flower'||e.quantity!==1||typeof e.peerComplete!=='boolean'))throw fail('MALFORMED_FRAME','礼物收据不完整。');
      readEvents.set(e.eventId,{id,counter:e.counter,petId:e.petId,action:e.kind==='care'?e.action:'idle'});return clone(e);
    },
    acknowledge(receipt){return exclusive(async()=>{
      const {s,id,d}=ready();const e=readEvents.get(receipt?.eventId);
      if(!e||e.id!==id||receipt.persisted!==true||!['applied','rejected','duplicate','quarantined'].includes(receipt.status)||!/^[0-9a-f]{64}$/.test(receipt.saveDigest))throw fail('DURABLE_RECEIPT_REQUIRED','原存档持久提交后才能确认事件。');
      if(d.pending)throw fail('PENDING_UNKNOWN','上一条指令尚待确认。','unknown');
      const requestId=uuid();if(!ascii(requestId,64))throw fail('INVALID_REQUEST','无法建立事件确认标识。');
      const data={counter:e.counter,eventId:receipt.eventId,receipt:{status:receipt.status,persisted:true,saveDigest:receipt.saveDigest}};
      if(s.hello.capabilities.includes('care_receipt_v1')){
        const original=receipt.status==='duplicate'?receipt.originalStatus:receipt.status;
        if(!['applied','rejected','quarantined'].includes(original)||!/^[a-z0-9_]{1,40}$/.test(receipt.reason)||(original==='applied')!==(receipt.reason==='none'))throw fail('DURABLE_RECEIPT_REQUIRED','确认缺少原持久终态/原因。');
        data.receipt.reason=receipt.reason;if(receipt.status==='duplicate')data.receipt.originalStatus=original;
      }else if(receipt.status==='rejected')throw fail('RECEIPT_UPGRADE_REQUIRED','当前固件不支持终态拒绝，保留事件等待匹配固件。');
      journal.edit(v=>{v.devices[id].pending={id:requestId,seq:d.nextSeq,op:'ack',data,eventAction:e.action};});await sendPending(id);readEvents.delete(receipt.eventId);return {status:'device_persisted',eventId:receipt.eventId};
    });}
  };
  // Additive volatile display only: no journal edit, checkpoint, mutation seq or ACK.
  const display={pushDay(input){return exclusive(async()=>{
    const {s,id,d}=ready(),generation=s.evidence?.generation;
    if(!s.hello.capabilities.includes('day_view'))throw fail('DAY_UNAVAILABLE','此固件尚未提供一天圆环展示。');
    if(d.pending)throw fail('PENDING_UNKNOWN','先确认上一条同步，再传一天展示。');
    const binding=confirmed.get(id);
    if(!binding||binding.generation!==generation||!binding.petId||input?.petId!==binding.petId)throw fail('DAY_BINDING_REQUIRED','当前小猫场景确认后才能发送一天展示。');
    if(input.schema!==1||!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||!Number.isInteger(input.zone)||Math.abs(input.zone)>840||!Number.isInteger(input.cutoff)||input.cutoff<0||input.cutoff>1440||!['demo','automatic'].includes(input.mode)||!Array.isArray(input.segments))throw fail('INVALID_DAY','一天记录格式无效。');
    if(input.segments.length>96)throw fail('TOO_MANY_DAY_SEGMENTS','今天超过96段，未截断发送。');
    let end=0;
    for(const row of input.segments){if(!Array.isArray(row)||row.length!==5||row.some(n=>!Number.isInteger(n))||row[0]<end||row[0]<0||row[1]<=row[0]||row[1]>input.cutoff||row[2]<0||row[2]>6||row[3]<0||row[3]>2||row[4]<0||row[4]>7||(input.mode==='demo'&&row[3]!==2))throw fail('INVALID_DAY','一天记录的时间或来源无效。');end=row[1];}
    const transfer=uuid(),parts=Math.max(1,Math.ceil(input.segments.length/16));
    if(!/^[0-9a-f-]{36}$/i.test(transfer))throw fail('INVALID_REQUEST','无法建立一天展示标识。');
    /* 心动标记可选：仅当固件声明 day_hearts_v1 时随第一片发送，不改变既有一天资料语义。 */
    let hearts=null;
    if(input.hearts!==undefined){
      if(!Array.isArray(input.hearts)||input.hearts.length>12)throw fail('INVALID_DAY','心动标记格式无效。');
      let last=-1;
      for(const m of input.hearts){if(!Number.isInteger(m)||m<0||m>input.cutoff||m<last)throw fail('INVALID_DAY','心动标记的时间无效。');last=m;}
      if(s.hello.capabilities.includes('day_hearts_v1'))hearts=input.hearts.slice();
    }
    for(let part=0;part<parts;part++){
      const current=control.getState();
      if(current.stage!=='ready_local'||current.hello?.deviceId!==id||current.evidence?.generation!==generation)throw fail('STALE_GENERATION','连接已变化，一天展示尚未确认。');
      const data={schema:1,transfer,date:input.date,zone:input.zone,cutoff:input.cutoff,mode:input.mode,clientId:journal.value.clientId,petId:input.petId,part,parts,segments:input.segments.slice(part*16,(part+1)*16)};
      if(hearts&&part===0)data.hearts=hearts;
      const reply=await control.request('day',data),a=reply?.data,after=control.getState();
      if(after.stage!=='ready_local'||after.hello?.deviceId!==id||after.evidence?.generation!==generation)throw fail('STALE_GENERATION','一天展示读回已过期。');
      if(a?.accepted!==true||a.volatile!==true||a.complete!==(part===parts-1)||a.part!==part||a.date!==input.date||a.count!==Math.min(input.segments.length,(part+1)*16))throw fail('MALFORMED_FRAME','一天展示未收到完整RAM接收确认。');
    }
    return {status:'display_received',volatile:true,date:input.date,count:input.segments.length};
  });}};
  const ports={control,scenes,events,display};active={control};return ports;
}
return {createPorts,receive(input){active?.control.receive(input);},validateScene,KEY};
});
