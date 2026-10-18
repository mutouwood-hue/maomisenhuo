/* Isolated local BLE adapter. Legacy codec/client preserved from provided archive.
 * No cloud, no pet/social writers, no automatic scan/connect/START_LOCAL.
 * Native transport must be LocalBleBridge; all extended ports remain absent. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.CatOfflineBleAdapter = api;
    if (root.CatOfflineBleNative && root.CatOfflineHost) {
      const control = api.createControl({ bridge: root.CatOfflineBleNative });
      api.control = control;
      root.CatOfflineHost.attachPorts({ control });
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';

const OP = Object.freeze({ HELLO: 1, GET_STATE: 2, START_LOCAL: 3, PING: 4, SET_FACE: 5, ACK: 0x80, STATE: 0x81 });
const UUIDS = Object.freeze({ service: 'e7f1a000-1c9b-4a7e-9d2f-3b8c5e6f7a00', rx: 'e7f1a000-1c9b-4a7e-9d2f-3b8c5e6f7a01', tx: 'e7f1a000-1c9b-4a7e-9d2f-3b8c5e6f7a02' });
function bytes(input) {
  if (!(input instanceof Uint8Array) && !Array.isArray(input)) throw new Error('Expected bytes');
  if ([...input].some(value => !Number.isInteger(value) || value < 0 || value > 255)) throw new Error('Invalid byte');
  return Uint8Array.from(input);
}
function encodeRequest(opcode, sequence, payload = []) {
  const value = bytes(payload);
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 65535) throw new Error('Invalid sequence');
  if (![1, 2, 3, 4, 5, 6, 7, 16, 17, 18, 19].includes(opcode)) throw new Error('Unsupported request opcode');
  if (value.length > 12 || ((opcode === 6 || opcode === 7) && value.length !== 0) || (opcode === 16 && value.length !== 9) || (opcode === 17 && (value.length < 4 || value.length > 12)) || (opcode === 18 && value.length !== 2) || (opcode === 19 && value.length !== 2)) throw new Error('Invalid extension payload');
  if ((opcode <= 3 && value.length !== 0) || (opcode === 4 && value.length > 10) || (opcode === 5 && (value.length !== 1 || value[0] > 2))) throw new Error('Invalid request payload');
  const frame = new Uint8Array(20);
  frame.set([0x42, 0x4a, 1, opcode, sequence & 255, sequence >> 8, value.length, 0]);
  frame.set(value, 8);
  return frame;
}
function decodeFrame(input) {
  const frame = bytes(input);
  if (frame.length !== 20 || frame[0] !== 0x42 || frame[1] !== 0x4a || frame[2] !== 1 || frame[7] !== 0 || frame[6] > 12 || frame.slice(8 + frame[6]).some(value => value !== 0)) throw new Error('Malformed BLE local v1 frame');
  const sequence = frame[4] | (frame[5] << 8);
  const payload = frame.slice(8, 8 + frame[6]);
  if (frame[3] === OP.ACK) {
    if (sequence === 0 || payload.length < 2 || ![1, 2, 3, 4, 5, 6, 7, 16, 17, 18, 19].includes(payload[0]) || payload[1] > 4) throw new Error('Malformed ACK');
    return { type: 'ack', sequence, originalOpcode: payload[0], status: payload[1], data: payload.slice(2) };
  }
  if (frame[3] === OP.STATE && sequence === 0 && payload.length === 10) return { type: 'state', state: decodeState(payload) };
  throw new Error('Unexpected inbound opcode or sequence');
}
function decodeHello(input) {
  const value = bytes(input);
  if (value.length !== 8 || value[0] !== 1 || value[1] !== 15) throw new Error('Unsupported HELLO version/capabilities');
  return { version: value[0], capabilities: value[1], mac: [...value.slice(2)].map(byte => byte.toString(16).padStart(2, '0')).join(':') };
}
function decodeState(input) {
  const value = bytes(input);
  if (value.length !== 10 || value[3] > 15 || value[4] > 2 || (value[5] > 100 && value[5] !== 255) || value[6] > 2 || ![0, 1, 255].includes(value[7])) throw new Error('Malformed device state');
  return { screen: value[0], step: value[1], phase: value[2], flags: { local: !!(value[3] & 1), authenticated: !!(value[3] & 2), tutorial: !!(value[3] & 4), suspended: !!(value[3] & 8) }, face: value[4], battery: value[5] === 255 ? null : value[5], power: ['unknown', 'normal', 'low'][value[6]], usb: value[7] === 255 ? null : value[7] === 1, revision: value[8] | (value[9] << 8) };
}
function encodeBase64(input) { return btoa(String.fromCharCode(...bytes(input))); }
function decodeBase64(input) { return Uint8Array.from(atob(input), value => value.charCodeAt(0)); }


// Transport is injected: protocol correlation is testable without an Android radio.
class BleLocalClient {
  constructor(transport, { timeoutMs = 5000, onChange = () => {} } = {}) {
    this.transport = transport;
    this.timeoutMs = timeoutMs;
    this.onChange = onChange;
    this.generation = null;
    this.sequence = 0;
    this.pending = null;
    this.listeners = [];
    this.isReady = false;
    this.isInitializing = false;
    this.hello = null;
    this.state = null;
    this.disposed = false;
  }
  async initialize() {
    for (const [name, callback] of [['frame', event => this.handleFrame(event)], ['connection', event => this.handleConnection(event)], ['device', event => this.onChange({ type: 'device', ...event })]]) {
      const listener = await this.transport.addListener(name, callback);
      if (this.disposed) await listener.remove(); else this.listeners.push(listener);
    }
  }
  handleConnection(event) {
    if (this.disposed) return;
    if (event.state !== 'ready') {
      this.invalidate('BLE session ended; a mutation result may be unknown');
      this.onChange({ type: 'connection', ...event });
      return;
    }
    this.onChange({ type: 'connection', ...event });
    if (this.generation === event.generation && (this.isReady || this.isInitializing)) return;
    this.invalidate('New BLE session');
    this.generation = event.generation;
    this.sequence = 0;
    this.isInitializing = true;
    const token = this.generation;
    // Reconnect repairs state; never replays START_LOCAL / SET_FACE.
    void (async () => {
      try {
        const hello = decodeHello(await this.request(OP.HELLO, [], true));
        const state = decodeState(await this.request(OP.GET_STATE, [], true));
        if (this.generation !== token) return;
        this.hello = hello; this.isReady = true; this.isInitializing = false;
        this.onChange({ type: 'ready', hello, state: this.acceptState(state) });
      } catch (error) {
        if (this.generation !== token) return;
        this.onChange({ type: 'error', message: error.message });
        void this.disconnect();
      }
    })();
  }
  invalidate(reason) {
    this.generation = null; this.isReady = false; this.isInitializing = false;
    this.hello = null; this.state = null;
    if (this.pending) this.settle(this.pending, new Error(reason));
  }
  settle(pending, error, result) {
    if (this.pending !== pending) return;
    clearTimeout(pending.timer);
    this.pending = null;
    if (error) pending.reject(error); else pending.resolve(result);
  }
  handleFrame(event) {
    if (this.disposed || event.generation !== this.generation) return;
    let frame;
    try { frame = decodeFrame(decodeBase64(event.value)); }
    catch (error) { this.onChange({ type: 'protocolError', message: error.message }); return; }
    if (frame.type === 'state') {
      this.acceptState(frame.state);
      return;
    }
    const pending = this.pending;
    if (!pending || frame.sequence !== pending.sequence || frame.originalOpcode !== pending.opcode) return;
    if (frame.status !== 0) { this.settle(pending, new Error(`Device rejected opcode ${pending.opcode}: status ${frame.status}`)); return; }
    try {
      if (pending.opcode === OP.HELLO) decodeHello(frame.data);
      if (pending.opcode === OP.GET_STATE) decodeState(frame.data);
      if (pending.opcode === OP.PING && (frame.data.length !== pending.payload.length || frame.data.some((value, index) => value !== pending.payload[index]))) throw new Error('PING echo mismatch');
      pending.ack = frame.data;
      // Both the GATT response and correlated application ACK must arrive.
      if (pending.written) this.settle(pending, null, frame.data);
    } catch (error) { this.settle(pending, error); }
  }
  request(opcode, payload = [], internal = false) {
    if (this.disposed || this.generation === null || (!internal && !this.isReady)) return Promise.reject(new Error('BLE local handshake is not ready'));
    if (this.pending) return Promise.reject(new Error('Wait for the pending command'));
    if (this.sequence >= 65535) return Promise.reject(new Error('Sequence exhausted; disconnect and reconnect before sending more commands'));
    const value = bytes(payload);
    const sequence = this.sequence + 1;
    const frame = encodeRequest(opcode, sequence, value);
    this.sequence = sequence;
    const generation = this.generation;
    return new Promise((resolve, reject) => {
      const pending = { opcode, sequence, payload: value, resolve, reject, written: false, ack: null, timer: null };
      this.pending = pending;
      pending.timer = setTimeout(() => {
        this.settle(pending, new Error('Application ACK timed out; mutation outcome is unknown. No command was retried.'));
      }, this.timeoutMs);
      void this.transport.write({ generation, value: encodeBase64(frame) }).then(result => {
        if (this.pending !== pending || this.generation !== generation) return;
        if (result.generation !== generation) { this.settle(pending, new Error('Stale write completion')); return; }
        pending.written = true;
        if (pending.ack !== null) this.settle(pending, null, pending.ack);
      }).catch(error => this.settle(pending, error));
    });
  }
  acceptState(state) {
    const delta = this.state === null ? null : (state.revision - this.state.revision) & 0xffff;
    if (delta === null || (delta > 0 && delta < 0x8000)) {
      this.state = state;
      this.onChange({ type: 'state', state });
    }
    return this.state;
  }
  async getState() {
    const token = this.generation;
    const state = decodeState(await this.request(OP.GET_STATE));
    if (token !== this.generation) throw new Error('State belongs to an ended session');
    return this.acceptState(state);
  }
  async disconnect() {
    this.invalidate('Manual disconnect; automatic reconnect stopped');
    await this.transport.disconnect();
  }
  async dispose() {
    this.disposed = true;
    this.invalidate('Client disposed');
    await Promise.all(this.listeners.splice(0).map(listener => listener.remove()));
    await this.transport.disconnect();
  }
}

const FAMILY = 'legacy-e7f1-bj20';
const clone = value => JSON.parse(JSON.stringify(value));
function fault(code, message, outcome = 'no_change') {
  const error = new Error(message); error.code = code; error.outcome = outcome; return error;
}
function classify(error) {
  if (error?.code) return error;
  const message = error?.message || String(error);
  if (/ACK timed out|outcome is unknown|mutation result may be unknown/i.test(message)) return fault('ACK_TIMEOUT_OUTCOME_UNKNOWN', '设备未确认本次结果；请重新连接读取状态，指令不会自动重发。', 'unknown');
  if (/Malformed|Unsupported HELLO|Unexpected inbound/i.test(message)) return fault('UNSUPPORTED_PROTOCOL', '吧唧尚未确认 BJ20 协议；同名蓝牙服务可能是旧协议，不能继续控制。');
  if (/rejected opcode/i.test(message)) return fault('DEVICE_REJECTED', message);
  if (/pending command|busy|Sequence exhausted/i.test(message)) return fault('BUSY', message);
  return fault('NOT_READY', message);
}
let routedTransport = null;
let nextInstance = 1;
class NativeTransport {
  constructor(bridge, timeoutMs = 15000) {
    if (!bridge || typeof bridge.postMessage !== 'function') throw fault('NOT_READY', '原生蓝牙桥尚未接入。');
    this.bridge = bridge; this.timeoutMs = timeoutMs; this.listeners = new Map();
    this.pending = new Map(); this.sequence = 0; this.prefix = `ble-${nextInstance++}-`; this.closed = false;
    this.latestReady = null;
  }
  addListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(callback);
    return Promise.resolve({ remove: async () => this.listeners.get(name)?.delete(callback) });
  }
  rpc(method, args = {}, timeoutMs = this.timeoutMs) {
    if (this.closed) return Promise.reject(fault('NOT_READY', '蓝牙适配器已经关闭。'));
    const requestId = this.prefix + (++this.sequence);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(fault(method === 'write' ? 'ACK_TIMEOUT_OUTCOME_UNKNOWN' : 'NOT_READY', '原生蓝牙操作未在时限内确认。', method === 'write' ? 'unknown' : 'no_change'));
      }, timeoutMs);
      this.pending.set(requestId, { resolve, reject, timer, method });
      try { this.bridge.postMessage(JSON.stringify({ requestId, method, args })); }
      catch (error) { clearTimeout(timer); this.pending.delete(requestId); reject(classify(error)); }
    });
  }
  receive(input) {
    if (this.closed) return;
    let event;
    try { event = typeof input === 'string' ? JSON.parse(input) : input; } catch { return; }
    if (!event || typeof event !== 'object') return;
    if (event.type === 'result') {
      const request = this.pending.get(event.requestId); if (!request) return;
      clearTimeout(request.timer); this.pending.delete(event.requestId);
      if (event.ok === true) request.resolve(event.result ?? {});
      else request.reject(fault(event.error?.code || 'NOT_READY', event.error?.message || '原生蓝牙操作未确认。', event.error?.outcome || (request.method === 'write' ? 'unknown' : 'no_change')));
      return;
    }
    if (event.type === 'connection') {
      if (event.state === 'ready') this.latestReady = event;
      else this.latestReady = null;
    }
    for (const callback of this.listeners.get(event.type) || []) callback(event);
  }
  write(value) { return this.rpc('write', { generation: value.generation, base64: value.value }); }
  disconnect() { return this.rpc('disconnect'); }
  close() {
    this.closed = true; this.latestReady = null;
    for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(fault('NOT_READY', '蓝牙适配器已关闭。')); }
    this.pending.clear(); this.listeners.clear();
    if (routedTransport === this) routedTransport = null;
  }
}
class LocalControl {
  constructor({ bridge, commandTimeoutMs = 5000, nativeTimeoutMs = 15000, connectTimeoutMs = 35000 }) {
    this.protocolFamily = FAMILY; this.transport = new NativeTransport(bridge, nativeTimeoutMs);
    this.link = { stage: 'disconnected' }; this.listeners = new Set(); this.devices = new Map();
    this.selectedAddress = null; this.connectWait = null; this.connectTimeoutMs = connectTimeoutMs;
    this.initialized = null; this.disposed = false; this.failed = false; this.operation = false;
    this.client = new BleLocalClient(this.transport, { timeoutMs: commandTimeoutMs, onChange: event => this.onClientEvent(event) });
    this.receive = input => this.transport.receive(input);
  }
  getState() { return clone(this.link); }
  subscribe(callback) { this.listeners.add(callback); callback(this.getState()); return () => this.listeners.delete(callback); }
  emit(value) { this.link = value; for (const listener of this.listeners) { try { listener(this.getState()); } catch {} } }
  fail(input, disconnect = false) {
    if (this.failed && this.link.stage === 'error') return fault(this.link.error.code, this.link.error.message, this.link.error.outcome);
    const error = classify(input); this.failed = true;
    this.emit({ stage: 'error', error: { code: error.code, message: error.message, outcome: error.outcome }, generation: this.client.generation });
    if (this.connectWait) { clearTimeout(this.connectWait.timer); this.connectWait.reject(error); this.connectWait = null; }
    if (disconnect) void this.client.disconnect().catch(() => {});
    return error;
  }
  rememberDevice(event) {
    if (event.source !== 'native_scan' || !/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(event.address || '') || !Number.isFinite(event.rssi)) return;
    this.devices.set(event.address.toUpperCase(), { address: event.address, name: String(event.name || '').slice(0,100), rssi: event.rssi, source: 'native_scan' });
  }
  onClientEvent(event) {
    if (this.disposed) return;
    if (event.type === 'device') { if (this.link.stage === 'scanning') this.rememberDevice(event); return; }
    if (event.type === 'protocolError') { this.fail(fault('UNSUPPORTED_PROTOCOL', '设备返回的帧不符合 BJ20；连接未确认，未发送控制动作。'), true); return; }
    if (event.type === 'error') { if (!this.failed) this.fail(event.message ? new Error(event.message) : event, true); return; }
    if (event.type === 'connection') {
      if (event.state === 'disconnected') {
        if (!this.failed) this.emit({ stage: 'disconnected' });
        if (this.connectWait) this.fail(fault('NOT_READY', '吧唧连接已断开，尚未完成本地握手。'));
        return;
      }
      if (!Number.isInteger(event.generation) || event.generation < 0 || !this.selectedAddress || event.address?.toUpperCase() !== this.selectedAddress.toUpperCase()) return;
      if (event.state === 'ready') {
        if (this.client.isReady && this.client.generation === event.generation && this.link.stage === 'ready_local') return;
        const evidence = this.evidence(event);
        this.emit({ stage: 'handshaking', evidence });
      } else if (['connecting','discovering','subscribing'].includes(event.state)) {
        this.emit({ stage: event.state, deviceAddress: event.address, generation: event.generation });
      }
      return;
    }
    if (event.type === 'ready') {
      if (this.failed) return;
      const native = this.transport.latestReady;
      const evidence = native ? this.evidence(native) : null;
      if (!evidence || native.generation !== this.client.generation || native.address?.toUpperCase() !== this.selectedAddress?.toUpperCase() || !evidence.serviceVerified || !evidence.rxVerified || !evidence.txVerified || !evidence.subscribed) {
        this.fail(fault('NOT_READY', '原生服务或订阅证据缺失，不能确认连接。'), true); return;
      }
      this.failed = false;
      this.emit({ stage: 'ready_local', evidence, hello: event.hello, device: event.state, capabilities: { legacyControl: 'verified', snapshotSync: 'unavailable', durableEvents: 'unavailable', peerEncounter: 'unavailable' } });
      if (this.connectWait) { clearTimeout(this.connectWait.timer); this.connectWait.resolve(this.getState()); this.connectWait = null; }
      return;
    }
    if (event.type === 'state' && this.link.stage === 'ready_local') this.emit({ ...this.link, device: event.state });
  }
  evidence(native) {
    return { source: 'native', generation: native.generation, deviceAddress: native.address,
      serviceVerified: native.serviceVerified === true, rxVerified: native.rxVerified === true,
      txVerified: native.txVerified === true, subscribed: native.subscribed === true };
  }
  async initialize() {
    if (this.disposed) throw fault('NOT_READY', '适配器已关闭。');
    if (!this.initialized) this.initialized = (async () => {
      await this.client.initialize();
      const availability = await this.transport.rpc('initialize');
      if (availability.available === false) this.fail(fault('NOT_READY', '这台手机没有可用的蓝牙接口。'));
      else if (availability.bluetoothEnabled === false) this.emit({ stage: 'bluetooth_off' });
      else if (availability.granted === false) this.emit({ stage: 'permission_required' });
    })();
    return this.initialized;
  }
  requireUser(command) { if (command?.origin !== 'explicit_user_action') throw fault('NOT_READY', '此操作需要用户明确选择。'); }
  async requestPermissions(command) {
    this.requireUser(command); await this.initialize();
    const result = await this.transport.rpc('requestPermissions');
    if (result.available === false) throw this.fail(fault('NOT_READY', '这台手机没有可用蓝牙。'));
    if (result.bluetoothEnabled === false) this.emit({ stage: 'bluetooth_off' });
    else if (result.granted !== true) this.emit({ stage: 'permission_required' });
    else { this.failed = false; if (!this.client.isReady) this.emit({ stage: 'disconnected' }); }
    return { granted: result.granted === true };
  }
  async scan(command) {
    this.requireUser(command); await this.initialize();
    if (this.operation || this.client.isReady || this.connectWait) throw fault('BUSY', '请先结束当前连接或操作。');
    if (!Number.isInteger(command.durationMs) || command.durationMs < 1000 || command.durationMs > 10000) throw fault('NOT_READY', '扫描时长不合法。');
    this.failed = false; this.devices.clear(); this.emit({ stage: 'scanning' }); this.operation = true;
    try {
      const result = await this.transport.rpc('scan', { durationMs: command.durationMs }, command.durationMs + 5000);
      for (const device of result.devices || []) this.rememberDevice(device);
      const devices = [...this.devices.values()]; this.emit({ stage: 'selecting', devices }); return clone(devices);
    } catch (error) { void this.transport.rpc('stopScan').catch(() => {}); throw this.fail(error); }
    finally { this.operation = false; }
  }
  async connect(device, command) {
    this.requireUser(command); await this.initialize();
    if (this.operation || this.connectWait || this.client.isReady) throw fault('BUSY', '请先断开当前连接。');
    const actual = this.devices.get(String(device?.address || '').toUpperCase());
    if (!actual || device?.source !== 'native_scan') throw fault('NOT_READY', '请选择本轮实际扫描到的吧唧。');
    this.selectedAddress = actual.address; this.failed = false;
    const ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(fault('NOT_READY', '连接或握手超时，未确认设备协议。'), true), this.connectTimeoutMs);
      this.connectWait = { resolve, reject, timer };
    });
    // Native emits progress and subscription evidence; UUID alone never makes ready_local.
    void this.transport.rpc('connect', { address: actual.address }, this.connectTimeoutMs).catch(error => this.fail(error, true));
    return ready;
  }
  async command(opcode, payload = [], user = null) {
    if (this.operation) throw fault('BUSY', '请等待当前设备操作。');
    if (!this.client.isReady || this.link.stage !== 'ready_local') throw fault('NOT_READY', '吧唧本地握手尚未完成。');
    if (user) { this.requireUser(user); if (typeof user.requestId !== 'string' || !user.requestId.length || user.requestId.length > 128) throw fault('NOT_READY', '操作编号不合法。'); if (user.generation !== this.client.generation) throw fault('STALE_GENERATION', '连接已变化，请重新选择操作。'); }
    const generation = this.client.generation, sequence = this.client.sequence + 1;
    this.operation = true;
    try {
      const data = await this.client.request(opcode, payload);
      if (generation !== this.client.generation) throw fault('STALE_GENERATION', '回执来自已结束的连接。');
      return { generation, sequence, originalOpcode: opcode, status: 0, gattWriteCompleted: true, data };
    } catch (error) { throw this.fail(error, true); }
    finally { this.operation = false; }
  }
  async readDeviceState() {
    const result = await this.command(OP.GET_STATE); const state = decodeState(result.data);
    this.client.acceptState(state); return { ...result, data: this.client.state };
  }
  async startLocal(user) {
    const result = await this.command(OP.START_LOCAL, [], user);
    // This read confirms device state only. It does not settle pet care or mark tutorial complete.
    try { await this.readDeviceState(); } catch (error) { result.stateReadError = { code: error.code, message: error.message }; }
    return result;
  }
  async setFace(face, user) {
    if (![0,1,2].includes(face)) throw fault('NOT_READY', '表盘编号必须是0、1或2。');
    const result = await this.command(OP.SET_FACE, [face], user);
    try { await this.readDeviceState(); } catch (error) { result.stateReadError = { code: error.code, message: error.message }; }
    return result;
  }
  async disconnect() {
    this.failed = false;
    if (this.connectWait) { clearTimeout(this.connectWait.timer); this.connectWait.reject(fault('NOT_READY', '已取消连接。')); this.connectWait = null; }
    await this.client.disconnect(); this.selectedAddress = null; this.emit({ stage: 'disconnected' });
  }
  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.connectWait) { clearTimeout(this.connectWait.timer); this.connectWait.reject(fault('NOT_READY', '适配器已关闭。')); this.connectWait = null; }
    try { await this.client.dispose(); } finally {
      try { await this.transport.rpc('dispose'); } catch {}
      this.transport.close(); this.listeners.clear(); this.link = { stage: 'disconnected' };
    }
  }
}
function createControl(options) {
  if (routedTransport && !routedTransport.closed) throw fault('BUSY', '当前页面已有蓝牙适配器。');
  const control = new LocalControl(options); routedTransport = control.transport; return control;
}
return { createControl, receive: input => routedTransport?.receive(input), codec: { OP, UUIDS, encodeRequest, decodeFrame, decodeHello, decodeState, encodeBase64, decodeBase64 } };
});
