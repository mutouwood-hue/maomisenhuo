'use strict';
/* 一天资料全链路：真实生活数据 → 手机投影 → 适配器分片载荷 → 设备解析结构。
   目的是一旦中间层悄悄改字段/丢心动/越界，测试立刻失败。 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const adaptersrc = fs.readFileSync(path.join(root, 'web/cflocal2-adapter.js'), 'utf8');
const projectionsrc = fs.readFileSync(path.join(root, 'web/offline-day-display.js'), 'utf8');
const ID = '0123456789abcdef0123456789abcdef';

/* 与 firmware/main/local2_day.c 的 keys[] 保持一致；多一个字段固件就会整帧拒绝。 */
const DEVICE_KEYS = ['schema', 'transfer', 'date', 'zone', 'cutoff', 'mode', 'clientId', 'petId', 'part', 'parts', 'segments', 'hearts'];

function project({ segs, momentMinutes, nowMinute = 600, demo = false }) {
  const base = new Date('2026-10-17T12:00:00+08:00').getTime();
  const dayStart = new Date(base); dayStart.setHours(0, 0, 0, 0);
  class FakeDate extends Date { constructor(...args) { super(...(args.length ? args : [base])); } }
  const L = {
    cfg: { demo, geo: true },
    nowMin: () => nowMinute,
    day: () => ({ segs }),
    place: id => ({ kind: id === 'work' ? 'work' : id === 'park' ? 'park' : 'home' }),
    moments: () => momentMinutes.map(m => ({ t: dayStart.getTime() + m * 60000 })),
  };
  const ctx = { __pgLife: L, Date: FakeDate, Number, Math, Array, Object, Error, Set };
  ctx.globalThis = ctx;
  vm.runInNewContext(projectionsrc, ctx, { filename: 'offline-day-display.js' });
  /* 跨 realm 的数组原型不同，先归一成普通 JSON 值再比较。 */
  return JSON.parse(JSON.stringify(ctx.CatOfflineDayDisplay.read('pet-1')));
}

function harness({ capabilities = ['scene', 'snapshot', 'events', 'day_view', 'day_hearts_v1'] } = {}) {
  let raw = null, uid = 0, seq = 0, lastCommit = null, dayTotal = 0;
  const state = { stage: 'ready_local', hello: { protocol: 'CFLOCAL2', deviceId: ID, clientId: null, lastSeq: 0, capabilities }, evidence: { generation: 1 }, device: { snapshot: null } };
  const requests = [];
  const control = {
    getState: () => JSON.parse(JSON.stringify(state)), receive() {},
    async request(op, data, extras) {
      requests.push({ op, data: structuredClone(data), extras });
      if (op === 'day') return { data: { accepted: true, volatile: true, complete: data.part + 1 === data.parts, part: data.part, date: data.date, count: Math.min(dayTotal, (data.part + 1) * 16) } };
      if (op === 'events') return { data: { event: null } };
      const command = { op, data: structuredClone(data), extras: structuredClone(extras) };
      let duplicate = false;
      if (extras.seq === seq) { assert.deepEqual(command, lastCommit); duplicate = true; }
      else { assert.equal(extras.seq, seq + 1); seq++; lastCommit = command; }
      return { data: { persisted: true, seq: extras.seq, revision: data.revision ?? 0, duplicate }, generation: state.evidence.generation, gattWriteCompleted: true };
    }
  };
  const storage = { getItem: () => raw, setItem: (k, v) => { raw = v; } };
  const module = { exports: {} };
  vm.runInNewContext(adaptersrc, { module, exports: module.exports, require: () => ({ createControl: () => control }), TextEncoder, globalThis: { crypto: crypto.webcrypto }, Map, Set, Number, JSON, Error, Object, Promise, Array });
  const create = () => module.exports.createPorts({ bridge: {}, storage, durableCheckpoint: async r => ({ persisted: true, journalSha256: crypto.createHash('sha256').update(r).digest('hex') }), uuid: () => `00000000-0000-4000-8000-${String(++uid).padStart(12, '0')}` });
  return { create, control, state, requests, setDayTotal: n => { dayTotal = n; } };
}

function scene() {
  return { requestId: 'scene-1', petId: 'pet-1', revision: 0, scene: 'home', action: 'idle', weather: 'clear', pet: { name: 'Mikan', breed: 'orange', food: 70, mood: 60, clean: 80, energy: 70, health: 100, coins: 30 }, epochMs: 1792079999000 };
}

