import test from 'node:test';
import assert from 'node:assert/strict';
import { BackgroundLocation } from '../../mobile-pet/src/companion/background-location.js';
import { LifeProvider } from '../../mobile-pet/src/companion/life-provider.js';

function fixture() {
  const now = Date.parse('2026-10-14T13:00:00+08:00'), values = new Map(), calls = [];
  const provider = new LifeProvider({ storage: { getItem: k => values.get(k), setItem: (k,v) => { values.set(k,v); calls.push('persist'); }, removeItem: k => values.delete(k) }, now: () => now });
  provider.setConsent({ isLocationGranted: true, isMotionGranted: false });
  let session = { userId: 'account-a' }, consent = { isLocationGranted: true }, samples = [];
  const native = {
    status: async () => ({ owner: 'account-a', generation: 'gen-a', isEnabled: true, isRunning: true }),
    start: async () => { calls.push('start'); }, stop: async () => { calls.push('stop'); samples = []; },
    readBatch: async () => ({ owner: 'account-a', generation: 'gen-a', samples: structuredClone(samples) }),
    ack: async ({ids}) => { calls.push('ack'); samples = samples.filter(s => !ids.includes(s.id)); },
  };
  const background = new BackgroundLocation({ native, getSession: () => session, getProvider: () => provider, getConsent: () => consent });
  const position = (i, extra = {}) => ({ id: `sample-${i}`, timestamp: now - 3600000 + i * 60000, coords: { latitude: 31, longitude: 121, accuracy: 15 }, ...extra });
  return { provider, native, background, calls, position, setSamples: v => { samples = v; }, setSession: v => { session = v; }, setConsent: v => { consent = v; }, pendingCount: () => samples.length };
}

test('native background import persists real local positions before exact queue acknowledgement', async () => {
  const f = fixture(); f.setSamples(Array.from({ length: 16 }, (_, i) => f.position(i))); f.calls.length = 0;
  await f.background.drain(); assert.equal(f.pendingCount(), 0);
  assert.equal(f.provider.summary().segments.length, 1);
  assert.equal(f.provider.summary().motion, null);
  assert.doesNotMatch(JSON.stringify(f.provider.summary()), /"(?:latitude|longitude|lat|lon|coords|samples)"/);
  assert.ok(f.calls.indexOf('persist') < f.calls.indexOf('ack'));
});

test('WebView provider reconstruction continues proven stay under the same visit ID', async () => {
  const f = fixture(); f.setSamples(Array.from({ length: 16 }, (_, i) => f.position(i))); await f.background.drain();
  const id = f.provider.visits[0].id;
  const restored = new LifeProvider({ storage: f.provider.storage, now: f.provider.now });
  restored.setConsent({ isLocationGranted: true, isMotionGranted: false });
  f.background.getProvider = () => restored;
  f.setSamples([f.position(16), f.position(17)]); await f.background.drain();
  assert.equal(restored.visits.length, 1); assert.equal(restored.visits[0].id, id);
  assert.equal(restored.visits[0].end, f.position(17).timestamp);
});

test('mock locations break continuity and cannot complete a real fifteen-minute stay', async () => {
  const f = fixture();
  f.setSamples([...Array.from({ length: 8 }, (_, i) => f.position(i)), f.position(8, { isMock: true }), ...Array.from({ length: 8 }, (_, i) => f.position(i + 9))]);
  await f.background.drain(); assert.equal(f.provider.visits.length, 0); assert.equal(f.pendingCount(), 0);
});

test('reconstruction never bridges a location gap longer than five minutes', async () => {
  const f = fixture(); f.setSamples(Array.from({ length: 8 }, (_, i) => f.position(i))); await f.background.drain();
  const restored = new LifeProvider({ storage: f.provider.storage, now: f.provider.now });
  restored.setConsent({ isLocationGranted: true, isMotionGranted: false }); f.background.getProvider = () => restored;
  f.setSamples(Array.from({ length: 8 }, (_, i) => f.position(i + 20))); await f.background.drain();
  assert.equal(restored.visits.length, 0);
});

test('persisted mock barrier survives WebView reconstruction', async () => {
  const f = fixture(); f.setSamples([...Array.from({ length: 8 }, (_, i) => f.position(i)), f.position(8, { isMock: true })]); await f.background.drain();
  const restored = new LifeProvider({ storage: f.provider.storage, now: f.provider.now });
  restored.setConsent({ isLocationGranted: true, isMotionGranted: false }); f.background.getProvider = () => restored;
  f.setSamples(Array.from({ length: 8 }, (_, i) => f.position(i + 9))); await f.background.drain();
  assert.equal(restored.visits.length, 0);
});

test('native ACK failure retries persisted timestamps without duplicate visits or rewards', async () => {
  const f = fixture(); f.setSamples(Array.from({ length: 16 }, (_, i) => f.position(i)));
  const ack = f.native.ack; f.native.ack = async () => { throw new Error('ack-interrupted-test'); };
  await assert.rejects(f.background.drain(), /ack-interrupted-test/);
  const first = f.provider.summary(); assert.equal(first.segments.length, 1); assert.equal(f.pendingCount(), 16);
  f.native.ack = ack; await f.background.drain();
  assert.deepEqual(f.provider.summary(), first); assert.equal(f.provider.samples.length, 16); assert.equal(f.pendingCount(), 0);
});

test('failed local persistence cannot acknowledge native samples', async () => {
  const f = fixture(); f.setSamples([f.position(0)]); f.provider.persist = () => { throw new Error('disk-full-test'); };
  await assert.rejects(f.background.drain(), /disk-full-test/); assert.equal(f.pendingCount(), 1); assert.ok(!f.calls.includes('ack'));
});

test('account changes during native read invalidate stale callbacks and never acknowledge old queue', async () => {
  const f = fixture(); let release;
  f.native.readBatch = () => new Promise(resolve => { release = resolve; });
  const pending = f.background.drain(); f.setSession({ userId: 'account-b' });
  release({ owner: 'account-a', generation: 'gen-a', samples: [f.position(0)] });
  await assert.rejects(pending, /旧定位队列已失效/); assert.equal(f.provider.samples.length, 0); assert.ok(!f.calls.includes('ack'));
});

test('missing session or revoked location stops and purges; old enabled setting alone never starts service', async () => {
  const f = fixture(); f.native.status = async () => ({ owner: 'account-a', isEnabled: true, isRunning: false });
  assert.equal(await f.background.reconcile(), false); assert.ok(!f.calls.includes('start'));
  f.setSession(null); await f.background.reconcile(); assert.ok(f.calls.includes('stop'));
  await assert.rejects(f.background.start(true), /需要登录/);
  f.setSession({ userId: 'account-a' }); f.setConsent({ isLocationGranted: false });
  await assert.rejects(f.background.start(true), /位置授权/);
});
