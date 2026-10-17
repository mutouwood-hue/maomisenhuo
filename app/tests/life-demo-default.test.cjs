'use strict';
/* 生活同步「演示数据默认关闭」的回归：这是 2026-10-17 改的构建补丁，
   之前只有实现没有测试，容易被后续改动悄悄回退成 demo:true。 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'android/app/src/main/assets');
const buildScript = fs.readFileSync(path.join(root, 'scripts/build_assets.py'), 'utf8');
const original = fs.readFileSync(path.join(root, 'original/game.html'), 'utf8');

function findBuiltScript() {
  for (const file of fs.readdirSync(assets).filter(f => /^game-\d+\.js$/.test(f))) {
    const text = fs.readFileSync(path.join(assets, file), 'utf8');
    if (text.includes('keepDays:7')) return { file, text };
  }
  throw new Error('找不到包含生活配置（keepDays）的产物脚本');
}

test('构建补丁存在且原始原型仍保留“演示默认开”的基线', () => {
  assert.ok(buildScript.includes("life-demo-off-by-default-explicit-opt-in"), '补丁名字应保留');
  assert.ok(original.includes('keepDays:7,demo:true'), '原始原型不应被直接改写，补丁在构建期施加');
});

test('产物里的演示默认值由链接参数决定，而不是恒为 true', () => {
  const { file, text } = findBuiltScript();
  assert.ok(!text.includes('keepDays:7,demo:true'), `${file} 里不应再出现 demo:true`);
  const match = text.match(/demo:(\/\??\[[^\]]*\]demo=1[^,}]*\/\.test\(location\.search\))/);
  assert.ok(match, `${file} 里应出现由 location.search 决定的 demo 默认值`);
  const expression = match[1];
  const evaluate = search => vm.runInNewContext(expression, { location: { search } });
  assert.equal(evaluate(''), false, '无参数时默认关闭');
  assert.equal(evaluate('?u=T01'), false, '只有受试者编号时不开启演示');
  assert.equal(evaluate('?demo=1'), true, '显式 ?demo=1 时开启');
  assert.equal(evaluate('?x=1&demo=1'), true, '参数在中间也识别');
  assert.equal(evaluate('?demo=0'), false, '?demo=0 不开启');
  assert.equal(evaluate('?demoe=1'), false, '前缀相同的其它参数不误判');
});
