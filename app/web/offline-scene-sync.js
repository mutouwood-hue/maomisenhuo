/* Host scene orchestration. Original HTML remains the only game/save writer. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.CatOfflineSceneSync=api.mount(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const USER={origin:'explicit_user_action'};
  function verifiedLink(state){
    const e=state?.evidence,h=state?.hello;
    return state?.stage==='ready_local'&&e?.source==='native'&&Number.isSafeInteger(e.generation)&&
      ['serviceVerified','rxVerified','txVerified','subscribed'].every(k=>e[k]===true)&&
      h?.protocol==='CFLOCAL2'&&/^[0-9a-f]{32}$/.test(h.deviceId)&&h.maxLine===2048&&
      ['scene','snapshot'].every(k=>h.capabilities?.includes(k)&&state.capabilities?.[k]==='declared')&&
      state.device?.deviceId===h.deviceId;
  }
  function createCoordinator({ports,read,consumeEvent=null,readDay=null,validatePending=()=>{},onChange=()=>{},uuid=()=>crypto.randomUUID(),now=()=>Date.now(),offset=()=>-new Date().getTimezoneOffset(),schedule=fn=>setTimeout(fn,50),cancel=id=>clearTimeout(id)}){
    let enabled=false,foreground=true,authorized=null,flight=null,ack=null,halt=null,timer=null,disposed=false;
    let lastEventsAt=-Infinity,lastDayAt=-Infinity,dayAck=null;
    let dayStatus={stage:'waiting',message:'一天圆环等待当前场景确认。'};
    let status={stage:'disconnected',message:'明确连接后，将同步手机当前小猫场景。',pending:false};
    const state=()=>ports.control.getState();
    const key=()=>{const s=state();return verifiedLink(s)?s.hello.deviceId+':'+s.evidence.generation:null;};
    const valid=()=>!disposed&&enabled&&foreground&&authorized!==null&&authorized===key();
    const publish=(stage,message,pending=false,revision=null)=>{
      const next={stage,message,pending,revision};
      if(JSON.stringify(status)!==JSON.stringify(next)){status=next;onChange({...status});}
    };
    const sample=()=>{const s=state();const value=read({deviceId:s.hello?.deviceId,hasSnapshot:s.device?.hasSnapshot===true,snapshotPetId:s.device?.snapshot?.petId,capabilities:s.hello?.capabilities});if(!value)return null;const zone=offset();return {value,zone,signature:JSON.stringify({value,zone})};};
    const pending=()=>ports.scenes.getPending();
    function signal(){if(valid()&&timer===null)timer=schedule(()=>{timer=null;void pump();});}
    function block(error){halt=error;publish('error',error.message||'场景同步尚未确认，请重试。',Boolean(error.pending));}
    async function pushDay(current){
      if(!readDay||!ports.display||!valid()||flight||!ack||ack.key!==authorized||ack.signature!==current.signature)return;
      if(!state().hello.capabilities.includes('day_view')){const message='此固件未提供一天圆环展示。';if(dayStatus.message!==message){dayStatus={stage:'unavailable',message};onChange({...status});}return;}
      if(now()-lastDayAt<60000)return;
      let projection,signature;
      try{projection=readDay(current.value.petId);signature=JSON.stringify(projection);}catch(error){lastDayAt=now();dayStatus={stage:'error',message:error.message};onChange({...status});return;}
      if(dayAck?.key===authorized&&dayAck.signature===signature)return;
      const operation={key:authorized,kind:'day'};flight=operation;lastDayAt=now();
      dayStatus={stage:'sending',message:'正在发送今天的圆环展示…'};onChange({...status});
      try{
        await ports.display.pushDay(projection);
        if(valid()&&authorized===operation.key){dayAck={key:authorized,signature};dayStatus={stage:'received',message:`${projection.mode==='demo'?'演示':'今日'}圆环已接收 · ${projection.segments.length}段 · 仅存吧唧RAM，重启后需重发。`};}
      }catch(error){if(valid()&&authorized===operation.key)dayStatus={stage:'error',message:'一天圆环尚未确认：'+(error.message||'请稍后重试。')};}
      finally{if(flight===operation)flight=null;onChange({...status});}
    }
    async function pump(){
      if(!valid()||flight)return;
      if(halt)return;
      let next;
      try{
        if(pending()){block({message:'上一条同步结果待确认，请显式重试。',pending:true});return;}
        if(state().device.storageError){block({message:'吧唧报告存储错误，场景尚未同步。'});return;}
        if(consumeEvent&&ack?.key===authorized&&now()-lastEventsAt>=1500){
          const eventOperation={key:authorized};flight=eventOperation;
          publish('settling','正在核对真实设备事件…');
          let eventResult;
          try {eventResult=await consumeEvent(()=>valid()&&authorized===eventOperation.key);}
          finally {if(flight===eventOperation)flight=null;lastEventsAt=now();}
          if(!valid())return;
          if(eventResult?.waiting){publish('waiting',eventResult.message||'设备事件等待手机互动结束。');signal();return;}
          if(eventResult?.processed)ack=null;
        }
        next=sample();if(!next){publish('waiting','小猫状态尚未就绪，暂不发送。');return;}
        if(ack?.key===authorized&&ack.signature===next.signature){publish('synced','当前场景已由吧唧持久保存。',false,ack.revision);await pushDay(next);return;}
      }catch(error){let unknown=false;try{unknown=Boolean(pending());}catch{}block({message:error.message,pending:unknown});return;}
      const operation={key:authorized,signature:next.signature};flight=operation;
      publish('sending','正在同步小猫场景…');
      try{
        // Original HTML defaults to unversioned zero. Town lifecycle supplies only a
        // local source revision; adapter still owns wire revision, seq and durable journal.
        const result=await ports.scenes.pushScene({...next.value,revision:next.value.revision??0,requestId:uuid(),epochMs:now(),utcOffsetMinutes:next.zone});
        if(result?.status!=='device_persisted'||!Number.isSafeInteger(result.revision)||result.revision<1)throw Error('设备持久确认资料不完整。');
        if(valid()&&authorized===operation.key){
          ack={...operation,revision:result.revision};
          const latest=sample();
          if(latest?.signature===operation.signature)publish('synced','当前场景已由吧唧持久保存。',false,result.revision);
          else publish('waiting','手机状态已变化，接着同步最新场景。');
        }
      }catch(error){
        if(valid()&&authorized===operation.key){let unknown=true;try{unknown=Boolean(pending());}catch{}
          block({message:error.message||'同步未确认，请检查连接。',pending:unknown});}
      }finally{if(flight===operation)flight=null;signal();}
    }
    const unsubscribe=ports.control.subscribe(()=>{
      if(authorized!==null&&authorized!==key()){
        authorized=null;ack=null;dayAck=null;dayStatus={stage:'stale',message:'连接已变化，一天圆环接收状态已过期。'};
        publish('disconnected','连接已断开。重新明确连接后发送手机当前状态。',Boolean(halt?.pending));
      }
      if(!['diagnostic','day'].includes(flight?.kind))signal();
    });
    return {
      signal,
      getStatus:()=>({...status}),
      getDayStatus:()=>({...dayStatus}),
      get authorized(){return valid();},
      setEnabled(value){enabled=Boolean(value);if(!enabled){authorized=null;ack=null;publish('disconnected','当前使用基础控制，未发送场景。');}signal();},
      setForeground(value){foreground=Boolean(value);if(!foreground){authorized=null;ack=null;dayAck=null;dayStatus={stage:'stale',message:'已暂停，一天展示接收状态已过期。'};if(timer!==null){cancel(timer);timer=null;}publish('disconnected','已暂停同步。返回前台将尝试恢复已选择的吧唧。',Boolean(halt?.pending));}},
      authorize(){const current=key();if(!current||!enabled||!foreground)throw Error('场景连接尚未确认。');authorized=current;ack=null;halt=null;lastEventsAt=-Infinity;lastDayAt=-Infinity;dayAck=null;dayStatus={stage:'waiting',message:'一天圆环等待当前场景确认。'};signal();},
      async retry(){
        if(!valid()||flight)throw Error('请先明确连接新本地固件，等待当前操作结束。');
        halt=null;const operation={key:authorized};flight=operation;
        publish('sending','正在确认上一条同步…');
        try{
          if(!sample())throw Error('小猫状态尚未就绪，暂不重试。');
          const old=pending();validatePending(old);
          if(old)await ports.scenes.retryPending(USER);
          if(valid()&&authorized===operation.key){ack=null;publish('waiting','上一条结果已确认，接着同步当前场景。');}
        }catch(error){if(valid()){let unknown=true;try{unknown=Boolean(pending());}catch{}block({message:error.message,pending:unknown});}throw error;}
        finally{if(flight===operation)flight=null;signal();}
      },
      async readDeviceState(){
        if(!valid())throw Object.assign(Error('请先明确连接新本地吧唧。'),{code:'NOT_CONNECTED'});
        if(flight)throw Object.assign(Error('正在同步或结算，请稍后再刷新连接详情。'),{code:'BUSY'});
        const operation={key:authorized,kind:'diagnostic'};flight=operation;
        try{
          const result=await ports.control.readDeviceState();
          if(!valid()||authorized!==operation.key)throw Object.assign(Error('连接已变化，本次读回已过期。'),{code:'STALE_GENERATION'});
          return result;
        }finally{if(flight===operation)flight=null;}
      },
      dispose(){disposed=true;authorized=null;unsubscribe?.();if(timer!==null)cancel(timer);}
    };
  }
  function mount(root){
    const d=root.document,$=id=>d.getElementById(id),host=root.CatOfflineHost;
    const body=d.querySelector('.offline-device-body');
    const legacy=d.createElement('section');legacy.id='offline-legacy-panel';
    for(const id of ['offline-device-status','offline-device-note','offline-device-list','offline-device-primary','offline-device-start','offline-device-disconnect'])legacy.append($(id));
    const row=d.createElement('label');row.className='offline-device-mode';row.textContent='连接方式';
    const select=d.createElement('select');select.id='offline-device-mode';select.setAttribute('aria-label','连接方式');
    select.innerHTML='<option value="cflocal2">新本地固件 · 场景同步</option><option value="legacy">旧固件兼容 · 基础控制</option>';
    row.append(select);const routeStatus=d.createElement('small');routeStatus.id='offline-route-status';row.append(routeStatus);body.querySelector('h3').after(row,legacy);
    const panel=d.createElement('section');panel.id='offline-v2-panel';panel.hidden=true;
    panel.innerHTML='<p id="offline-v2-status" role="status" aria-live="polite"></p><p id="offline-v2-note"></p><p id="offline-v2-events" role="status"></p><p id="offline-v2-day" role="status"></p><div id="offline-v2-list"></div><button type="button" class="g-btn" id="offline-v2-scan">寻找新本地吧唧</button><button type="button" class="g-btn ghost" id="offline-v2-retry" hidden>重试场景同步</button><button type="button" class="g-btn ghost" id="offline-v2-disconnect" hidden>断开连接</button><p class="lf-note">新固件的真实照料与野花收据在手机持久结算后才确认。旧固件仍为基础控制；双方好友确认尚无持久证明，不会自动建好友。</p>';
    legacy.after(panel);
    const backgroundButton=d.createElement('button');backgroundButton.type='button';backgroundButton.className='g-btn ghost';backgroundButton.id='offline-v2-background';backgroundButton.textContent='开启锁屏连接';
    const backgroundNote=d.createElement('p');backgroundNote.className='lf-note';backgroundNote.setAttribute('role','status');backgroundNote.textContent='开启后显示常驻通知；后台只保持连接，不结算照料。强制停止或系统终止后请重开应用。';
    panel.append(backgroundButton,backgroundNote);
    let ports=null,coordinator=null,busy=false,mode='cflocal2',foreground=!d.hidden,connectionError=null,unsubscribe=null,diagnostics=null;
    const reconnectKey='cat-saved-local-device-v1';let reconnectTimer=null,reconnectEpoch=0;
    function savedDevice(){try{const value=JSON.parse(root.localStorage.getItem(reconnectKey)||'null');if(value?.schema===1)return value;
      // Restore a single existing durable binding by verified device ID. A fresh scan
      // must contain exactly one candidate; HELLO must match before any mutation.
      const journal=JSON.parse(root.localStorage.getItem('cat-cflocal2-journal-v1')||'null'),identities=JSON.parse(root.localStorage.getItem('cat-cflocal2-source-identities-v1')||'null');
      const ids=Object.keys(journal?.devices||{}).filter(id=>identities?.bindings?.[id]);
      return ids.length===1?{schema:1,address:null,deviceId:ids[0],enabled:true,restored:true}:null;
    }catch{return null;}}
    function saveDevice(value){root.localStorage.setItem(reconnectKey,JSON.stringify(value));}
    function rememberDevice(device){const s=ports.control.getState();if(!verifiedLink(s))throw Error('设备身份未确认。');saveDevice({schema:1,address:device.address,deviceId:s.hello.deviceId,enabled:true});}
    function scheduleReconnect(delay=800){root.clearTimeout(reconnectTimer);if(!foreground||mode!=='cflocal2'||!savedDevice()?.enabled)return;reconnectTimer=root.setTimeout(()=>void reconnect(),delay);}
    async function reconnect(){
      if(!foreground||d.hidden||busy||mode!=='cflocal2'||!ports)return;
      const saved=savedDevice();if(!saved?.enabled)return;
      const epoch=reconnectEpoch;busy=true;connectionError=null;render();
      try{
        await ports.control.refreshConnectionState();
        if(epoch!==reconnectEpoch||!foreground||d.hidden)return;
        if(ports.control.consumeBackgroundStop()){saveDevice({...saved,enabled:false});root.clearTimeout(reconnectTimer);return;}
        if(!verifiedLink(ports.control.getState()))await ports.control.resumeSavedDevice(saved);
        if(epoch!==reconnectEpoch||!foreground||d.hidden){await ports.control.disconnect();return;}
        if(ports.control.getState().hello?.deviceId!==saved.deviceId)throw Object.assign(Error('设备身份变化，停止自动恢复。'),{code:'OWNER_CONFLICT'});
        const recovered=ports.control.getState();saveDevice({...saved,address:recovered.evidence.deviceAddress,restored:false});
        coordinator.authorize();if(ports.scenes.getPending())await coordinator.retry();
      }
      catch(error){connectionError=friendly(error);if(error.code==='OWNER_CONFLICT'){saveDevice({...saved,enabled:false});}}
      finally{busy=false;render();if(foreground&&!verifiedLink(ports.control.getState()))scheduleReconnect(20000);}
    }
    const text=(id,value)=>{if($(id).textContent!==value)$(id).textContent=value;};
    backgroundButton.addEventListener('click',()=>void run(async()=>{
      const enabled=ports.control.getBackgroundState()?.backgroundEnabled===true;
      await ports.control.setBackgroundRetention(!enabled,USER);
      if(enabled){const saved=savedDevice();if(saved)saveDevice({...saved,enabled:false});root.clearTimeout(reconnectTimer);}
      render();
    }));
    const friendly=error=>/App left foreground|activity.*foreground|app.*background/i.test(error?.message||error||'')?'应用已暂停连接，请重新明确连接。':error?.message||String(error||'');
    const names={disconnected:'新本地吧唧尚未连接',permission_required:'需要附近设备权限',bluetooth_off:'请先开启蓝牙',scanning:'正在寻找新本地吧唧…',selecting:'选择身边的新本地吧唧',connecting:'正在连接…',discovering:'正在确认新协议…',subscribing:'正在准备接收消息…',handshaking:'正在核对设备身份与状态…'};
    function render(){
      legacy.hidden=mode!=='legacy';panel.hidden=mode!=='cflocal2';select.disabled=busy||host.deviceBusy;
      text('offline-route-status','切换连接方式会断开当前设备。');
      const s=ports?.control.getState(),ready=verifiedLink(s),sync=coordinator?.getStatus();
      const background=ports?.control.getBackgroundState();
      backgroundButton.disabled=busy||!ports||(!ready&&background?.backgroundEnabled!==true);
      backgroundButton.textContent=background?.backgroundEnabled===true?'关闭锁屏连接并断开':'开启锁屏连接';
      backgroundButton.setAttribute('aria-pressed',String(background?.backgroundEnabled===true));
      backgroundNote.textContent=background?.backgroundEnabled===true?'锁屏连接已开启，常驻通知可停止；后台不结算照料，返回前台再补传。':'锁屏连接未开启。开启后显示常驻通知；强制停止或系统终止后请重开应用。';
      const message=connectionError||(ready?(sync?.stage==='disconnected'?'新本地协议就绪 · 等待明确连接授权':sync?.message||'新本地协议就绪'):s?.stage==='ready_local'?'设备确认资料不完整，不能同步。':names[s?.stage]||friendly(s?.error)||'场景同步适配器尚未准备好');
      text('offline-v2-status',friendly(message));
      text('offline-v2-note',!ports?'等待原生连接通道。不会模拟连接或同步。':ready?'已核对新本地协议。只有当前场景的设备持久确认才能显示同步成功。':'首次请明确选择吧唧；之后回到应用会自动寻找同一设备，握手身份变化会停止。');
      text('offline-v2-day',coordinator?.getDayStatus().message||'一天圆环等待连接。');
      text('offline-v2-events',root.CatOfflineDeviceEvents?.lastResult?.message||'尚无新的真实设备事件；不会从 NPC 或页面动画产生奖励。');
      const scan=$('offline-v2-scan');scan.disabled=busy||!ports||['scanning','connecting','discovering','subscribing','handshaking'].includes(s?.stage);scan.hidden=ready;
      const retry=$('offline-v2-retry');retry.hidden=!ready||sync?.stage!=='error';retry.disabled=busy;retry.textContent=sync?.pending?'确认并重试上一条同步':'重新同步当前状态';
      $('offline-v2-disconnect').hidden=!ports||!['ready_local','connecting','discovering','subscribing','handshaking','scanning'].includes(s?.stage);
      $('offline-v2-disconnect').disabled=busy;
      const list=$('offline-v2-list');
      const devices=s?.stage==='selecting'?s.devices.filter(x=>x.source==='native_scan'):[];
      const signature=JSON.stringify(devices);
      if(list.dataset.devices!==signature){
        list.dataset.devices=signature;list.replaceChildren();
        for(const device of devices){const b=d.createElement('button');b.type='button';b.className='g-btn ghost';b.textContent=device.name||'附近的新本地吧唧';
          b.addEventListener('click',()=>void run(async()=>{reconnectEpoch++;await ports.control.connect(device,USER);rememberDevice(device);coordinator.authorize();}));list.append(b);}
      }
      for(const b of list.children)b.disabled=busy;
      diagnostics?.update();
    }
    async function run(action){if(busy)return;busy=true;connectionError=null;render();try{await action();}catch(error){connectionError=friendly(error)||'连接尚未确认。';}finally{busy=false;render();if(foreground&&savedDevice()?.enabled&&!coordinator?.authorized)scheduleReconnect();}}
    select.addEventListener('change',()=>void run(async()=>{
      if(!ports){select.value=mode;throw Error('原生连接通道尚未准备好。');}
      reconnectEpoch++;root.clearTimeout(reconnectTimer);const target=select.value;coordinator.setEnabled(false);if(target==='legacy'){const saved=savedDevice();if(saved)saveDevice({...saved,enabled:false});}
      try{await ports.control.selectTransport(target,USER);mode=target;coordinator.setEnabled(mode==='cflocal2');}
      finally{select.value=mode;}
    }));
    $('offline-v2-scan').addEventListener('click',()=>void run(async()=>{
      if(!ports)return;await ports.control.selectTransport('cflocal2',USER);
      const permission=await ports.control.requestPermissions(USER);
      if(permission.granted)await ports.control.scan({...USER,durationMs:8000});
    }));
    $('offline-v2-disconnect').addEventListener('click',()=>void run(async()=>{reconnectEpoch++;root.clearTimeout(reconnectTimer);const saved=savedDevice();if(saved)saveDevice({...saved,enabled:false});await ports.control.disconnect();}));
    $('offline-v2-retry').addEventListener('click',()=>void run(()=>coordinator.retry()));
    host.attachLocalV2Ports=value=>{
      if(ports)throw Error('新本地协议已经接入，不能替换。');
      if(value?.control?.protocolFamily!=='cflocal2'||!value.scenes)throw Error('新本地协议端口不完整。');
      ports=value;
      const consumer=ports.events&&root.CatOfflineDeviceEvents?.createConsumer(ports);
      coordinator=createCoordinator({ports,readDay:petId=>root.CatOfflineDayDisplay.read(petId),read:context=>root.CatOfflineSceneMap.read(context),consumeEvent:consumer?valid=>consumer.consume(valid):null,validatePending:p=>consumer?.assertPending(p),onChange:render,uuid:()=>root.crypto.randomUUID()});
      coordinator.setEnabled(mode==='cflocal2');coordinator.setForeground(foreground);unsubscribe=ports.control.subscribe(()=>{if(ports.control.consumeBackgroundStop()){const saved=savedDevice();if(saved?.enabled)saveDevice({...saved,enabled:false});root.clearTimeout(reconnectTimer);}render();if(foreground&&!busy&&savedDevice()?.enabled&&['disconnected','error'].includes(ports.control.getState().stage))scheduleReconnect(20000);});
      void ports.control.initialize().then(()=>scheduleReconnect()).catch(error=>{connectionError=error.message;render();});render();
    };
    diagnostics=root.CatOfflineDeviceDiagnostics?.mount({root,panel,getContext:()=>({mode,foreground,state:ports?.control.getState(),verified:verifiedLink(ports?.control.getState())&&coordinator?.authorized===true}),read:()=>{if(!coordinator)throw Error('原生连接通道尚未准备好。');return coordinator.readDeviceState();}})||null;
    root.addEventListener('cat-local-v2-error',event=>{connectionError=event.detail?.message||'本地同步存档无法打开。';render();});
    let scheduled=false;
    // Device-dialog rendering and Host body presentation classes are presentation only;
    // neither is an input to SceneMap. Real game DOM/data-view and the 500ms poll remain.
    const observer=new root.MutationObserver(records=>{if(records.length&&records.every(r=>{const target=r.target.nodeType===1?r.target:r.target.parentElement;return target?.closest('#offline-device')||(target===d.body&&r.type==='attributes'&&r.attributeName==='class');}))return;if(scheduled)return;scheduled=true;root.requestAnimationFrame(()=>{scheduled=false;coordinator?.signal();});});
    observer.observe(d.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-view','hidden','class']});
    const townChanged=()=>coordinator?.signal();root.addEventListener('cat-town-scene-change',townChanged);
    const poll=root.setInterval(()=>coordinator?.signal(),500);
    root.addEventListener('pagehide',()=>{observer.disconnect();root.clearInterval(poll);root.removeEventListener('cat-town-scene-change',townChanged);root.clearTimeout(reconnectTimer);reconnectEpoch++;coordinator?.dispose();diagnostics?.dispose();unsubscribe?.();void ports?.control.dispose();},{once:true});
    const api={render,async selectLegacy(){if(ports)await ports.control.selectTransport('legacy',USER);},setForeground(value){foreground=value;reconnectEpoch++;if(value){connectionError=null;scheduleReconnect();}else root.clearTimeout(reconnectTimer);coordinator?.setForeground(value);render();},get connected(){return Boolean(ports&&['ready_local','scanning','connecting','discovering','subscribing','handshaking'].includes(ports.control.getState().stage));},get status(){return coordinator?.getStatus()||null;}};
    render();root.dispatchEvent(new root.Event('cat-local-v2-host-ready'));return api;
  }
  return {createCoordinator,verifiedLink,mount};
});
