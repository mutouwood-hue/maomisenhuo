/* Embedded into the original vu closure by build_assets. No persistence or clocks are invented. */
function __hostInstallCareRuntime(api,{identity,read,replace,clock,cooldowns,activeCatId,keys,hydrate,seed}){
  let owner=null;
  const fail=message=>Object.assign(new Error(message),{code:'CARE_RUNTIME_INVALID'});
  const runtime=()=>({schema:1,identity:identity(),cooldowns:{...read()}});
  function validate(value){
    if(value?.schema!==1||value.identity!==identity()||!value.cooldowns||typeof value.cooldowns!=='object'||Array.isArray(value.cooldowns))throw fail('照料会话上下文与当前原存档不符。');
    const allowed=new Set(keys()),entries=Object.entries(value.cooldowns);
    if(entries.length>allowed.size||entries.some(([k,v])=>!allowed.has(k)||!Number.isSafeInteger(v)||v<0))throw fail('照料会话冷却记录无效。');
    return {...value.cooldowns};
  }
  const originalImport=hydrate,originalFlush=api.flush;
  if(seed!==undefined)replace(validate(seed));
  // Guard every original public write, including reset/tick/socialGrant and future additions.
  for(const [name,fn]of Object.entries(api))if(typeof fn==='function'&&!['getState','exportSave'].includes(name)){
    api[name]=(...args)=>owner?{ok:false,code:'CARE_RUNTIME_BUSY',action:name,message:'设备结果正在保存，请稍后再操作。'}:fn(...args);
  }
  api.hostReadCareRuntime=runtime;
  api.hostCareRuntimeBusy=()=>owner!==null;
  api.hostCareDelay=action=>{
    const last=read()[activeCatId()+':'+action];
    return last===undefined?0:Math.max(0,(cooldowns[action]||0)-(clock()-last));
  };
  api.hostFreezeDeviceResult=()=>{
    if(owner)throw Object.assign(Error('设备结果正在保存，请稍后再操作。'),{code:'CARE_RUNTIME_BUSY'});
    const token={};owner=token;
    const owned=()=>{if(owner!==token)throw Object.assign(Error('设备结果存储通道已释放。'),{code:'CARE_RUNTIME_STALE'});};
    return Object.freeze({
      flush(){owned();return originalFlush();},
      hydrateDevice(raw,context){
        owned();const next=validate(context);let result;
        try{result=originalImport(raw);}catch(e){replace(next);throw e;}
        if(result.ok){replace(validate({...context,cooldowns:next}));}
        return result;
      },
      importSave(raw){owned();return originalImport(raw);},
      release(){if(owner===token)owner=null;}
    });
  };
  return api;
}
// END EMBEDDED INSTALL
if(typeof module==='object'&&module.exports)module.exports=__hostInstallCareRuntime;
