import { lstat, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { format } from 'node:util';
import { createApplication } from '../backend/src/app.mjs';

const DEVICE_ID = '7c0c5f423686';
const KEY_BYTES = 32;
const INVITE_MIN_BYTES = 16;
const INVITE_MAX_BYTES = 200;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PRIVATE_ROOT = resolve(ROOT, 'build/m2-device-private');
const FIXED_PATHS = Object.freeze({
  keyPath: resolve(PRIVATE_ROOT, 'device-key.bin'),
  invitePath: resolve(PRIVATE_ROOT, 'invite-code.txt'),
  dbPath: resolve(PRIVATE_ROOT, 'live-m2.sqlite'),
});
const SAFE_CODES = new Set(['INPUT_UNAVAILABLE', 'INPUT_INVALID', 'DB_EXISTS', 'ARGUMENTS_REJECTED', 'START_FAILED', 'CLOSE_FAILED']);

class LauncherError extends Error {
  constructor(code) { super(code); this.name = 'LauncherError'; this.code = code; }
}

async function requirePlainParents(path) {
  let parent = dirname(resolve(path));
  for (;;) {
    const status = await lstat(parent);
    if (!status.isDirectory() || status.isSymbolicLink()) throw new LauncherError('INPUT_INVALID');
    const next = dirname(parent);
    if (next === parent) return;
    parent = next;
  }
}

export async function readBoundedFileForTest(path, minimum, maximum, io = { lstat, open }) {
  let handle;
  let bytes;
  let result;
  let failure;
  try {
    await requirePlainParents(path);
    const before = await io.lstat(path);
    if (!before.isFile() || before.isSymbolicLink() || before.size < minimum || before.size > maximum) throw new LauncherError('INPUT_INVALID');
    handle = await io.open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size) throw new LauncherError('INPUT_INVALID');
    bytes = Buffer.alloc(maximum + 1);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    if (bytesRead < minimum || bytesRead > maximum) throw new LauncherError('INPUT_INVALID');
    result = (io.copy ?? Buffer.from)(bytes.subarray(0, bytesRead));
  } catch (error) {
    failure = error instanceof LauncherError ? error : new LauncherError('INPUT_UNAVAILABLE');
  } finally {
    bytes?.fill(0);
    try { await handle?.close(); }
    catch { failure ??= new LauncherError('INPUT_UNAVAILABLE'); }
    if (failure) result?.fill(0);
  }
  if (failure) throw failure;
  return result;
}
const readBoundedFile = readBoundedFileForTest;

async function requireAbsentDatabase(dbPath) {
  await requirePlainParents(dbPath);
  for (const path of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`]) {
    try { await lstat(path); }
    catch (error) { if (error.code === 'ENOENT') continue; throw new LauncherError('INPUT_UNAVAILABLE'); }
    throw new LauncherError('DB_EXISTS');
  }
}

/** 测试可传OS临时路径；真实入口不接收路径、密钥或配置CLI参数。只读校验，不创建DB/服务。 */
export async function validateLiveInputs(paths = FIXED_PATHS) {
  let key;
  let inviteBytes;
  try {
    await requireAbsentDatabase(paths.dbPath);
    key = await readBoundedFile(paths.keyPath, KEY_BYTES, KEY_BYTES);
    if (!key.some(byte => byte !== 0)) throw new LauncherError('INPUT_INVALID');
    inviteBytes = await readBoundedFile(paths.invitePath, INVITE_MIN_BYTES, INVITE_MAX_BYTES);
    // 私有邀请码使用无空白ASCII；不猜格式、不接受隐藏换行或二进制秘密。
    const inviteCode = inviteBytes.toString('utf8');
    if (!/^[A-Za-z0-9_-]{16,200}$/.test(inviteCode)) throw new LauncherError('INPUT_INVALID');
    return { deviceKeys: { [DEVICE_ID]: key }, inviteCode, dbPath: resolve(paths.dbPath), host: '127.0.0.1', port: 8787,
      origins: ['http://localhost', 'https://localhost'], aiKey: '', m2Policy: null };
  } catch (error) {
    key?.fill(0);
    if (error instanceof LauncherError) throw error;
    throw new LauncherError('INPUT_UNAVAILABLE');
  } finally { inviteBytes?.fill(0); }
}

function logBoundary(level, traceId, code) {
  const safeCode = SAFE_CODES.has(code) || ['LISTENING', 'CLOSED'].includes(code) ? code : 'START_FAILED';
  // 秘密边界只输出白名单错误码：禁止异常message/stack/path/key/hash/邀请码。
  process.stderr.write(format('%s %s [main] [%s] m2-live-backend - %s\n', new Date().toISOString(), level, traceId, safeCode));
}

/** 合成生命周期测试入口；真实launch只注入下面固定生产依赖，不接受CLI配置。 */
export async function runStartupForTest(dependencies) {
  const { validate, reserve, create, signals, listen, log, setExitCode } = dependencies;
  let config;
  let app;
  let isCancelled = false;
  let state = 'STARTING';
  let closePromise;
  const wipe = () => config?.deviceKeys[DEVICE_ID].fill(0);
  const close = () => {
    if (closePromise) return closePromise;
    state = 'CLOSING';
    closePromise = (async () => {
      try { if (app) await app.close(); log('INFO', 'CLOSED'); }
      catch { setExitCode(1); log('ERROR', 'CLOSE_FAILED'); }
      finally { wipe(); state = 'CLOSED'; for (const signal of ['SIGINT', 'SIGTERM']) signals.removeListener(signal, cancel); }
    })();
    return closePromise;
  };
  const cancel = () => {
    isCancelled = true;
    // pending listen先完成/失败再关闭，不能先关闭DB再使server随后开始监听。
    if (state === 'LISTENING') void close();
  };
  for (const signal of ['SIGINT', 'SIGTERM']) signals.once(signal, cancel);
  try {
    config = await validate();
    if (isCancelled) { await close(); return { close }; }
    const reservation = await reserve(config.dbPath);
    await reservation.close();
    if (isCancelled) { await close(); return { close }; }
    app = create({ env: {}, config });
    if (isCancelled) { await close(); return { close }; }
    state = 'LISTEN_PENDING';
    await listen(app.server, config);
    if (isCancelled) { await close(); return { close }; }
    state = 'LISTENING';
    log('INFO', 'LISTENING');
  } catch (error) {
    setExitCode(1);
    log('ERROR', error instanceof LauncherError ? error.code : 'START_FAILED');
    await close();
  }
  return { close };
}

async function launch() {
  const traceId = randomUUID();
  if (process.argv.length !== 2) { process.exitCode = 1; logBoundary('ERROR', traceId, 'ARGUMENTS_REJECTED'); return; }
  await runStartupForTest({
    validate: () => validateLiveInputs(),
    // 原子占位失败后保留DB，不自动删除/重试/迁移。
    reserve: path => open(path, 'wx', 0o600),
    create: createApplication,
    signals: process,
    listen: (server, config) => new Promise((resolveListen, rejectListen) => {
      const failed = error => { server.removeListener('listening', ready); rejectListen(error); };
      const ready = () => { server.removeListener('error', failed); resolveListen(); };
      server.once('error', failed); server.once('listening', ready);
      try { server.listen(config.port, config.host); }
      catch (error) { server.removeListener('error', failed); server.removeListener('listening', ready); rejectListen(error); }
    }),
    log: (level, code) => logBoundary(level, traceId, code),
    setExitCode: code => { process.exitCode = code; },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await launch();
