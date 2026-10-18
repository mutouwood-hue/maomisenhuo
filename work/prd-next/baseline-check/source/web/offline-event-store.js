/* A write-ahead decision log. Recovery runs before any original game scripts. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {
    root.CatOfflineEventStore=api;
    try {
      const storage=root.localStorage,proto=root.Storage.prototype;
      const get=proto.getItem,set=proto.setItem,remove=proto.removeItem;
      const io={getItem:k=>get.call(storage,k),setItem:(k,v)=>set.call(storage,k,v)};
      const store=api.createStore(io);root.CatOfflineEventLedger=store;root.CatOfflineEventRawStorage=io;
      const guard=k=>{if(api.MANAGED.includes(String(k))){if(root.CatOfflineEventStorageError)throw root.CatOfflineEventStorageError;if(root.CatOfflineDurable?.required){root.CatOfflineDurable.assertHealthy();if(root.CatOfflineDurable.eventLocked)throw Error('设备结果正在持久提交，暂停其他写入。');}root.CatOfflineEventLedger.assertHealthy();}};
      proto.setItem=function(k,v){if(this===storage)guard(k);return set.call(this,k,v);};
      proto.removeItem=function(k){if(this===storage)guard(k);return remove.call(this,k);};
      store.recover();
      // The prototype social loader silently replaces malformed JSON with its
      // defaults. Detect it before that loader runs and preserve those bytes.
      const rawSocial=io.getItem(api.SOCIAL);
      if(rawSocial!==null){const d=JSON.parse(rawSocial);if(d?.v!==1||!d.dex||!d.gifts||!d.friends||!Array.isArray(d.gifts.inbox)||!Array.isArray(d.gifts.log))throw Error('社交原存档损坏；已阻止默认值覆盖，请导出原文或恢复有效完整备份。');}
    } catch(error){root.CatOfflineEventStorageError=Object.assign(new Error('本地事件或社交存档无法读取，已保留原文并暂停写入。请导出原文备份，再恢复有效完整备份。'),{code:'EVENT_STORAGE_UNSAFE',cause:error});}
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KEY='cat-cflocal2-event-ledger-v1',GAME='pixel-cat-pet-v1',SOCIAL='pg-social-v1';
  const IDENTITY='cat-cflocal2-source-identities-v1',JOURNAL='cat-cflocal2-journal-v1';
  const MANAGED=[GAME,SOCIAL,IDENTITY,JOURNAL],LIMIT=4096;
  const copy=x=>JSON.parse(JSON.stringify(x));
  const error=message=>Object.assign(new Error(message),{code:'EVENT_STORAGE_UNSAFE'});
  function canonical(value){
    if(value===null||typeof value!=='object')return JSON.stringify(value);
    if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
    return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  }
  // Synchronous SHA-256 keeps exportSave's original string ABI and permits a
  // complete backup association before a native file-save request starts.
  const primes=[];for(let n=2;primes.length<64;n++)if(!primes.some(p=>p*p<=n&&n%p===0))primes.push(n);
  const initial=primes.slice(0,8).map(p=>(Math.sqrt(p)%1*0x100000000)>>>0),rounds=primes.map(p=>(Math.cbrt(p)%1*0x100000000)>>>0);
  const rotate=(x,n)=>x>>>n|x<<32-n;
  function sha256(text){
    const bytes=new TextEncoder().encode(text),size=Math.ceil((bytes.length+9)/64)*64,padded=new Uint8Array(size),view=new DataView(padded.buffer);
    padded.set(bytes);padded[bytes.length]=128;view.setUint32(size-8,Math.floor(bytes.length/0x20000000));view.setUint32(size-4,bytes.length*8);
    const h=initial.slice(),w=new Uint32Array(64);
    for(let start=0;start<size;start+=64){
      for(let i=0;i<16;i++)w[i]=view.getUint32(start+i*4);
      for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2];w[i]=(w[i-16]+(rotate(x,7)^rotate(x,18)^x>>>3)+w[i-7]+(rotate(y,17)^rotate(y,19)^y>>>10))>>>0;}
      let[a,b,c,d,e,f,g,k]=h;
      for(let i=0;i<64;i++){const t1=(k+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+rounds[i]+w[i])>>>0,t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0;k=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
      [a,b,c,d,e,f,g,k].forEach((x,i)=>{h[i]=(h[i]+x)>>>0;});
    }
    return h.map(x=>x.toString(16).padStart(8,'0')).join('');
  }
  function validate(value){
    if(value?.schema!==1||!value.records||typeof value.records!=='object'||Array.isArray(value.records)||Object.keys(value.records).length>LIMIT||!Array.isArray(value.isolated)||value.isolated.length>128)throw error('事件结果记录损坏或版本不支持，已保留原内容。');
    for(const [id,r] of Object.entries(value.records)){
      if(!/^[0-9a-f]{32}:[1-9][0-9]*$/.test(id)||r?.event?.eventId!==id||!['applied','rejected','quarantined'].includes(r.status)||r.fingerprint!==canonical(r.event)||!/^[0-9a-f]{64}$/.test(r.saveDigest)||typeof r.identity!=='string'||typeof r.message!=='string')throw error('事件去重记录无效，未重置水位。');
      if(r.reason!==undefined&&(!/^[a-z0-9_]{1,40}$/.test(r.reason)||(r.status==='applied')!==(r.reason==='none'))||r.status==='rejected'&&r.reason===undefined)throw error('事件终态原因无效，未重置水位。');
    }
    if(value.pending!==null){
      const p=value.pending;
      if(!p||!['event','restore'].includes(p.kind)||!Array.isArray(p.images)||!p.images.length||p.images.length>4||new Set(p.images.map(x=>x.key)).size!==p.images.length)throw error('事件恢复日志无效。');
      for(const x of p.images){
        if(!MANAGED.includes(x.key)||(x.before!==null&&typeof x.before!=='string')||typeof x.after!=='string')throw error('事件恢复镜像无效。');
        let after;try{after=JSON.parse(x.after);}catch{throw error('事件恢复镜像不是有效存档。');}
        if(!after||typeof after!=='object'||Array.isArray(after)||(x.key===GAME&&(after.version!==2||!Array.isArray(after.cats)))||(x.key===SOCIAL&&(after.v!==1||!after.dex||!after.gifts))||([IDENTITY,JOURNAL].includes(x.key)&&after.schema!==1))throw error('事件恢复镜像格式无效。');
      }
      if(p.kind==='event'&&!value.records[p.eventId])throw error('事件恢复缺少提交收据。');
    }
    return value;
  }
  function createStore(storage,{fault=()=>{}}={}){
    let blocked=null,loaded=false,value,rawSeen;
    function assertHealthy(){if(blocked)throw blocked;}
    function load(){
      assertHealthy();
      if(loaded)return value;
      try {const raw=storage.getItem(KEY);value=raw===null?{schema:1,records:{},isolated:[],pending:null}:validate(JSON.parse(raw));rawSeen=raw;loaded=true;return value;}
      catch(e){blocked=error('无法读取事件事务记录，暂停游戏写入与设备确认。'+e.message);throw blocked;}
    }
    function write(next){
      validate(next);const raw=JSON.stringify(next);
      if(raw.length>4_000_000)throw error('事件事务备份已满，请先导出备份；没有删除去重记录。');
      storage.setItem(KEY,raw);if(storage.getItem(KEY)!==raw)throw error('事件事务写入未确认。');
      value=copy(next);rawSeen=raw;loaded=true;
    }
    function settle(){
      const p=load().pending;if(!p)return;
      try {
        // Validate all keys before the first roll-forward write. A changed key
        // means another writer bypassed the guard; never overwrite that state.
        for(const x of p.images){const raw=storage.getItem(x.key);if(raw!==x.before&&raw!==x.after)throw error('原存档在事务未完成时被其他窗口改变；暂停恢复，未覆盖。');}
        for(const [i,x] of p.images.entries()){
          storage.setItem(x.key,x.after);if(storage.getItem(x.key)!==x.after)throw error('原存档提交未确认。');fault('image:'+i);
        }
        fault('before-finalize');const next=copy(value);next.pending=null;write(next);fault('finalized');
      }catch(e){blocked=error('事件提交结果待恢复，请重新打开应用；设备事件尚未确认。'+e.message);throw blocked;}
    }
    function decision({event,identity,status,reason,message,saveDigest,images,token}){
      const next=copy(value),record={event:copy(event),fingerprint:canonical(event),identity,status,message,saveDigest};if(reason!==undefined)record.reason=reason;
      next.records[event.eventId]=record;next.pending=null;if(token)next.commitToken=token;validate(next);
      return {record,next};
    }
    return {
      assertHealthy(){assertHealthy();load();if(storage.getItem(KEY)!==rawSeen){blocked=error('另一页面更新了事件记录，请重新打开此页面；未覆盖新结果。');throw blocked;}if(value.pending)throw error('事件事务尚未恢复，暂停后续写入。');},
      recover(){load();settle();return copy(value);},
      snapshot(){this.assertHealthy();return copy(value);},
      find(event){this.assertHealthy();const r=value.records[event.eventId];if(r&&r.fingerprint!==canonical(event))throw error('同一事件编号内容发生变化，已停止确认。');return r?copy(r):null;},
      isolate(event,reason){this.assertHealthy();if(value.isolated.some(x=>x.event.eventId===event.eventId))return;
        if(value.isolated.length>=128)throw error('待隔离事件记录已满，未确认设备队列。');
        const next=copy(value);next.isolated.push({event:copy(event),reason:String(reason)});
        try{write(next);}catch(e){blocked=error('隔离记录未确认保存，设备事件保留。'+e.message);throw blocked;}
      },
      preview(input){this.assertHealthy();if(Object.keys(value.records).length>=LIMIT)throw error('事件去重记录已满，未删除旧记录。');return copy(decision(input));},
      commit({event,identity,status,reason,message,saveDigest,images,token}){
        this.assertHealthy();const duplicate=this.find(event);if(duplicate)return duplicate;
        if(Object.keys(value.records).length>=LIMIT)throw error('事件去重记录已满，未删除旧记录或确认新事件。');
        const {next,record}=decision({event,identity,status,reason,message,saveDigest,images,token});next.pending={kind:'event',eventId:event.eventId,images:copy(images)};
        for(const x of images)if(storage.getItem(x.key)!==x.before)throw error('手机进度已变化，稍后重新结算事件。');
        try{fault('before-prepare');write(next);fault('prepared');settle();return copy(record);}
        catch(e){blocked=error('事件事务结果未确认，请重新打开应用恢复；设备事件保留。'+e.message);throw blocked;}
      },
      previewRestore({records,isolated=[],token}){
        this.assertHealthy();const next=copy(value);
        for(const [id,r] of Object.entries(records||{})){
          const old=next.records[id];if(old&&canonical(old)!==canonical(r))throw error('备份与本机事件收据冲突，未导入。');next.records[id]=copy(r);
        }
        const ids=new Set(next.isolated.map(x=>x.event.eventId));for(const x of isolated)if(!ids.has(x.event.eventId)){next.isolated.push(copy(x));ids.add(x.event.eventId);}
        next.pending=null;if(token)next.commitToken=token;validate(next);return copy(next);
      },
      restore({images,records,isolated=[],token}){
        const next=this.previewRestore({records,isolated,token});
        next.pending={kind:'restore',images:copy(images)};validate(next);
        for(const x of images)if(storage.getItem(x.key)!==x.before)throw error('导入期间手机进度变化，未覆盖。');
        try{write(next);fault('restore-prepared');settle();}catch(e){blocked=error('备份导入待恢复，请重新打开应用。'+e.message);throw blocked;}
      }
    };
  }
  return {createStore,KEY,GAME,SOCIAL,IDENTITY,JOURNAL,MANAGED,canonical,sha256};
});
