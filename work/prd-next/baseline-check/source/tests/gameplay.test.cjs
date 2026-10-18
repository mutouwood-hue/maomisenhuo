const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'android/app/src/main/assets');
const source = fs.readFileSync(path.join(root, 'original/game.html'), 'utf8');
const scripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
function engine() {
  const main = scripts.find(match => match[2].includes('function vu('))[2];
  const sandbox = {};
  vm.runInNewContext(main.slice(0, main.indexOf('/**')) + ';globalThis.createStore=vu;})();', sandbox);
  let now = 2_000_000_000_000;
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const store = sandbox.createStore({ storage, now: () => now });
  return { store, values, clock(ms) { now += ms; }, clone() { return sandbox.createStore({ storage, now: () => now }); } };
}
test('all eight scripts are ordered, parse, and preserve latest social-v7', () => {
  assert.equal(hash(source), '3e1b68b6dcef89ce6003961e0abb41354785443bd0427b83ed70f7589fd8af53');
  const manifest = JSON.parse(fs.readFileSync(path.join(assets, 'build-manifest.json')));
  assert.equal(manifest.scripts.length, 8);
  assert.equal(manifest.scripts.filter(item => item.changed).length, 4);
  const html = fs.readFileSync(path.join(assets, 'index.html'), 'utf8');
  let previous = -1;
  for (let index = 0; index < 8; index++) {
    const item = manifest.scripts[index];
    const packaged = fs.readFileSync(path.join(assets, item.file), 'utf8');
    assert.equal(item.sourceSha256, hash(scripts[index][2]));
    if (!item.changed) assert.equal(packaged, scripts[index][2]);
    new vm.Script(packaged, { filename: item.file });
    const position = html.indexOf(`src="${item.file}"`); assert.ok(position > previous); previous = position;
  }
  assert.match(html, /id="social-v7-js" type="application\/x-catforest-script" data-offline-src="game-08.js"/);
  const social=fs.readFileSync(path.join(assets,'game-08.js'),'utf8');
  assert.match(social,/真实吧唧双向确认尚待设备接口联调/);
  assert.match(social,/本次不记录环境标签/);
});
test('packaging keeps the complete original markup and CSS outside explicit safe-area/host wiring', () => {
  const strip = text => text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<div id="offline-boot-status"[\s\S]*?<\/div>/, '')
    .replace('<link rel="stylesheet" href="life-panels.css"><link rel="stylesheet" href="offline-host.css"><link rel="stylesheet" href="offline-ui-polish.css"><link rel="stylesheet" href="offline-page-polish.css"><link rel="stylesheet" href="offline-family-ui.css">', '')
    .replace(/var\(--safe-area-inset-(top|right|bottom|left), env\(safe-area-inset-\1\)\)/g, 'env(safe-area-inset-$1)');
  assert.equal(strip(fs.readFileSync(path.join(assets, 'index.html'), 'utf8')), strip(source));
  const original = scripts.find(match => match[2].includes('function vu('))[2];
  const packaged = fs.readFileSync(path.join(assets, 'game-03.js'), 'utf8');
  const unwrapped=require('./care-runtime-parity.cjs').withoutRuntime(packaged);
  const prefix=unwrapped.slice(0, unwrapped.indexOf('/**'));
  assert.equal((prefix.match(/return\{hostDeviceCare:/g)||[]).length,1);
  assert.equal(prefix.replace('JSON.stringify(globalThis.CatOfflineDurable?.stampGame(o)||o)','JSON.stringify(o)').replace(/return\{hostDeviceCare:[\s\S]*?,socialGrant:__pgSG,/, 'return{socialGrant:__pgSG,'), original.slice(0, original.indexOf('/**')), 'original store and formulas unchanged outside the dedicated physically-completed care hook');
});
test('actual navigation registration cannot bind body and bounce a nested button click back home',()=>{
  const {JSDOM}=require('jsdom');
  const d=new JSDOM('<body data-view="home"><button data-view="world"><span>出门</span></button></body>',{runScripts:'outside-only'});
  try{
    const packaged=fs.readFileSync(path.join(assets,'game-03.js'),'utf8');
    const registration=packaged.match(/document\.querySelectorAll\("[^"\n]*\[data-view\]"\)\.forEach\(O=>O\.addEventListener\("click",\(\)=>B\(O\.dataset\.view\)\)\)/)?.[0];
    assert.ok(registration);const calls=[];d.window.B=view=>calls.push(view);d.window.eval(registration);
    d.window.document.querySelector('span').click();assert.deepEqual(calls,['world']);
  }finally{d.window.close();}
});
test('cancel and premature care never grant reward; completed care and goal grant once', () => {
  const e = engine(), s = e.store;
  const before = s.getState();
  const cancelled = s.beginCare('feed'); assert.equal(cancelled.ok, true);
  s.cancelCare(cancelled.token); e.clock(6000);
  assert.equal(s.finishCare(cancelled.token, { score: 100 }).ok, false);
  assert.equal(s.getState().coins, before.coins); assert.equal(s.getState().counts.feed, 0);
  const care = s.beginCare('feed');
  assert.equal(s.finishCare(care.token, { score: 100 }).ok, false);
  e.clock(1200); assert.equal(s.finishCare(care.token, { score: 100 }).ok, true);
  const committed = s.getState();
  assert.equal(committed.counts.feed, 1); assert.equal(committed.xp, before.xp + 8);
  assert.equal(s.finishCare(care.token, { score: 100 }).ok, false);
  assert.equal(s.getState().coins, committed.coins);
  assert.equal(s.claimGoal('first_meal').ok, true);
  const coins = s.getState().coins;
  assert.equal(s.claimGoal('first_meal').ok, false); assert.equal(s.getState().coins, coins);
});
test('complete family, wardrobe and world data survive native-free local reload and invalid import', () => {
  const e = engine(), s = e.store;
  assert.equal(s.rename('小年糕').ok, true);
  assert.equal(s.buyItem('bandana').ok, true);
  assert.equal(s.equipItem('bandana').ok, true);
  s.flush();
  const saved = s.exportSave();
  assert.deepEqual(JSON.parse(e.clone().exportSave()), JSON.parse(saved));
  assert.equal(s.importSave('{broken').ok, false);
  assert.equal(s.exportSave(), saved);
  const parsed = JSON.parse(saved);
  assert.ok(Array.isArray(parsed.cats)); assert.ok(Array.isArray(parsed.wardrobe));
  assert.ok(parsed.family); assert.ok(parsed.world); assert.ok(Array.isArray(parsed.graduates));
});
test('original NPC family flow keeps three cares and active-time requirements', () => {
  const e = engine(), s = e.store;
  const adult = JSON.parse(s.exportSave()); adult.cats[0].xp = 200; adult.coins = 100;
  assert.equal(s.importSave(JSON.stringify(adult)).ok, true);
  assert.equal(s.beginFamily('blue').ok, true);
  assert.equal(s.claimBaby('小奶糖').ok, false);
  for (const action of ['feed', 'bath', 'drink']) {
    const care = s.beginCare(action); assert.equal(care.ok, true);
    e.clock(1500); assert.equal(s.finishCare(care.token, { score: 100 }).ok, true);
  }
  assert.equal(s.claimBaby('小奶糖').ok, false);
  for (let index = 0; index < 12; index++) { e.clock(5000); s.advanceFamily(5); }
  assert.equal(s.claimBaby('小奶糖').ok, true);
  assert.equal(s.getState().cats.length, 2);
  assert.equal(s.claimBaby('小奶糖').ok, false);
  assert.equal(e.clone().getState().cats.length, 2);
});
test('network guard permits local/blob exports and rejects external service calls without touching storage', async () => {
  const calls = [];
  const sandbox = { window: { fetch: (...args) => { calls.push(args); return Promise.resolve('ok'); } }, URL,
    location: { href: 'https://appassets.androidplatform.net/offline/index.html', origin: 'https://appassets.androidplatform.net' }, navigator: { sendBeacon: () => true } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'web/offline-prelude.js'), 'utf8'), sandbox);
  assert.equal(await sandbox.window.fetch('blob:https://appassets.androidplatform.net/export'), 'ok');
  assert.equal(await sandbox.window.fetch('./game-08.js'), 'ok');
  await assert.rejects(sandbox.window.fetch('https://example.invalid/api'), /尚未接入/);
  assert.equal(calls.length, 2); assert.equal(sandbox.navigator.sendBeacon(), false);
  assert.equal(sandbox.window.CatOfflineBuild.deviceAdapter, 'not-integrated');
});
test('pause stops live capture and rejects a permission result that arrives after cancellation', async () => {
  let resolveMedia,requested=0,stopped=0;
  const stream={getTracks:()=>[{stop(){stopped++;}}]};
  const sandbox={window:{fetch:async()=>{}},URL,location:{href:'https://appassets.androidplatform.net/offline/index.html',origin:'https://appassets.androidplatform.net'},navigator:{mediaDevices:{getUserMedia:()=>{requested++;return new Promise(resolve=>{resolveMedia=resolve;});}}}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'web/offline-prelude.js'),'utf8'),sandbox);
  assert.equal(requested,0,'no startup capture');
  const pending=sandbox.navigator.mediaDevices.getUserMedia({audio:true});
  sandbox.window.CatOfflineMedia.suspend();resolveMedia(stream);
  await assert.rejects(pending,/已取消/);assert.equal(stopped,1);
  await assert.rejects(sandbox.navigator.mediaDevices.getUserMedia({audio:true}),/已暂停/);
  assert.equal(requested,1);
  sandbox.window.CatOfflineMedia.resume();
  const live=sandbox.navigator.mediaDevices.getUserMedia({audio:true});resolveMedia(stream);await live;
  sandbox.window.CatOfflineMedia.suspend();sandbox.window.CatOfflineMedia.suspend();
  assert.equal(stopped,2);
});
