/* Explicit read-only device observations. No save/journal/queue/reward writer. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CatOfflineDeviceDiagnostics=api;})(typeof globalThis==='undefined'?this:globalThis,function(){
 'use strict';
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k),copy=o=>JSON.parse(JSON.stringify(o)),safe=n=>Number.isSafeInteger(n)&&n>=0;
 const error=(code,message)=>Object.assign(Error(message),{code});
 const fields=[['deviceId','设备 ID'],['clientId','本地客户端 ID'],['lastSeq','设备已处理指令序号'],['lastAck','设备已确认事件水位'],['pending','设备待确认事件数'],['storageError','设备存储错误'],['hasSnapshot','设备已有场景快照']];
 const snapshotFields=[['petId','快照猫 ID'],['revision','快照版本'],['scene','快照场景'],['action','快照动作'],['weather','快照天气']];
 function project(data,id){
  if(!data||typeof data!=='object'||Array.isArray(data)||data.deviceId!==id)throw error('MALFORMED_STATE','设备响应身份不一致，未采纳诊断结果。');
  const out={},ascii=v=>typeof v==='string'&&v.length>0&&v.length<=64&&/^[\x20-\x7e]+$/.test(v);
  const validators={deviceId:v=>v===id,clientId:v=>v===null||ascii(v),lastSeq:safe,lastAck:safe,pending:safe,storageError:v=>typeof v==='boolean',hasSnapshot:v=>typeof v==='boolean'};
  for(const [k]of fields)if(own(data,k)){if(!validators[k](data[k]))throw error('MALFORMED_STATE','设备诊断字段无效，未采纳结果。');out[k]=data[k];}
  if(data.snapshot!==null&&own(data,'snapshot')){
   const raw=data.snapshot;if(!raw||typeof raw!=='object'||Array.isArray(raw))throw error('MALFORMED_STATE','设备快照摘要无效。');
   const validators={petId:ascii,revision:safe,scene:v=>['home','departing','away','returning','garden','town'].includes(v),action:v=>['idle','walk','pet','feed','water','bath','play','sleep'].includes(v),weather:v=>['clear','rain','snow'].includes(v)};out.snapshot={};
   for(const [k]of snapshotFields)if(own(raw,k)){if(!validators[k](raw[k]))throw error('MALFORMED_STATE','设备快照摘要字段无效。');out.snapshot[k]=raw[k];}
  }else if(data.snapshot===null)out.snapshot=null;
  if(own(data,'lastCareResult')){const result=data.lastCareResult;if(result===null)out.lastCareResult=null;else{
   const terminal={};if(!result||!safe(result.counter)||result.counter<1||result.eventId!==id+':'+result.counter||!['applied','rejected','quarantined'].includes(result.status)||!/^[a-z0-9_]{1,40}$/.test(result.reason)||!/^[0-9a-f]{64}$/.test(result.saveDigest)||!['idle','pet','feed','water','play','sleep'].includes(result.action)||result.persisted!==true)throw error('MALFORMED_STATE','设备终态收据无效。');
   for(const k of['eventId','counter','action','status','reason','saveDigest','persisted'])terminal[k]=result[k];out.lastCareResult=terminal;
  }}return out;
 }
 function createReader({getContext,read,now=()=>Date.now(),onChange=()=>{}}){
  let observation=null,busy=false,message='尚未读取设备详情。',fingerprint=null,epoch=0,expired=true,disposed=false;
  function context(){const c=getContext()||{},s=c.state,h=s?.hello,e=s?.evidence;const active=!disposed&&c.mode==='cflocal2'&&c.foreground===true&&c.verified===true&&s?.stage==='ready_local'&&h?.protocol==='CFLOCAL2'&&/^[0-9a-f]{32}$/.test(h.deviceId)&&safe(e?.generation);return{...c,active,id:h?.deviceId,generation:e?.generation};}
  function observe(){const c=context(),next=JSON.stringify([c.mode,c.foreground,c.active,c.active?c.id:null,c.active?c.generation:null]);if(next!==fingerprint){fingerprint=next;epoch++;if(observation)expired=true;}return c;}
  function state(){const c=observe();return{busy,active:c.active,linkStage:c.state?.stage||'unavailable',foreground:c.foreground===true,mode:c.mode,observation:observation?copy(observation):null,expired:observation?expired:true,message,currentGeneration:c.active?c.generation:null};}
  return{
   getState:state,
   async refresh(){
    const c=observe();if(busy)throw error('BUSY','正在读取，请稍后再试。');if(!c.active)throw error('NOT_CONNECTED','请先在前台明确连接新本地吧唧。');
    const atEpoch=epoch,start=now(),hello={protocol:c.state.hello.protocol,deviceId:c.id,capabilities:Array.isArray(c.state.hello.capabilities)?c.state.hello.capabilities.filter(v=>typeof v==='string'&&v.length<=32).slice(0,16):[]};
    busy=true;message='正在读取设备状态…';onChange();
    try{
     const reply=await read();const latest=observe();
     if(disposed||!latest.active||epoch!==atEpoch||latest.id!==c.id||latest.generation!==c.generation||reply?.generation!==c.generation)throw error('STALE_GENERATION','连接已变化，本次读回已过期，未作为当前结果。');
     if(reply?.ok!==true||reply.op!=='state'||reply.gattWriteCompleted!==true)throw error('MALFORMED_STATE','未收到完整设备状态响应。');
     const data=project(reply.data,c.id);observation={source:'CFLOCAL2 readDeviceState response',readStartedAtMs:start,readCompletedAtMs:now(),readTimeSource:'phone_Date.now',generation:c.generation,hello,device:data,clock:{status:'not_provided_by_ble'}};expired=false;message='已读回本次连接的设备状态。';return copy(observation);
    }catch(e){if(observation)expired=true;message=e?.code==='BUSY'?'正在同步或结算，请稍后手动刷新。':e?.code==='STALE_GENERATION'?'连接已变化，本次读回已过期，未作为当前结果。':String(e?.message||'读取未完成，请稍后手动重试。').slice(0,180);throw e;}
    finally{busy=false;if(!disposed)onChange();}
   },
   exportObject(){const s=state();if(busy||!observation)throw error('NOT_READY','请先完成一次设备详情读取。');return{schema:'catforest-local-device-diagnostics-v1',exportedAtMs:now(),validity:s.expired?'expired_connection_observation':'same_connection_observation',currentConnection:{verified:s.active,transportStage:s.linkStage,foreground:s.foreground,generation:s.currentGeneration},observation:copy(observation),limits:['设备字段仅代表读取完成时；后续动作需手动刷新。','当前BLE未提供clockValid/now，不能据场景同步推定校时已验证。','lastAck是设备事件水位，不单独证明某条奖励或物理掉电恢复。']};},
   dispose(){disposed=true;epoch++;expired=true;}
  };
 }
 function mount({root,panel,getContext,read}){
  const d=root.document,details=d.createElement('details');details.id='offline-device-diagnostics';const summary=d.createElement('summary');summary.textContent='连接详情与本地诊断';details.append(summary);
  const note=d.createElement('p');note.className='offline-diag-note';note.textContent='只在点击刷新时读取设备。结果仅代表读取完成时，后续动作需再刷新；不自动重连或确认事件。事件水位不单独证明奖励已发放，具体结果看上方真实事件提示。';details.append(note);
  const status=d.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');details.append(status);
  const actions=d.createElement('div');actions.className='offline-diag-actions';const refresh=d.createElement('button'),save=d.createElement('button');for(const b of [refresh,save]){b.type='button';b.className='g-btn ghost';}refresh.id='offline-diag-refresh';refresh.textContent='刷新连接详情';save.id='offline-diag-export';save.textContent='导出本地诊断 JSON';actions.append(refresh,save);details.append(actions);
  const content=d.createElement('div');content.className='offline-diag-content';details.append(content);panel.append(details);let exportMessage='';
  const reader=createReader({getContext,read,onChange:render});
  const names={scene:{home:'在家',departing:'准备出门',away:'在外出游',returning:'回家途中',garden:'庭院',town:'小镇'},action:{idle:'休息',walk:'走动',pet:'摸摸',feed:'吃饭',water:'喝水',bath:'洗澡',play:'玩耍',sleep:'睡觉'},weather:{clear:'晴天',rain:'下雨',snow:'下雪'}};
  const shown=(v,key)=>names[key]?.[v]?names[key][v]+'（'+v+'）':v===null?'未绑定（null）':typeof v==='boolean'?(v?'是':'否'):String(v);
  function rows(title,values,names){const heading=d.createElement('h4');heading.textContent=title;const dl=d.createElement('dl');for(const [key,label]of names){const dt=d.createElement('dt'),dd=d.createElement('dd');dt.textContent=label;dd.textContent=own(values,key)?shown(values[key],key):'未提供';dl.append(dt,dd);}content.append(heading,dl);}
  function render(){const s=reader.getState(),obs=s.observation;const link=s.active?'真实新本地握手已核对':!s.foreground?'应用在后台，连接已暂停':['connecting','discovering','subscribing','handshaking'].includes(s.linkStage)?'正在连接或握手，尚未就绪':'当前没有已核实的新本地连接';status.textContent=link+'。'+(obs?(s.expired?'上次读回已过期。':'以下是本次连接的读回快照，并非实时。'):'')+(s.active?s.message:s.busy?'连接已变化，等待本次读取结束。':obs?'保留上次读取记录供核对。':s.message)+(exportMessage?' '+exportMessage:'');refresh.disabled=s.busy||!s.active;save.disabled=s.busy||!obs;content.replaceChildren();
   if(obs){rows('实际读取记录',{completed:new Date(obs.readCompletedAtMs).toISOString(),generation:obs.generation,validity:s.expired?'已过期':'属于本次连接（非实时）'},[['completed','手机读取完成时间（UTC）'],['generation','本次读取 generation'],['validity','结果有效性']]);rows('来源：读取时的 HELLO 握手',{...obs.hello,capabilities:obs.hello.capabilities.join('、')},[['protocol','协议'],['deviceId','握手设备 ID'],['capabilities','声明能力（不等于全部实测通过）']]);rows('来源：设备 state 响应',obs.device,fields);rows('设备快照摘要',obs.device.snapshot,snapshotFields);if(obs.device.lastCareResult)rows('设备持久照料终态',obs.device.lastCareResult,[['eventId','唯一事件ID'],['counter','事件序号'],['action','动作'],['status','原终态'],['reason','原原因'],['saveDigest','手机结果摘要'],['persisted','设备已保存该收据']]);}
   rows('校时可观测性',{clock:'当前 BLE 未提供 clockValid / now，尚不能核实校时。'},[['clock','设备时钟']]);
  }
  async function doRefresh(){exportMessage='';try{await reader.refresh();}catch{}render();}
  function doSave(){try{const report=reader.exportObject(),text=JSON.stringify(report,null,2)+'\n',name='catforest-device-diagnostics-'+new Date(report.exportedAtMs).toISOString().replace(/[:.]/g,'-')+'.json';
    if(root.CatOfflineNative?.exportSave){root.CatOfflineNative.exportSave(name,text);exportMessage='已请求本机保存位置；请在系统窗口确认保存。';}
    else{const url=root.URL.createObjectURL(new root.Blob([text],{type:'application/json;charset=utf-8'})),a=d.createElement('a');a.href=url;a.download=name;details.append(a);a.click();a.remove();root.setTimeout(()=>root.URL.revokeObjectURL(url),30000);exportMessage='已交给浏览器本地下载。';}
   }catch{exportMessage='导出尚未完成，请先读取设备详情后重试。';}render();}
  refresh.addEventListener('click',doRefresh);save.addEventListener('click',doSave);render();
  return{update:render,dispose(){reader.dispose();refresh.removeEventListener('click',doRefresh);save.removeEventListener('click',doSave);}};
 }
 return{createReader,project,mount};
});