test('投影层：段与心动都落在 cutoff 内且顺序正确', () => {
  const p = project({
    segs: [{ start: 0, end: 300, kind: 'sleep', place: 'home' }, { start: 300, end: 600, kind: 'work', place: 'work' }],
    momentMinutes: [540, 60, 180, 60],
  });
  assert.equal(p.cutoff, 600);
  assert.equal(p.mode, 'automatic');
  assert.deepEqual(p.segments.map(s => [s[0], s[1]]), [[0, 300], [300, 600]]);
  assert.deepEqual(p.hearts, [60, 180, 540], '心动去重升序且不越 cutoff');
});

test('全链路：设备收到的分片拼回后与投影逐字段一致', async () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ start: i * 30, end: (i + 1) * 30, kind: i % 3 === 0 ? 'work' : 'home', place: i % 3 === 0 ? 'work' : 'home' }));
  const p = project({ segs: many, momentMinutes: [60, 180, 540] });
  const h = harness();
  const ports = h.create();
  await ports.scenes.pushScene(scene());
  h.setDayTotal(p.segments.length);
  await ports.display.pushDay(p);

  const frames = h.requests.filter(r => r.op === 'day').map(r => r.data);
  assert.equal(frames.length, 2, '20 段应分两片');
  assert.deepEqual(frames.flatMap(f => f.segments), p.segments, '分片拼接必须等于投影段');
  assert.deepEqual(frames[0].hearts, [60, 180, 540], '心动随第一片');
  assert.equal(frames[1].hearts, undefined, '第二片不带心动');
  for (const frame of frames) assert.equal(frame.transfer, frames[0].transfer, '同一整日传输共用一个 transfer');
});

test('设备侧结构守卫：键白名单、字段数、数值范围、心动只在第一片', async () => {
  const p = project({
    segs: [{ start: 0, end: 300, kind: 'sleep', place: 'home' }, { start: 300, end: 600, kind: 'work', place: 'work' }],
    momentMinutes: [60, 180, 540],
  });
  const h = harness();
  const ports = h.create();
  await ports.scenes.pushScene(scene());
  h.setDayTotal(p.segments.length);
  await ports.display.pushDay(p);

  const frame = h.requests.find(r => r.op === 'day').data;
  for (const key of Object.keys(frame)) assert.ok(DEVICE_KEYS.includes(key), `固件不认识字段 ${key}，会整帧拒绝`);
  assert.ok(Object.keys(frame).length === 11 || Object.keys(frame).length === 12, '字段数只能是 11 或 12');
  assert.equal(typeof frame.transfer, 'string');
  assert.ok(/^[0-9a-f-]{36}$/i.test(frame.transfer));
  assert.ok(Number.isInteger(frame.zone) && Math.abs(frame.zone) <= 840);
  assert.ok(Number.isInteger(frame.cutoff) && frame.cutoff >= 0 && frame.cutoff <= 1440);
  assert.ok(['demo', 'automatic'].includes(frame.mode));
  assert.equal(frame.part, 0);
  assert.equal(frame.parts, 1);
  assert.ok(Array.isArray(frame.segments) && frame.segments.length <= 16);
  let end = 0;
  for (const row of frame.segments) {
    assert.equal(row.length, 5, '每行必须是 5 元组');
    assert.ok(row.every(Number.isInteger));
    assert.ok(row[0] >= end && row[1] > row[0] && row[1] <= frame.cutoff);
    assert.ok(row[2] >= 0 && row[2] <= 6 && row[3] >= 0 && row[3] <= 2 && row[4] >= 0 && row[4] <= 7);
    end = row[1];
  }
  let prev = -1;
  for (const minute of frame.hearts) {
    assert.ok(Number.isInteger(minute) && minute >= 0 && minute <= frame.cutoff && minute >= prev, '心动必须递增且不越 cutoff');
    prev = minute;
  }
});

test('演示模式：来源位固定为 2，且不冒充真实数据', async () => {
  const p = project({ segs: [{ start: 0, end: 300, kind: 'home', place: 'home' }], momentMinutes: [60], demo: true });
  assert.equal(p.mode, 'demo');
  assert.ok(p.segments.every(row => row[3] === 2), '演示段来源位必须是 2');
  const h = harness();
  const ports = h.create();
  await ports.scenes.pushScene(scene());
  h.setDayTotal(p.segments.length);
  await ports.display.pushDay(p);
  const frame = h.requests.find(r => r.op === 'day').data;
  assert.equal(frame.mode, 'demo');
});
