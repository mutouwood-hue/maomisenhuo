import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, symlink, open, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { EventEmitter } from 'node:events';
import { readBoundedFileForTest, runStartupForTest, validateLiveInputs } from './m2-live-backend.mjs';

for (const failureAt of ['read', 'close', 'none']) {
  test(`合成file ${failureAt}路径清理所有临时buffer并白名单错误`, async () => fixture(async paths => {
    let temporary; let copied; let closes = 0;
    const status = { isFile: () => true, isSymbolicLink: () => false, size: 32, ino: 1, dev: 1 };
    const io = {
      lstat: async () => status,
      open: async () => ({ stat: async () => status,
        read: async buffer => { temporary = buffer; buffer.fill(0x73); if (failureAt === 'read') throw new Error('SYNTHETIC_SECRET_PATH'); return { bytesRead: 32 }; },
        close: async () => { closes++; if (failureAt === 'close') throw new Error('SYNTHETIC_SECRET_PATH'); },
      }),
      copy: buffer => { copied = Buffer.from(buffer); return copied; },
    };
    if (failureAt === 'none') { const result = await readBoundedFileForTest(paths.keyPath, 32, 32, io); assert.equal(result[0], 0x73); result.fill(0); }
    else await assert.rejects(readBoundedFileForTest(paths.keyPath, 32, 32, io), error => error.message === 'INPUT_UNAVAILABLE');
    assert.equal(closes, 1); assert.ok(temporary.every(byte => byte === 0));
    if (copied) assert.ok(copied.every(byte => byte === 0));
  }));
}

function syntheticStartup(stage) {
  const signals = new EventEmitter(); const logs = []; const config = { dbPath: 'SYNTHETIC_ONLY', deviceKeys: { '7c0c5f423686': Buffer.alloc(32, 0x73) } };
  const counters = { reserve: 0, create: 0, listen: 0, close: 0, exit: 0, retained: false };
  const dependencies = {
    signals, log: (level, code) => logs.push([level, code]), setExitCode: code => { counters.exit = code; },
    validate: async () => { if (stage === 'signal-validation') signals.emit('SIGINT'); return config; },
    reserve: async () => { counters.reserve++; if (stage === 'wx') throw new Error('SYNTHETIC_SECRET'); counters.retained = true; return { close: async () => { if (stage === 'reservation-close') throw new Error('SYNTHETIC_SECRET'); if (stage === 'signal-before-create') signals.emit('SIGTERM'); } }; },
    create: options => { counters.create++; assert.deepEqual(options.env, {}); if (stage === 'create') throw new Error('SYNTHETIC_SECRET'); return { server: {}, close: async () => { counters.close++; if (stage === 'app-close') throw new Error('SYNTHETIC_SECRET'); } }; },
    listen: async () => { counters.listen++; if (stage === 'listen') throw new Error('SYNTHETIC_SECRET'); if (stage === 'signal-before-listen') { signals.emit('SIGINT'); assert.equal(counters.close, 0); assert.equal(config.deviceKeys['7c0c5f423686'][0], 0x73); await Promise.resolve(); } },
  };
  return { dependencies, config, counters, logs, signals };
}
for (const stage of ['wx','reservation-close','create','listen','app-close','signal-validation','signal-before-create','signal-before-listen','signal-after-listen']) {
  test(`合成startup ${stage}无真实服务，失败/取消清key且保留DB`, async () => {
    const context = syntheticStartup(stage); const lifecycle = await runStartupForTest(context.dependencies);
    if (stage === 'signal-after-listen' || stage === 'app-close') { context.signals.emit('SIGTERM'); await lifecycle.close(); }
    assert.ok(context.config.deviceKeys['7c0c5f423686'].every(byte => byte === 0));
    assert.equal(context.counters.retained, !['wx','signal-validation'].includes(stage));
    assert.ok(context.counters.close <= 1);
    assert.ok(context.logs.every(([,code]) => ['START_FAILED','CLOSE_FAILED','CLOSED','LISTENING'].includes(code)));
    if (stage.startsWith('signal-') && stage !== 'signal-after-listen') assert.ok(!context.logs.some(([,code]) => code === 'LISTENING'));
    assert.equal(context.signals.listenerCount('SIGINT') + context.signals.listenerCount('SIGTERM'), 0);
    if (['signal-validation','signal-before-create'].includes(stage)) assert.equal(context.counters.create, 0);
    if (['wx','reservation-close','create'].includes(stage)) assert.equal(context.counters.listen, 0);
  });
}

