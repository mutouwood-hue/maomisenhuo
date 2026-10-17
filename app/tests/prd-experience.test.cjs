const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const feedback = fs.readFileSync(path.join(root, 'web/clinic-feedback.inc.js'), 'utf8');
const sandbox = {};
vm.runInNewContext(feedback + ';globalThis.feedback=__hostClinicFeedback;', sandbox);
test('existing tummy symptoms never claim a sneeze recovered', () => {
  assert.match(sandbox.feedback('tummy', '小橘', 'start'), /肚子不舒服/);
  assert.match(sandbox.feedback('tummy', '小橘', 'journal'), /小橘.*肠胃/);
  assert.doesNotMatch(sandbox.feedback('tummy', '小橘', 'result'), /喷嚏/);
});
test('sniffles and healthy checks remain distinct, unknown is neutral', () => {
  assert.match(sandbox.feedback('sniffles', '小橘', 'journal'), /喷嚏/);
  assert.match(sandbox.feedback(null, '小橘', 'result'), /很健康/);
  assert.match(sandbox.feedback('new-unknown', '小橘', 'result'), /诊疗完成/);
  assert.throws(() => sandbox.feedback(null, '小橘', 'invalid'), /未知诊疗/);
});
test('generated original clinic keeps charge, step, session and timing gates', () => {
  const generated = fs.readFileSync(path.join(root, 'android/app/src/main/assets/game-03.js'), 'utf8');
  assert.match(generated, /__hostClinicFeedback\(Ie,K.name,"journal"\)/);
  for (const gate of ['C!==_.token', 'Y!==3', 'e()-_.startedAt<1500', 'let W=_.cost', 'Ie?30:8']) assert.ok(generated.includes(gate), gate);
  assert.ok(generated.includes('洗澡需要 2 枚喵币'));
});
test('read-only graduation album closes without a current graduation session', () => {
  const generated = fs.readFileSync(path.join(root, 'android/app/src/main/assets/game-05.js'), 'utf8');
  const start = generated.indexOf("const a=e.target.closest('[data-a]')?.dataset.a;");
  const end = generated.indexOf("if(a==='next')", start);
  assert.ok(start >= 0 && end > start);
  let closed = 0;
  vm.runInNewContext('(()=>{' + generated.slice(start, end) + '})()', {e:{target:{closest:()=>({dataset:{a:'close'}})}},cur:null,close:()=>closed++});
  assert.equal(closed, 1);
});
