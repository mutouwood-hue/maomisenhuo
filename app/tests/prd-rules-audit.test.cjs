'use strict';
/* PRD 第三章「规则基线」抽检：直接运行原型引擎（game.html 里的真实 createStore），
   用行为验证而不是去猜压缩代码里的常量。对应验收清单 9.3「规则一致」。 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'original/game.html'), 'utf8');
const scripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];

function engine() {
  const main = scripts.find(match => match[2].includes('function vu('))[2];
  const sandbox = {};
  vm.runInNewContext(main.slice(0, main.indexOf('/**')) + ';globalThis.createStore=vu;})();', sandbox);
  let now = 2_000_000_000_000;
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const store = sandbox.createStore({ storage, now: () => now });
  return { store, values, clock(ms) { now += ms; } };
}
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} != ${expected}`);
const stats = store => JSON.parse(JSON.stringify(store.getState().stats));
function care(e, action) {
  const started = e.store.beginCare(action);
  assert.equal(started.ok, true, `${action} 应可开始`);
  e.clock(1500);
  const done = e.store.finishCare(started.token, { score: 100 });
  assert.equal(done.ok, true, `${action} 应可完成`);
}

test('PRD 3.2 初始状态：饱腹 65 / 心情 72 / 清洁 68 / 精力 75 / 健康 100', () => {
  const e = engine();
  const s = stats(e.store);
  near(s.food, 65, '饱腹初始值');
  near(s.mood, 72, '心情初始值');
  near(s.clean, 68, '清洁初始值');
  near(s.energy, 75, '精力初始值');
  assert.equal(e.store.getState().health, 100, '健康初始值');
});

test('PRD 3.3 喂食：饱腹 +25、心情 +3、清洁 −2', () => {
  const e = engine();
  const before = stats(e.store);
  care(e, 'feed');
  const after = stats(e.store);
  near(after.food - before.food, 25, '喂食饱腹增量');
  near(after.mood - before.mood, 3, '喂食心情增量');
  near(after.clean - before.clean, -2, '喂食清洁增量');
});

test('PRD 3.3 喂食：成长 +8、喵币 −3', () => {
  const e = engine();
  const before = e.store.getState();
  care(e, 'feed');
  const after = e.store.getState();
  near(after.xp - before.xp, 8, '喂食成长增量');
  near(after.coins - before.coins, -3, '喂食喵币增量');
});

test('PRD 3.3 喝水：心情 +3、精力 +6，且不扣喵币', () => {
  const e = engine();
  const before = stats(e.store), coins = e.store.getState().coins;
  care(e, 'drink');
  const after = stats(e.store);
  near(after.mood - before.mood, 3, '喝水心情增量');
  near(after.energy - before.energy, 6, '喝水精力增量');
  assert.equal(e.store.getState().coins, coins, '喝水不扣喵币');
});

test('PRD 3.3 洗澡：清洁 +35、心情 +4、精力 −3、健康 +1、喵币 −2', () => {
  const e = engine();
  /* 先把清洁压到 50，避免 68+35 撞 100 上限后测到的只是截断值。 */
  const save = JSON.parse(e.store.exportSave());
  save.cats[0].stats.clean = 50;
  save.cats[0].health = 90; /* 健康初始 100，先压到 90 才测得到 +1 */
  assert.equal(e.store.importSave(JSON.stringify(save)).ok, true);
  const before = stats(e.store), health = e.store.getState().health, coins = e.store.getState().coins;
  care(e, 'bath');
  const after = stats(e.store);
  near(after.clean - before.clean, 35, '洗澡清洁增量');
  near(after.mood - before.mood, 4, '洗澡心情增量');
  near(after.energy - before.energy, -3, '洗澡精力增量');
  assert.equal(e.store.getState().health - health, 1, '洗澡健康增量');
  assert.equal(e.store.getState().coins - coins, -2, '洗澡喵币增量');
});

test('PRD 3.2 状态上限 100：清洁 68 洗澡后封顶而不是溢出', () => {
  const e = engine();
  const before = stats(e.store);
  care(e, 'bath');
  assert.equal(stats(e.store).clean, 100, '清洁应封顶 100');
  assert.ok(before.clean + 35 > 100, '本例确实撞到上限');
});

test('PRD 3.2 成长阶段阈值：0–59 幼猫、60–159 少年猫、≥160 成年猫', () => {
  const e = engine();
  const setXp = xp => {
    const save = JSON.parse(e.store.exportSave());
    save.cats[0].xp = xp;
    assert.equal(e.store.importSave(JSON.stringify(save)).ok, true);
    return e.store.getState().stage;
  };
  const kitten = setXp(59), young = setXp(60), adult = setXp(160);
  assert.equal(kitten, 'kitten', 'xp=59 应为幼猫');
  assert.equal(young, 'young', 'xp=60 应为少年猫');
  assert.equal(setXp(159), young, 'xp=159 与 60 应同阶段');
  assert.equal(adult, 'adult', 'xp=160 应为成年猫');
});

test('PRD 3.2 亲密度：累计照料 <6 刚刚认识、6–19 越来越熟悉、≥20 亲密伙伴', () => {
  const e = engine();
  const labelAt = count => {
    const save = JSON.parse(e.store.exportSave());
    save.cats[0].counts.feed = count;
    assert.equal(e.store.importSave(JSON.stringify(save)).ok, true);
    return e.store.getState().bondLabel;
  };
  const labels = [labelAt(5), labelAt(6), labelAt(19), labelAt(20)];
  assert.equal(new Set(labels.slice(0, 2)).size, 2, '5 与 6 应处在不同档位');
  assert.equal(labels[1], labels[2], '6 与 19 应同档');
  assert.notEqual(labels[2], labels[3], '19 与 20 应处在不同档位');
});

test('PRD 3.3 拦截条件：饱腹 ≥95 时喂食被拒且不扣币', () => {
  const e = engine();
  const save = JSON.parse(e.store.exportSave());
  save.cats[0].stats.food = 95;
  assert.equal(e.store.importSave(JSON.stringify(save)).ok, true);
  const coins = e.store.getState().coins;
  const started = e.store.beginCare('feed');
  const blocked = started.ok === false || (e.clock(1500), e.store.finishCare(started.token, { score: 100 }).ok === false);
  assert.equal(blocked, true, '饱腹 95 时喂食应被拦截');
  assert.equal(e.store.getState().coins, coins, '被拦截不扣喵币');
});

test('PRD 3.3 照料可取消：取消后不发奖励、不计次数', () => {
  const e = engine();
  const before = e.store.getState();
  const started = e.store.beginCare('feed');
  assert.equal(started.ok, true);
  e.store.cancelCare(started.token);
  e.clock(2000);
  assert.equal(e.store.finishCare(started.token, { score: 100 }).ok, false, '取消后不可完成');
  const after = e.store.getState();
  assert.equal(after.counts.feed, before.counts.feed, '取消不计次数');
  near(after.xp, before.xp, '取消不给成长');
});

test('PRD 3.2 离线不下降：很久之后仅一次 tick 不应清空状态', () => {
  const e = engine();
  e.clock(6 * 60 * 60 * 1000);
  e.store.tick();
  const s = stats(e.store);
  assert.ok(s.food > 0 && s.mood > 0 && s.clean > 0 && s.energy > 0, '离线后状态不应被清零');
  assert.equal(e.store.getState().health, 100, '离线不生病');
});
