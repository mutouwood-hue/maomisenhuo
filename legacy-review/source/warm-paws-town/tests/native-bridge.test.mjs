import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const code = (await readFile(new URL('../src/native/bridge.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
const settle = () => new Promise(resolve => setImmediate(resolve));
function harness(native = true) {
  const events = {};
  const calls = [];
  const nodes = new Map();
  class Anchor { click() { calls.push('browser-click'); } }
  const sandbox = {
    Capacitor: { isNativePlatform: () => native },
    App: { addListener: async (name, fn) => { events[name] = fn; return { remove: async () => {} }; }, minimizeApp: async () => calls.push('minimize') },
    Filesystem: { writeFile: async options => { calls.push(options); return { uri: 'file:///cache/save.json' }; } },
    Directory: { Cache: 'CACHE' }, Encoding: { UTF8: 'utf8' },
    Share: { share: async options => calls.push(options) },
    Geolocation: { getCurrentPosition: async () => ({ coords: { latitude: 1 } }), watchPosition: async () => 'native-1', clearWatch: async options => calls.push(options) },
    HTMLAnchorElement: Anchor, navigator: {}, fetch: async () => ({ text: async () => '{"save":true}' }),
    document: { getElementById: id => nodes.get(id), querySelectorAll: () => [], querySelector: selector => nodes.get(selector), body: { dataset: { view: 'home' } } },
    window: { addEventListener: (name, fn) => { events[name] = fn; }, alert: text => calls.push(text) },
  };
  vm.runInNewContext(code, sandbox);
  return { sandbox, events, calls, nodes, Anchor };
}
test('web mode does not replace geolocation or activate native listeners', () => {
  const h = harness(false);
  assert.equal(h.sandbox.navigator.geolocation, undefined);
  assert.deepEqual(h.events, {});
});
test('Blob exports become UTF8 cache files shared by the system', async () => {
  const h = harness();
  const anchor = new h.Anchor(); anchor.download = 'save.json'; anchor.href = 'blob:local'; anchor.click();
  await settle();
  assert.equal(h.calls[0].data, '{"save":true}');
  assert.equal(h.calls[0].directory, 'CACHE');
  assert.equal(h.calls[1].files[0], 'file:///cache/save.json');
});
test('normal links retain their original click behavior', () => {
  const h = harness(); const a = new h.Anchor(); a.href = 'https://example.com'; a.click();
  assert.equal(h.calls[0], 'browser-click');
});
test('back button closes an active extension before minimizing', async () => {
  const h = harness(); await settle();
  h.nodes.set('#bk-ov.on .bk-x', { click: () => h.calls.push('close-workshop') });
  h.events.backButton(); assert.equal(h.calls[0], 'close-workshop');
  h.nodes.clear(); h.events.backButton(); assert.equal(h.calls[1], 'minimize');
});
test('back button returns from an open or collapsed world sheet without minimizing', async () => {
  for (const collapsed of [false, true]) {
    const h = harness(); await settle();
    h.sandbox.document.body.dataset.view = 'world';
    h.nodes.set('#m-sheet.on', { dataset: { mode: 'world' }, collapsed });
    h.nodes.set('world-home', { click: () => h.calls.push('return-home') });
    h.events.backButton();
    assert.deepEqual(h.calls, ['return-home']);
  }
});
test('back button returns from world even without an open sheet', async () => {
  const h = harness(); await settle();
  h.sandbox.document.body.dataset.view = 'world';
  h.nodes.set('world-home', { click: () => h.calls.push('return-home') });
  h.events.backButton();
  assert.deepEqual(h.calls, ['return-home']);
});
test('back button closes ordinary sheet rather than leaving the app', async () => {
  const h = harness(); await settle();
  h.nodes.set('#m-sheet.on', { dataset: { mode: 'panel' } });
  h.nodes.set('m-sheet-close', { click: () => h.calls.push('close-sheet') });
  h.events.backButton();
  assert.deepEqual(h.calls, ['close-sheet']);
});
test('geolocation cancellation clears the actual native watch ID', async () => {
  const h = harness(); const id = h.sandbox.navigator.geolocation.watchPosition(() => {});
  h.sandbox.navigator.geolocation.clearWatch(id); await settle();
  assert.equal(h.calls[0].id, 'native-1');
});
test('leaving app stops foreground sampling; resume respects opt-in', async () => {
  const h = harness(); await settle();
  h.sandbox.window.__pgLife = { cfg: { geo: false }, geoStop: () => h.calls.push('geo-stop'), geoStart: () => h.calls.push('geo-start') };
  h.events.appStateChange({ isActive: false });
  h.events.appStateChange({ isActive: true });
  assert.deepEqual(h.calls, ['geo-stop']);
  h.sandbox.window.__pgLife.cfg.geo = true;
  h.events.appStateChange({ isActive: true }); assert.equal(h.calls[1], 'geo-start');
});