test('合成OS wx占位后create失败保留空DB并拒绝再次校验', async () => fixture(async paths => {
  const context = syntheticStartup('create');
  context.dependencies.validate = () => validateLiveInputs(paths);
  context.dependencies.reserve = path => open(path, 'wx', 0o600);
  await runStartupForTest(context.dependencies);
  assert.equal((await lstat(paths.dbPath)).size, 0);
  await rejectsSafely(paths, 'DB_EXISTS');
}));

async function fixture(action) {
  const directory = await mkdtemp(join(tmpdir(), 'm2-launcher-unit-'));
  const paths = { keyPath: join(directory, 'synthetic-key.bin'), invitePath: join(directory, 'synthetic-invite.txt'), dbPath: join(directory, 'unused.sqlite') };
  try {
    await writeFile(paths.keyPath, Buffer.alloc(32, 0x73));
    await writeFile(paths.invitePath, 'SYNTHETIC_UNIT_ONLY_123456');
    await action(paths, directory);
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + '\\') || resolve(directory).startsWith(resolve(tmpdir()) + '/'));
    await rm(directory, { recursive: true, force: true });
  }
}

async function rejectsSafely(paths, code) {
  await assert.rejects(validateLiveInputs(paths), error => {
    assert.equal(error.code, code); assert.equal(error.message, code);
    assert.ok(!error.message.includes(paths.keyPath)); return true;
  });
}

test('只读合成输入返回固定MAC/loopback/无经济配置，不创建SQLite或服务', async () => {
  await fixture(async paths => {
    const config = await validateLiveInputs(paths);
    assert.deepEqual(Object.keys(config.deviceKeys), ['7c0c5f423686']);
    assert.equal(config.deviceKeys['7c0c5f423686'].length, 32);
    assert.equal(config.host, '127.0.0.1'); assert.equal(config.port, 8787);
    assert.deepEqual(config.origins, ['http://localhost', 'https://localhost']);
    assert.equal(config.aiKey, ''); assert.equal(config.m2Policy, null);
    assert.deepEqual(Object.keys(config).sort(), ['deviceKeys','inviteCode','dbPath','host','port','origins','aiKey','m2Policy'].sort());
    const second = await validateLiveInputs(paths); second.deviceKeys['7c0c5f423686'].fill(0);
    config.deviceKeys['7c0c5f423686'].fill(0);
  });
});
for (const [name, bytes] of [['short', Buffer.alloc(31, 1)], ['long', Buffer.alloc(33, 1)], ['zero', Buffer.alloc(32)]]) {
  test(`拒绝${name}合成key`, async () => fixture(async paths => {
    await writeFile(paths.keyPath, bytes); await rejectsSafely(paths, 'INPUT_INVALID');
  }));
}
for (const invite of ['short', 'SYNTHETIC_UNIT_ONLY_123456\n', '合成测试邀请码不可用', 'x'.repeat(201)]) {
  test('拒绝不合格式或超预算合成邀请码', async () => fixture(async paths => {
    await writeFile(paths.invitePath, invite); await rejectsSafely(paths, 'INPUT_INVALID');
  }));
}
for (const suffix of ['', '-wal', '-shm', '-journal']) {
  test(`拒绝既有DB及sidecar ${suffix || 'DB'}而不打开或迁移`, async () => fixture(async paths => {
    await writeFile(paths.dbPath + suffix, 'SYNTHETIC_EXISTING'); await rejectsSafely(paths, 'DB_EXISTS');
  }));
}
test('缺失key与非普通key不泄露文件路径', async () => fixture(async paths => {
  await rejectsSafely({ ...paths, keyPath: paths.keyPath + '.missing' }, 'INPUT_UNAVAILABLE');
  await rejectsSafely({ ...paths, keyPath: tmpdir() }, 'INPUT_INVALID');
}));
test('拒绝DB symlink和私有目录junction', async () => fixture(async (paths, directory) => {
  const linkedRoot = join(directory, 'linked');
  await symlink(directory, linkedRoot, process.platform === 'win32' ? 'junction' : 'dir');
  await rejectsSafely({ ...paths, keyPath: join(linkedRoot, 'synthetic-key.bin') }, 'INPUT_INVALID');
}));
