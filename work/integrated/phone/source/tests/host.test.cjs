const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
function host() {
  const html = fs.readFileSync(path.join(root, 'android/app/src/main/assets/index.html'), 'utf8');
  const dom = new JSDOM(html, { url: 'https://appassets.androidplatform.net/offline/index.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, d = w.document;
  const active = [], lifecycle = [], notices = [], callbacks = [];
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open',''); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open');this.dispatchEvent(new w.Event('close')); };
  w.requestAnimationFrame = callback => { callbacks.push(callback); return callbacks.length; };
  w.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() {} });
  let busy = false;
  w.__petGame = { state: () => ({ ready: true, busy, pet: { breed: 'orange' } }), setRoomActive: value => active.push(value), hostSuspend: () => { lifecycle.push('suspend');busy=false; }, hostResume: () => lifecycle.push('resume') };
  w.__pgLife = { cfg: { geo: false }, toast: text => notices.push(text), geoStop() { lifecycle.push('geoStop'); }, env: { stop() { lifecycle.push('envStop'); } } };
  w.__pgSocial = { drawPet() {}, closeMeet() { d.getElementById('sc-meet')?.classList.remove('on'); lifecycle.push('closeMeet'); } };
  w.eval(fs.readFileSync(path.join(root, 'web/offline-host.js'), 'utf8'));
  async function flush() { await Promise.resolve(); for (let i=0; callbacks.length && i<5; i++) { callbacks.shift()(i); await Promise.resolve(); } }
  return { w, d, active, lifecycle, notices, flush, busy(value) { busy=value; }, close() { dom.window.close(); } };
}
test('default device state stays unintegrated and does not invoke any radio permission', () => {
  const h = host();
  try {
    h.w.CatOfflineHost.openDevice();
    assert.equal(h.w.CatOfflineHost.deviceState, null);
    assert.match(h.d.getElementById('offline-device-status').textContent, /尚在联调/);
    assert.equal(h.d.getElementById('offline-device-primary').disabled, true);
    assert.equal(h.d.querySelectorAll('#m-rail button').length, 6, 'original static rail + device entry; social/life entries are added by their unchanged scripts');
    assert.equal(h.d.querySelectorAll('#m-dock button').length, 6);
    assert.equal(h.d.querySelector('#companion-login'), null);
  } finally { h.close(); }
});
test('drawer pauses room once and closes before system back exits', async () => {
  const h = host();
  try {
    await h.flush(); h.active.length = 0;
    const sheet=h.d.getElementById('m-sheet');
    sheet.classList.add('on'); await h.flush();
    assert.deepEqual(h.active, [false]);
    h.d.getElementById('m-sheet-close').addEventListener('click', () => sheet.classList.remove('on'));
    assert.equal(h.w.CatOfflineHost.handleBack(), true); await h.flush();
    assert.deepEqual(h.active, [false,true]);
    assert.equal(h.w.CatOfflineHost.handleBack(), false);
  } finally { h.close(); }
});
test('only one notification is selected, and social panels suppress it', async () => {
  const h=host();
  try {
    const banner=h.d.createElement('div'); banner.id='sc-banner'; banner.innerHTML='<div><b>附近 NPC</b></div>';
    const toast=h.d.createElement('div'); toast.id='pg-toast'; toast.className='on'; toast.textContent='新发现';
    const hub=h.d.createElement('section'); hub.id='sc-hub';hub.innerHTML='<div id="sc-hbody"></div>';
    h.d.body.append(banner,toast,hub); await h.flush();
    assert.equal(h.d.querySelectorAll('#offline-notifications>[data-offline-selected]').length,1);
    assert.equal(h.d.querySelector('#offline-notifications>[data-offline-selected]').id,'sc-banner');
    assert.match(banner.querySelector('.offline-test-mode').textContent,/本地试玩/);
    banner.hidden=true;await h.flush();
    assert.equal(h.d.querySelector('#offline-notifications>[data-offline-selected]').id,'pg-toast');
    hub.classList.add('on');await h.flush();
    assert.equal(h.d.querySelectorAll('#offline-notifications>[data-offline-selected]').length,0);
    assert.match(h.d.getElementById('offline-social-note').textContent,/不代表实体.*马达.*NFC/);
  } finally { h.close(); }
});
test('native pause is idempotent, cancels local care, and resumes without multiple room restarts', async () => {
  const h=host();
  try {
    h.busy(true);h.lifecycle.length=0;h.active.length=0;
    h.w.CatOfflineHost.suspend();h.w.CatOfflineHost.suspend();await h.flush();
    assert.equal(h.lifecycle.filter(value=>value==='suspend').length,1);
    assert.deepEqual(h.active,[false]);
    h.w.CatOfflineHost.resume();h.w.CatOfflineHost.resume();await h.flush();
    assert.equal(h.lifecycle.filter(value=>value==='resume').length,1);
    assert.deepEqual(h.active,[false,true]);
  } finally { h.close(); }
});
test('a claimed ready state without real transport evidence cannot display connected', async () => {
  const h=host();let initialized=0,scanned=0;
  try {
    h.w.CatOfflineHost.attachPorts({ control: { protocolFamily:'legacy-e7f1-bj20', getState:()=>({stage:'ready_local'}), subscribe:()=>()=>{}, initialize:async()=>{initialized++;}, scan:async()=>{scanned++;} } });
    await Promise.resolve();
    assert.equal(initialized,1);assert.equal(scanned,0);
    assert.equal(h.w.CatOfflineHost.deviceState.stage,'error');
    assert.match(h.d.getElementById('offline-device-status').textContent,/尚不能视为连接就绪/);
  } finally { h.close(); }
});
test('scan failure keeps its specific reason instead of a generic disconnected refresh', async () => {
  const h=host();
  try {
    h.w.CatOfflineHost.attachPorts({ control: { protocolFamily:'legacy-e7f1-bj20', getState:()=>({stage:'disconnected'}), subscribe:()=>()=>{}, initialize:async()=>{}, requestPermissions:async()=>({granted:true}), scan:async()=>{throw new Error('蓝牙尚未开启');} } });
    await Promise.resolve();h.d.getElementById('offline-device-primary').click();
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(h.d.getElementById('offline-device-status').textContent,'蓝牙尚未开启');
  } finally { h.close(); }
});
test('verified local control never automatically starts device gameplay; start requires explicit user action', async () => {
  const h=host(), commands=[];
  try {
    const state={stage:'ready_local',evidence:{source:'native',generation:7,deviceAddress:'test-only',serviceVerified:true,rxVerified:true,txVerified:true,subscribed:true},hello:{version:1,capabilities:15},device:{battery:null},capabilities:{legacyControl:'verified',snapshotSync:'unavailable',durableEvents:'unavailable',peerEncounter:'unavailable'}};
    h.w.CatOfflineHost.attachPorts({control:{protocolFamily:'legacy-e7f1-bj20',getState:()=>state,subscribe:()=>()=>{},initialize:async()=>{},startLocal:async command=>commands.push(command),readDeviceState:async()=>{}}});
    await Promise.resolve();assert.equal(commands.length,0);
    h.d.getElementById('offline-device-start').click();
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(commands.length,1);assert.equal(commands[0].generation,7);assert.equal(commands[0].origin,'explicit_user_action');
    assert.match(h.d.getElementById('offline-device-status').textContent,/不代表手机宠物已同步/);
  } finally {h.close();}
});
test('production adapter auto-attaches once and initializes without permission or radio side effects', async () => {
  const h=host(),calls=[];
  try {
    h.w.CatOfflineBleNative={postMessage(raw){const request=JSON.parse(raw);calls.push(request);queueMicrotask(()=>h.w.CatOfflineBleAdapter.receive({type:'result',requestId:request.requestId,ok:true,result:{available:true,bluetoothEnabled:null,granted:false,androidApi:35,foreground:true}}));}};
    h.w.eval(fs.readFileSync(path.join(root,'web/legacy-bj20-adapter.js'),'utf8'));
    await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(calls.map(row=>row.method),['initialize']);
    assert.equal(h.w.CatOfflineHost.deviceState.stage,'permission_required');
    assert.match(h.d.getElementById('offline-device-status').textContent,/需要蓝牙权限/);
    assert.throws(()=>h.w.CatOfflineHost.attachPorts({control:h.w.CatOfflineBleAdapter.control}),/不能.*替换/);
  } finally {h.close();}
});
test('legacy interrupted operation displays localized foreground message and discards results from an old foreground epoch',async()=>{
 for(const late of [false,true]){
  const h=host();try{
   let rejectScan,started=false;const state={stage:'disconnected'};
   h.w.CatOfflineHost.attachPorts({control:{protocolFamily:'legacy-e7f1-bj20',getState:()=>state,subscribe:()=>()=>{},initialize:async()=>{},requestPermissions:async()=>({granted:true}),scan:()=>{started=true;return new Promise((_,reject)=>{rejectScan=reject;});}}});
   h.d.getElementById('offline-device-primary').click();for(let n=0;n<10&&!started;n++)await Promise.resolve();assert.equal(started,true);
   if(late){h.w.CatOfflineHost.suspend();h.w.CatOfflineHost.resume();}
   rejectScan(Error('App left foreground; reconnect is disabled'));await new Promise(resolve=>setImmediate(resolve));
   const text=h.d.getElementById('offline-device-status').textContent;assert.doesNotMatch(text,/App left foreground/);assert.match(text,late?/尚未连接/:/已暂停连接/);
  }finally{h.close();}
 }
});
