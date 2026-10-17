import { ActiveEvents } from './active-events.js';
import { BadgeSyncScheduler } from './badge-sync-scheduler.js';
import { LifeSync } from './life-sync.js';
import { requireEligibility } from './privacy-eligibility.js';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Geolocation } from '@capacitor/geolocation';
import { BackgroundLocation } from './background-location.js';
import { ApiClient } from './api-client.js';
import { CloudSave, saveFingerprint } from './cloud-save.js';
import { LifeProvider, dateKey, apiTime, parseApiTime } from './life-provider.js';
import { TelemetryOutbox } from './outbox.js';
import { mountAiPanel } from './ai-adapter.js';
import { mountSocial } from '../social/panel.js';
import { BadgeSync, decodeSensor } from './badge-sync.js';
const NativeLocation=registerPlugin('NativeLocation');let background;
const Motion = registerPlugin('NativeMotion');
const html = `<button id="companion-open" type="button">云与设备</button><dialog id="companion-dialog" aria-labelledby="companion-title"><div class="dialog-inner"><div class="dialog-header"><h2 id="companion-title">真实数据与云存档</h2><button type="button" class="close-button" aria-label="关闭云同步面板">×</button></div><p>原始定位只留本机；后台位置需单独开启，不补造全天步数。未配置后台或登录时，原游戏仍可离线游玩。</p><form id="companion-login"><label>后台地址<input id="cc-endpoint" type="url" placeholder="https://你的后台地址" autocomplete="url"></label><label>账号<input id="cc-username" autocomplete="username" minlength="3" maxlength="40"></label><label>密码<input id="cc-password" type="password" autocomplete="current-password" minlength="8"></label><label>注册邀请码<input id="cc-invite" autocomplete="off"></label><div class="companion-actions"><button type="submit">登录</button><button id="cc-register" type="button">注册</button><button id="cc-logout" type="button">退出并停止采集</button></div></form><p id="cc-account"></p><div class="companion-actions"><button id="cc-migrate" type="button">确认迁移本机存档</button><button id="cc-pull" type="button">备份本机并恢复云存档</button><button id="cc-push" type="button">同步当前存档</button></div><fieldset><legend>分别授权，随时撤回</legend><label><input id="cc-sync" type="checkbox">生活同步</label><label><input id="cc-location" type="checkbox">前台位置（本机150米聚类）</label><label><input id="cc-motion" type="checkbox">前台运动计数（真实传感器）</label><label><input id="cc-microphone" type="checkbox">按住说话（无后台收音）</label></fieldset><section><h3>后台生活轨迹（单独开启）</h3><p>用于离开应用后仍记录行动轨迹。原始位置仅留本机最多七天，云和吧唧只接摘要；需要系统“始终允许”位置权限与常驻服务。省电、强制停止或系统回收会产生未知缺口，不保证全天完整记录。</p><label><input id="cc-background" type="checkbox">同意后台记录位置（计步仍仅前台）</label><div class="companion-actions"><button id="cc-background-permission" type="button">单独设置后台位置权限</button><button id="cc-background-start" type="button">明确开启后台记录</button><button id="cc-background-stop" type="button">停止并清除待处理位置</button></div><p id="cc-background-status" role="status">后台记录未开启</p></section><div class="companion-actions"><button id="cc-consents" type="button">保存授权并开始前台采集</button><button id="cc-clear" type="button">清除七天生活数据并撤回</button><button id="cc-upload" type="button">同步摘要与埋点</button></div><p>吧唧先通过蓝牙面板连接，保持面板打开；云绑定需要设备已安全配密钥，并在设备上确认六位码。</p><div class="companion-actions"><button id="cc-bind" type="button">发起设备对码</button><button id="cc-confirm" type="button">设备已确认，完成绑定</button><button id="cc-device" type="button">校时与同步设备</button><button id="cc-event" type="button">补传一条设备互动</button></div><p id="companion-status" role="status" aria-live="polite">尚未登录；真实生活数据为空。</p><p id="companion-error" role="alert"></p><pre id="cc-data"></pre></div></dialog>`;
const FALSE_CONSENT = { revision:0,isLifeSyncEnabled:false,isLocationGranted:false,isMotionGranted:false,isMicrophoneGranted:false };
let session = null, api, provider, cloud, outbox, badge, watchId = null, motionListener = null, nativeActive = true, cloudReady = false, consent = { ...FALSE_CONSENT }, busy = false;
let currentSummary = null, seen = new Set(), lifeRevision = 0;
let appListener,ai,lastPlaceFingerprint,scheduler,lifeSync,social,activeEvents;
const events = new AbortController();
const $ = id => document.getElementById(id);
const status = message => { $('companion-status').textContent = message; };
function scopedStorage(userId) { const prefix=`companion:${userId}:`; return { getItem:key=>localStorage.getItem(prefix+key),setItem:(key,value)=>localStorage.setItem(prefix+key,value),removeItem:key=>localStorage.removeItem(prefix+key) }; }
let storage = scopedStorage('offline');
let syncLease=false;
async function run(action,{sync=false}={}) { if(events.signal.aborted||busy||social?.isBusy||badge?.transport.pending)return;busy=true;syncLease=sync;$('companion-error').textContent='';try{await action();}catch(error){$('companion-error').textContent=error.message;if(error.status===401){try{await hardStopLocation();}finally{session=null;sessionStorage.removeItem('companion-session');consent={...FALSE_CONSENT};provider.setConsent(consent);ai?.invalidate();cloudReady=false;}}}finally{syncLease=false;busy=false;render();} }
function requireLogin(){if(!session)throw new Error('请先登录真实后台。');}
function isNative(){return Capacitor.getPlatform()==='android';}
function render(){
  $('cc-account').textContent=session?`账号 ${session.userId} · 云版本 ${cloud?.meta.revision??0}${cloud?.meta.dirty?' · 待同步':''}${cloud?.meta.conflict?' · 冲突备份已保留':''}`:'未登录；没有自动迁移或覆盖云端存档。';
  currentSummary=provider.summary();const placeFingerprint=JSON.stringify(window.__pgLife?.places?.()||[]);if(placeFingerprint!==lastPlaceFingerprint){lastPlaceFingerprint=placeFingerprint;window.__pgLife?.emit?.('geo');}$('cc-data').textContent=JSON.stringify({summary:currentSummary,telemetryPending:outbox?.events.length??0,telemetryRejected:outbox?.rejected.length??0,telemetryDropped:outbox?.droppedCount??0,pendingClear:!!storage.getItem('pending-clear')},null,2);
}
async function stopSampling(){if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null;}if(isNative())await Motion.stop();provider?.stopSampling();}
async function startSampling(){
  await stopSampling();if(!session||!nativeActive||storage.getItem('pending-clear')||storage.getItem('pending-consent'))return;
  if(consent.isLocationGranted){try{await requireEligibility(api,'location',status);}catch(error){await hardStopLocation();consent.isLocationGranted=false;provider.setConsent(consent);fillConsents();throw error;}}
  if(background)await background.reconcile();
  if(consent.isLocationGranted&&!(background?.state?.isRunning&&background.state.isEnabled)){watchId=navigator.geolocation.watchPosition(p=>{try{provider.addPosition(p);render();}catch(error){$('companion-error').textContent=error.message;}},error=>{if(error.code!==1){provider.breakContinuity();status(error.message||'暂未取得位置，当前时段保持未知');return;}void run(async()=>{await hardStopLocation();ai?.invalidate();consent.isLocationGranted=false;provider.setConsent(consent);const pending={isLifeSyncEnabled:consent.isLifeSyncEnabled,isLocationGranted:false,isMotionGranted:consent.isMotionGranted,isMicrophoneGranted:consent.isMicrophoneGranted};storage.setItem('pending-consent',JSON.stringify(pending));consent=await api.request('/api/consents',{method:'PUT',body:{baseRevision:consent.revision,...pending}});storage.removeItem('pending-consent');status(error.message||'位置权限已撤回，采集停止');});},{enableHighAccuracy:false,maximumAge:60000,timeout:10000});}
  if(consent.isMotionGranted&&isNative()){const state=await Motion.status();if(!state.isGranted||!state.isAvailable)throw new Error('运动权限或真实传感器不可用；步数保持未知。');await Motion.start();}
}
async function hardStopLocation(){try{if(background)await background.stop();}finally{await stopSampling();if($('cc-background'))$('cc-background').checked=false;}}
async function clearLife(){
  requireLogin();ai?.invalidate();storage.setItem('pending-clear','true');await hardStopLocation();provider.clear();for(const key of ['pg-life-geo','pg-life-moments','pg-life-names','pg-life-claim'])localStorage.removeItem(key);currentSummary=null;lifeRevision=0;consent={...FALSE_CONSENT,revision:consent.revision};applyGameProvider();render();
  await api.request('/api/life-data',{method:'DELETE'});storage.removeItem('pending-clear');consent=await api.request('/api/consents');fillConsents();status('生活数据已清除，授权已撤回。');
}
function fillConsents(){for(const [id,key] of [['cc-sync','isLifeSyncEnabled'],['cc-location','isLocationGranted'],['cc-motion','isMotionGranted'],['cc-microphone','isMicrophoneGranted']])$(id).checked=!!consent[key];}
async function saveConsents(){
  requireLogin();ai?.invalidate();if(storage.getItem('pending-clear'))await clearLife();
  const next={isLifeSyncEnabled:$('cc-sync').checked,isLocationGranted:$('cc-location').checked,isMotionGranted:$('cc-motion').checked,isMicrophoneGranted:$('cc-microphone').checked};
  if(next.isLocationGranted){const owner=session?.userId;await requireEligibility(api,'location',status);if(owner!==session?.userId)throw new Error('账号改变。');}
  if(next.isLocationGranted&&isNative()){const p=await Geolocation.requestPermissions();if(!['granted','limited'].includes(p.location)&&p.coarseLocation!=='granted')throw new Error('系统定位权限未允许。');}
  if(next.isMotionGranted){if(!isNative())throw new Error('网页无原生计步，运动保持未知。');const p=await Motion.requestMotionPermission();if(!p.isAvailable||!p.isGranted)throw new Error('运动权限或计步传感器不可用。');}
  if(next.isMicrophoneGranted&&!consent.isMicrophoneGranted){const stream=await navigator.mediaDevices.getUserMedia({audio:true});for(const track of stream.getTracks())track.stop();}
  // 撤销先在本机生效，网络失败仍不可继续采集；墓碑阻止旧摘要重发。
  const revoked=['isLifeSyncEnabled','isLocationGranted','isMotionGranted','isMicrophoneGranted'].some(key=>consent[key]&&!next[key]);
  if(revoked){ai?.invalidate();if(!next.isLocationGranted)await hardStopLocation();else await stopSampling();consent={...consent,...next};provider.setConsent(next);applyGameProvider();storage.setItem('pending-consent',JSON.stringify(next));}
  consent=await api.request('/api/consents',{method:'PUT',body:{...next,baseRevision:consent.revision}});storage.removeItem('pending-consent');provider.setConsent(consent);applyGameProvider();fillConsents();await startSampling();status('授权已同步；没有数据的时段显示未记录。');
}
function makeCloud(){const owner=session.userId;cloud=new CloudSave({api,game:window.__petGame.store,storage,reload:()=>location.reload()});const push=cloud.push.bind(cloud);cloud.push=async()=>{const result=await push();if(owner===session?.userId)scheduler?.mark();return result;};outbox=new TelemetryOutbox({api,storage,key:'telemetry'});}
async function activate(auth){
  ai?.invalidate();badge=null;social?.invalidate();if(background&&session&&session.userId!==auth.userId)await background.stop();await stopSampling();session=auth;sessionStorage.setItem('companion-session',JSON.stringify(auth));storage=scopedStorage(auth.userId);provider=new LifeProvider({storage});makeCloud();const priorOwner=localStorage.getItem('companion-analytics-owner');seen=new Set(priorOwner===auth.userId?JSON.parse(storage.getItem('telemetry-seen')||'[]'):(window.__petAnalytics?.queue||[]).map(e=>JSON.stringify(e)));localStorage.setItem('companion-analytics-owner',auth.userId);storage.setItem('telemetry-seen',JSON.stringify([...seen]));
  if(storage.getItem('pending-clear'))await clearLife();
  consent=await api.request('/api/consents');
  if(storage.getItem('pending-consent')){const next=JSON.parse(storage.getItem('pending-consent'));consent=await api.request('/api/consents',{method:'PUT',body:{...next,baseRevision:consent.revision}});storage.removeItem('pending-consent');}
  provider.setConsent(consent);fillConsents();applyGameProvider();cloudReady=false;
  const remote=await cloud.pull();if(remote&&cloud.meta.revision===remote.revision&&localStorage.getItem('companion-game-owner')===auth.userId)cloudReady=true;
  status(remote?'云端已有存档；如本机不同，请明确恢复或处理冲突，未自动覆盖。':'云端没有存档；确认迁移后开始自动保存。');
  outbox.track('app_open',{entry:'launch',first:false,mobile:true});await startSampling();
}
async function login(register=false){
  const endpoint=$('cc-endpoint').value.trim();new URL(endpoint);localStorage.setItem('companion-endpoint',endpoint);const body={username:$('cc-username').value,password:$('cc-password').value,...(register?{inviteCode:$('cc-invite').value}:{})};
  const auth=await api.request(register?'/api/accounts':'/api/sessions',{method:'POST',body});$('cc-password').value='';$('cc-invite').value='';await activate(auth);
}
async function upload(){
  requireLogin();if(storage.getItem('pending-clear'))await clearLife();if(storage.getItem('pending-consent'))throw new Error('有尚未完成的撤回，禁止重传旧摘要。');
  await lifeSync.flush();
  await harvest();await outbox.flush();status('摘要与已确认埋点同步完成。');
}
async function harvest(){if(!outbox||!session)return;const queue=window.__petAnalytics?.queue||[];for(const event of queue){const key=JSON.stringify(event);if(seen.has(key))continue;const properties=Object.fromEntries(Object.entries(event.p||{}).filter(([k,v])=>!/lat|lon|coord|track|audio|key|token|password/i.test(k)&&['string','number','boolean'].includes(typeof v)));const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${session.userId}\n${key}`));const id=[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');outbox.track(event.n,properties,apiTime(event.t),id);seen.add(key);}seen=new Set(queue.map(e=>JSON.stringify(e)));storage.setItem('telemetry-seen',JSON.stringify([...seen]));}
const KIND={HOME:'home',WORK:'work',WALK:'move',COMMUTE:'commute',CAFE:'out',MEAL:'out',PARK:'move',OTHER:'out',SLEEP:'sleep'};
function minute(value){const d=new Date(parseApiTime(value));return Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',hourCycle:'h23'}).format(d))*60+Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',minute:'2-digit'}).format(d));}
function applyGameProvider(){
  const L=window.__pgLife;if(!L)return;L.cfg.demo=false;L.cfg.geo=false;L.cfg.motion=false;L.cfg.sync=!!consent.isLifeSyncEnabled;L.cfg.voice=!!consent.isMicrophoneGranted;
  L.day=()=>{const s=provider.summary();return{segs:s.segments.map(segment=>({start:minute(segment.startAt),end:minute(segment.endAt),kind:KIND[segment.type]||'none',place:segment.placeId})),steps:s.motion?.stepCount??null,wd:true};};
  const toPlace=p=>({id:p.id,name:p.alias,kind:p.type.toLowerCase(),icon:'📍',real:true,base:p.type==='PARK'?'park':'garden',catSpot:`${p.alias}附近`});
  L.places=()=>provider.places.filter(p=>new Set(provider.visits.filter(v=>v.placeId===p.id&&v.isIndependent!==false).map(v=>v.id)).size>=2).map(toPlace);L.place=id=>{const p=provider.places.find(p=>p.id===id);return p?toPlace(p):null;};L.renamePlace=(id,name)=>provider.renamePlace(id,name,provider.places.find(p=>p.id===id)?.type);
  L.moments=()=>provider.summary().moments.map(m=>({id:m.id,t:parseApiTime(m.occurredAt),type:m.type,icon:'🐾',label:'真实互动',heart:m.heart}));
  L.moment=input=>{if(!consent.isLifeSyncEnabled)return;const types={home:'ARRIVE_HOME',voice:'VOICE',quirk:'QUIRK',care:'CARE',graduate:'GRADUATE',encounter:'ENCOUNTER'};provider.addMoment({id:input.id,type:types[input.type]||'OTHER',heart:Math.max(0,Math.round(input.heart||0))});};
  L.catDo=segment=>{if(!consent.isLifeSyncEnabled)return{k:'home',t:'在家陪着你'};if(segment.kind==='none')return{k:'none',t:'还没有记录，暂不推断生活状态'};if(segment.kind==='sleep')return{k:'sleep',t:'与你一起休息'};if(segment.kind==='home')return{k:'home',t:'在家陪着你'};return{k:'out',t:`去了${L.place(segment.place)?.name||'附近'}`};};
  L.geoCount=()=>provider.samples.length;L.geoStart=async()=>({ok:false,msg:'请在“云与设备”中分别授权真实采集'});L.geoStop=()=>{void stopSampling();};
  // 无坐标的通用像素地图，不向瓦片服务传真实轨迹，不伪装真实地理地图。
  L.emit?.('geo');
  L.map=(place,w=300,h=170)=>{const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.setAttribute('aria-label','通用场景示意，不是实际地理地图');const g=canvas.getContext('2d');g.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--mint');g.fillRect(0,0,w,h);g.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--paper');g.fillRect(w/3,0,w/8,h);L.drawCat?.(g,w/2,h/2,3);return canvas;};
}
function requireBadge(){requireLogin();const client=window.__companionBle;if(!client?.isReady)throw new Error('请先在蓝牙面板保持本地连接。');if(!badge||badge.owner!==session.userId||badge.client!==client||badge.generation!==client.generation){badge=new BadgeSync({client,api,cloud,getOwner:()=>session?.userId});badge.generation=client.generation;}return badge;}
let mutationTimer;
function wireGameMutations(){const store=window.__petGame?.store;if(!store)return;for(const name of ['finishCare','finishPlay','finishVisit','settleWorldActivity','claimGoal','claimBaby','chooseBreed','buyItem','equipItem','sellItem','switchCat','adoptCat','graduate','rename','lifeLog']){const original=store[name];if(typeof original!=='function')continue;store[name]=(...args)=>{const result=original(...args);if(session&&cloudReady&&!cloud.meta.conflict){cloud.markDirty();clearTimeout(mutationTimer);mutationTimer=setTimeout(()=>void run(()=>cloud.push()),250);}return result;};}}
async function init(){
  document.body.insertAdjacentHTML('beforeend',html);scheduler=new BadgeSyncScheduler({getOwner:()=>session?.userId,getBadge:()=>badge,storage:localStorage,canRun:()=>!events.signal.aborted&&(!busy||syncLease)&&!document.hidden&&nativeActive&&!social?.isBusy&&!social?.hasPendingRevoke&&!storage.getItem('pending-clear')&&!storage.getItem('pending-consent'),onStatus:status});$('cc-endpoint').value=localStorage.getItem('companion-endpoint')||'';api=new ApiClient({getEndpoint:()=>localStorage.getItem('companion-endpoint'),getToken:()=>session?.accessToken});provider=new LifeProvider({storage});applyGameProvider();wireGameMutations();
  $('companion-open').addEventListener('click',()=>{$('companion-dialog').showModal();render();},{signal:events.signal});$('companion-dialog').querySelector('.close-button').addEventListener('click',()=>$('companion-dialog').close(),{signal:events.signal});
  $('companion-login').addEventListener('submit',e=>{e.preventDefault();void run(()=>login());},{signal:events.signal});
  const on=(id,action)=>$(id).addEventListener('click',()=>void run(action,{sync:['cc-upload','cc-device'].includes(id)}),{signal:events.signal});
  on('cc-register',()=>login(true));on('cc-logout',async()=>{ai?.invalidate();await hardStopLocation();let failure;try{if(session)await api.request('/api/sessions/current',{method:'DELETE'});}catch(error){failure=error;}finally{provider.clear();session=null;cloudReady=false;sessionStorage.removeItem('companion-session');consent={...FALSE_CONSENT};applyGameProvider();}status(failure?'本机已退出，远端撤销未确认，请检查网络。':'已退出；已停止采集，原宠物存档保留。');});
  on('cc-migrate',async()=>{requireLogin();if(!confirm('确认将本机完整猫咪家庭迁移到当前账号？不会覆盖已有云存档。'))return;const remote=await cloud.migrate();cloudReady=remote.status!=='REMOTE_EXISTS';if(cloudReady)localStorage.setItem('companion-game-owner',session.userId);status(cloudReady?'迁移完成，开始自动CAS保存。':'云端已有存档，不覆盖，请选择恢复。');});
  on('cc-pull',async()=>{requireLogin();if(!confirm('将保留本机备份，并用云存档恢复整个家庭，确认？'))return;const remote=await cloud.pull();if(!remote)throw new Error('云端尚无存档');localStorage.setItem('companion-game-owner',session.userId);await cloud.apply(remote);});
  on('cc-push',async()=>{requireLogin();if(!cloudReady)throw new Error('请先明确迁移或恢复，不能自动覆盖已有云存档');await cloud.push();status('当前存档已CAS保存');});
  if(isNative())background=new BackgroundLocation({native:NativeLocation,getSession:()=>session,getProvider:()=>provider,getConsent:()=>consent,onStatus:s=>{ $('cc-background-status').textContent=`前台权限 ${s.isForegroundGranted?'允许':'未允许'} · 后台权限 ${s.isBackgroundGranted?'允许':'未允许'} · 服务 ${s.isRunning?'运行':'停止'} · 待处理 ${s.pendingCount||0} · 丢弃 ${s.droppedCount||0}${s.isNotificationGranted?'':' · 通知未授权，可能不显示通知栏'}${s.lastError?' · '+s.lastError:''}`;}});
  on('cc-background-permission',async()=>{requireLogin();if(!background)throw new Error('网页预览不支持原生后台记录');if(!consent.isLocationGranted)throw new Error('请先保存前台位置授权，再单独设置后台权限');await NativeLocation.requestBackgroundPermission();await background.refresh();});
  on('cc-background-start',async()=>{requireLogin();await requireEligibility(api,'location',status);if(!background)throw new Error('网页预览不支持原生后台记录');if(!$('cc-background').checked)throw new Error('请明确勾选后台记录目的同意');await stopSampling();await NativeLocation.requestNotificationPermission();await background.start(true);await startSampling();});
  on('cc-background-stop',async()=>{await hardStopLocation();await background?.refresh();await startSampling();});
  $('cc-background').addEventListener('change',()=>{if(!$('cc-background').checked)void run(async()=>{await hardStopLocation();await startSampling();});},{signal:events.signal});
  on('cc-consents',saveConsents);on('cc-clear',clearLife);on('cc-upload',upload);
  on('cc-bind',async()=>{const challenge=await requireBadge().beginBinding();status(`核对设备六位码 ${String(challenge.displayCode).padStart(6,'0')}，在吧唧屏幕明确确认后再点“设备已确认”。`);});
  on('cc-confirm',async()=>{await requireBadge().confirmBinding();status('一机一密证明与后台授权已确认');});
  on('cc-device',async()=>{const b=requireBadge();scheduler.mark();if(!await scheduler.flush())throw new Error('设备同步待重试，未确认整组完成。');const sensor=decodeSensor(await b.transport.read(1));status('签名校时、宠物与本日摘要已同步');$('cc-data').textContent=JSON.stringify(sensor,null,2);});
  on('cc-event',async()=>{const response=await requireBadge().drainOne();if(response){status('后台已结算，设备队头已确认；重新初始化游戏画面');location.reload();}else status('设备没有待传互动');});
  document.addEventListener('click',e=>{const act=e.target.closest('#life-ov [data-act]')?.dataset.act;if(act==='sync'||act==='wipe'){e.stopImmediatePropagation();e.preventDefault();if(act==='wipe')void run(clearLife);else{$('companion-dialog').showModal();status('请在此分别授权并保存生活同步设置。');}}},{capture:true,signal:events.signal});
  document.addEventListener('pointerdown',e=>{if(e.target.closest('#lf-talk')&&!consent.isMicrophoneGranted){e.stopImmediatePropagation();e.preventDefault();status('麦克风未单独授权，未启动收音。');}},{capture:true,signal:events.signal});
  document.addEventListener('click',e=>{if(e.target.closest('[data-act="claim"]')){e.stopImmediatePropagation();e.preventDefault();status('真实行动点奖励尚未核对全部公式，不为无数据发奖。');}},{capture:true,signal:events.signal});
  document.addEventListener('change',e=>{if(e.target.closest('#life-ov [data-cfg]')){e.stopImmediatePropagation();e.preventDefault();applyGameProvider();status('请在云与设备面板保存真实分项授权。');}},{capture:true,signal:events.signal});
  const timer=setInterval(()=>{if(!session||busy)return;void run(async()=>{if(background)await background.reconcile();await harvest();if(outbox.events.length>=20)await outbox.flush();if(cloudReady&&!cloud.meta.conflict&&saveFingerprint(cloud.snapshot())!==cloud.meta.lastFingerprint)await cloud.push();if(!document.hidden&&nativeActive&&!social?.isBusy){await lifeSync.flush();await scheduler.flush();await activeEvents.flush();}render();},{sync:true});},15000);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){void stopSampling();if(session)void harvest().catch(e=>{$('companion-error').textContent=e.message;});if(session&&cloudReady&&!cloud.meta.conflict)void cloud.push().catch(e=>{$('companion-error').textContent=e.message;});}else if(nativeActive)void run(startSampling);},{signal:events.signal});
  if(isNative()){
    motionListener=await Motion.addListener('sample',sample=>{try{provider.addSteps(sample);render();}catch(error){$('companion-error').textContent=error.message;}});
    appListener=await App.addListener('appStateChange',({isActive})=>{nativeActive=isActive;if(!isActive)void stopSampling();else void run(async()=>{if(consent.isLocationGranted){const p=await Geolocation.checkPermissions();if(p.location!=='granted'&&p.coarseLocation!=='granted'){consent.isLocationGranted=false;storage.setItem('pending-consent',JSON.stringify({isLifeSyncEnabled:consent.isLifeSyncEnabled,isLocationGranted:false,isMotionGranted:consent.isMotionGranted,isMicrophoneGranted:consent.isMicrophoneGranted}));provider.setConsent(consent);}}await startSampling();});});
  }
  ai=mountAiPanel({api,getSession:()=>session,getProvider:()=>provider,getConsent:()=>consent,onUpload:upload,onStatus:status,events});
  social=mountSocial({api,getSession:()=>session,getStorage:()=>storage,getBadge:()=>badge,getCloud:()=>cloud,isUiBusy:()=>busy||events.signal.aborted,events});
   const entryRow=document.createElement('nav');entryRow.id='companion-mobile-entries';entryRow.setAttribute('aria-label','云与社交功能');const mobileEntries=matchMedia('(max-width:600px)');const placeEntries=()=>{if(mobileEntries.matches&&document.getElementById('m-sheet-body')){document.getElementById('m-sheet-body').prepend(entryRow);entryRow.append($('companion-open'),document.getElementById('m2-open'));}else{document.body.append($('companion-open'),document.getElementById('m2-open'));entryRow.remove();}};mobileEntries.addEventListener('change',placeEntries);events.signal.addEventListener('abort',()=>mobileEntries.removeEventListener('change',placeEntries),{once:true});placeEntries();
  lifeSync=new LifeSync({api,getOwner:()=>session?.userId,getStorage:()=>storage,getProvider:()=>provider,getConsent:()=>consent,canRun:()=>!events.signal.aborted&&(!busy||syncLease)&&!document.hidden&&nativeActive&&!social?.isBusy,onConfirmed:()=>scheduler.mark()});
  activeEvents=new ActiveEvents({getOwner:()=>session?.userId,getBadge:()=>badge,getCatId:()=>cloud?.snapshot()?.activeCatId,canRun:()=>!events.signal.aborted&&(!busy||syncLease)&&!document.hidden&&nativeActive&&!social?.isBusy&&!social?.hasPendingRevoke&&!storage.getItem('pending-clear')&&!storage.getItem('pending-consent'),onStatus:status});
   window.__companion={ai,social,api,scheduler,lifeSync,activeEvents,get session(){return session;},get badge(){return badge;},get provider(){return provider;},get cloud(){return cloud;},get consent(){return consent;},upload};
  window.addEventListener('pagehide',()=>{events.abort();clearInterval(timer);clearTimeout(mutationTimer);void stopSampling();void motionListener?.remove();void appListener?.remove();},{once:true});
  const raw=sessionStorage.getItem('companion-session');if(raw)await run(async()=>{try{const saved=JSON.parse(raw);session=saved;await api.request('/api/sessions/current');await activate(saved);}catch(error){try{await hardStopLocation();}finally{session=null;consent={...FALSE_CONSENT};}throw error;}});else if(background)await background.stop();render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void init(),{once:true});else void init();
