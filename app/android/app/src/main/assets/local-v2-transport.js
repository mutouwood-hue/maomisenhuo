/* Isolated CFLOCAL2 transport. No save writer, persistent sequence owner, radio startup or replay. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CatLocalV2Transport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';
const OPS = new Set(['hello', 'state', 'events', 'snapshot', 'ack', 'day', 'care_capabilities']);
const MUTATIONS = new Set(['snapshot', 'ack']);
const MAX_LINE = 2048;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const safe = value => Number.isSafeInteger(value) && value >= 0;
const ascii = (value, max) => typeof value === 'string' && value.length >= 1 && value.length <= max && /^[\x21-\x7e]+$/.test(value);
const deviceId = value => typeof value === 'string' && /^[0-9a-f]{32}$/i.test(value);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const copy = value => JSON.parse(JSON.stringify(value));
function fault(code, message, outcome = 'no_change') { const error = new Error(message); error.code = code; error.outcome = outcome; return error; }
function keys(object, allowed) {
  if (!plain(object) || Object.keys(object).some(key => !allowed.includes(key))) throw fault('BAD_REQUEST', 'Unexpected object fields');
}
function requireUser(command) {const saved=command?.savedDevice;if(plain(command)&&command.origin==='saved_device_reconnect'&&saved?.schema===1&&saved.enabled===true&&deviceId(saved.deviceId))return;if (!plain(command) || command.origin !== 'explicit_user_action') throw fault('NOT_READY', 'Explicit user action or saved-device authorization is required'); }
function timeoutOption(value, fallback) { return value === undefined ? fallback : Number.isFinite(value) && value > 0 ? value : (() => { throw fault('BAD_REQUEST', 'Invalid timeout'); })(); }
function b64encode(bytes) { let text = ''; for (const value of bytes) text += String.fromCharCode(value); return btoa(text); }
function b64decode(value) {
  if (typeof value !== 'string' || !value.length || value.length > 684 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw fault('UNSUPPORTED_PROTOCOL', 'Invalid notification Base64');
  let raw; try { raw = atob(value); } catch { throw fault('UNSUPPORTED_PROTOCOL', 'Invalid notification Base64'); }
  const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
  if (!bytes.length || bytes.length > 512 || b64encode(bytes) !== value) throw fault('UNSUPPORTED_PROTOCOL', 'Noncanonical notification bytes');
  return bytes;
}

/** Validate JSON syntax before JSON.parse loses duplicate (including escaped) property names. */
function strictJSON(text) {
  if (typeof text !== 'string' || text.includes('\0')) throw fault('UNSUPPORTED_PROTOCOL', 'NUL is not JSON protocol data');
  let offset = 0;
  const bad = message => { throw fault('UNSUPPORTED_PROTOCOL', message || 'Malformed JSON'); };
  const ws = () => { while (/[\x20\x09\x0d\x0a]/.test(text[offset] || '\uffff')) offset++; };
  function string() {
    const start = offset++;
    while (offset < text.length) {
      const char = text[offset++];
      if (char === '\\') { offset++; continue; }
      if (char === '"') {
        let value; try { value = JSON.parse(text.slice(start, offset)); } catch { bad(); }
        if (value.includes('\0')) bad('Escaped NUL is forbidden');
        for (let i = 0; i < value.length; i++) {
          const unit = value.charCodeAt(i);
          if (unit >= 0xd800 && unit <= 0xdbff) { const low = value.charCodeAt(++i); if (!(low >= 0xdc00 && low <= 0xdfff)) bad('Unpaired surrogate'); }
          else if (unit >= 0xdc00 && unit <= 0xdfff) bad('Unpaired surrogate');
        }
        return value;
      }
    }
    bad();
  }
  function value(depth) {
    if (depth > 16) bad('JSON nesting exceeds 16');
    ws(); const char = text[offset];
    if (char === '{' || char === '[') {
      const object = char === '{', close = object ? '}' : ']'; offset++; ws();
      if (text[offset] === close) { offset++; return; }
      const names = new Set();
      while (true) {
        if (object) {
          if (text[offset] !== '"') bad();
          const name = string(); if (names.has(name)) bad('Duplicate JSON key'); names.add(name);
          ws(); if (text[offset++] !== ':') bad();
        }
        value(depth + 1); ws();
        const delimiter = text[offset++]; if (delimiter === close) return;
        if (delimiter !== ',') bad(); ws();
      }
    }
    if (char === '"') { string(); return; }
    for (const literal of ['true', 'false', 'null']) if (text.startsWith(literal, offset)) { offset += literal.length; return; }
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(offset));
    if (!match) bad();
    const number = Number(match[0]); if (!Number.isFinite(number) || Number.isInteger(number) && !Number.isSafeInteger(number)) bad('Unsafe JSON number');
    offset += match[0].length;
  }
  value(0); ws(); if (offset !== text.length) bad();
  let result; try { result = JSON.parse(text); } catch { bad(); }
  if (!plain(result)) bad('A protocol message must be an object');
  return result;
}
function helloData(value) {
  if (!plain(value) || value.protocol !== 'CFLOCAL2' || value.maxLine !== MAX_LINE || !deviceId(value.deviceId) ||
      !Array.isArray(value.capabilities) || value.capabilities.length > 16 || value.capabilities.some(item => !ascii(item, 32)) ||
      new Set(value.capabilities).size !== value.capabilities.length || !['scene', 'snapshot', 'events'].every(item => value.capabilities.includes(item)) ||
      !(value.clientId === null || ascii(value.clientId, 64)) || !safe(value.lastSeq)) throw fault('UNSUPPORTED_PROTOCOL', 'HELLO did not verify CFLOCAL2 capabilities');
  return value;
}
function stateData(value, hello) {
  if (!plain(value) || !deviceId(value.deviceId) || value.deviceId.toLowerCase() !== hello.deviceId.toLowerCase() ||
      typeof value.hasSnapshot !== 'boolean' || typeof value.storageError !== 'boolean' || !safe(value.pending) || !safe(value.lastAck) || !safe(value.lastSeq) ||
      !(value.clientId === null || ascii(value.clientId, 64)) || value.hasSnapshot && !plain(value.snapshot)) throw fault('UNSUPPORTED_PROTOCOL', 'Invalid device state');
  return value;
}
function response(text) {
  const value = strictJSON(text);
  try { keys(value, ['v', 'id', 'op', 'ok', 'data', 'error']); } catch { throw fault('UNSUPPORTED_PROTOCOL','Unexpected response fields'); }
  if (value.v !== 2 || !ascii(value.id, 64) || !OPS.has(value.op) || typeof value.ok !== 'boolean') throw fault('UNSUPPORTED_PROTOCOL', 'Invalid CFLOCAL2 response envelope');
  if (value.ok ? !plain(value.data) || 'error' in value : 'data' in value || !plain(value.error) || !ascii(value.error.code, 64) || !['no_change', 'unknown'].includes(value.error.outcome))
    throw fault('UNSUPPORTED_PROTOCOL', 'Invalid CFLOCAL2 result');
  return value;
}
let instance = 0;
class Control {
  constructor({bridge, commandTimeoutMs, nativeTimeoutMs} = {}) {
    if (!bridge || typeof bridge.postMessage !== 'function') throw fault('NOT_READY', 'Main-frame native port is unavailable');
    this.protocolFamily = 'cflocal2'; this.bridge = bridge;
    this.commandTimeoutMs = timeoutOption(commandTimeoutMs, 8000); this.nativeTimeoutMs = timeoutOption(nativeTimeoutMs, 25000);
    this.prefix = 'cfl2-' + (++instance) + '-'; this.rpcSequence = 0; this.commandSequence = 0;
    this.rpcPending = new Map(); this.listeners = new Set(); this.devices = new Map(); this.line = [];
    this.link = {stage:'disconnected'}; this.mode = 'off'; this.generation = null; this.maxGeneration = -1; this.maxScanGeneration = -1;
    this.initialized = null; this.pendingCommand = null; this.connectWait = null; this.session = 0;
    this.nativeSubscribed = null; this.connectEvidence = null; this.selectedAddress = null;
    this.hello = null; this.device = null; this.scanBusy = false; this.scanGeneration = null;
    this.routeBusy = false; this.disposed = false; this.disposing = false; this.failed = false;
    this.background = null;
    this.receive = input => this._receive(input);
  }
  getState() { return copy(this.link); }
  getBackgroundState() { return this.background ? copy(this.background) : null; }
  consumeBackgroundStop(){if(!this.background?.userStopped)return false;delete this.background.userStopped;return true;}
  async refreshConnectionState(){
    const generation=this.generation,session=this.session;
    const value=await this._rpc('getConnectionState');
    if(session!==this.session)return this.getBackgroundState();
    const userStopped=this.background?.userStopped===true;
    this.background=copy(value);
    if(userStopped||value.reason==='user_stopped')this.background.userStopped=true;
    if(generation!==null&&(value.connected!==true||value.evidence?.generation!==generation)){
      this._invalidate(fault('NOT_READY',value.reason||'Native connection is no longer current'));
      this.failed=false;this._emit({stage:'disconnected'});
    }
    if(value.reason==='user_stopped')this.background.userStopped=true;
    return copy(this.background);
  }
  async setBackgroundRetention(enabled,command){
    requireUser(command);
    const args={enabled:Boolean(enabled),origin:'explicit_user_action'};
    if(enabled){
      if(this.link.stage!=='ready_local'||!this.hello||!this.nativeSubscribed)throw fault('NOT_READY','请先连接并核对原吧唧。');
      await this._rpc('requestBackgroundPermissions',{origin:'explicit_user_action'});
      Object.assign(args,{generation:this.generation,address:this.selectedAddress,deviceId:this.hello.deviceId});
    }
    this.background=copy(await this._rpc('setBackgroundRetention',args));
    return copy(this.background);
  }
  subscribe(listener) { if (typeof listener !== 'function') throw fault('BAD_REQUEST', 'Listener required'); this.listeners.add(listener); try { listener(this.getState()); } catch {} return () => this.listeners.delete(listener); }
  _emit(link) { this.link = link; for (const listener of this.listeners) try { listener(this.getState()); } catch {} }
  _rpc(method, args = {}, timeout = this.nativeTimeoutMs) {
    if (this.disposed) return Promise.reject(fault('NOT_READY', 'Transport is disposed'));
    if (this.rpcPending.size >= 32) return Promise.reject(fault('BUSY', 'Native request limit reached'));
    const requestId = this.prefix + (++this.rpcSequence);
    return new Promise((resolve, reject) => {
      const pending = {resolve, reject, method, timer:setTimeout(() => {
        if (this.rpcPending.get(requestId) !== pending) return;
        this.rpcPending.delete(requestId); reject(fault(method === 'write' ? 'ACK_TIMEOUT_OUTCOME_UNKNOWN' : 'NOT_READY', 'Native operation timed out', method === 'write' ? 'unknown' : 'no_change'));
      }, timeout)};
      this.rpcPending.set(requestId, pending);
      try { this.bridge.postMessage(JSON.stringify({requestId, method, args})); }
      catch (error) { clearTimeout(pending.timer); this.rpcPending.delete(requestId); reject(fault(error.code || 'NOT_READY', error.message || 'Native port failed', method === 'write' ? 'unknown' : 'no_change')); }
    });
  }
  _receive(input) {
    if (this.disposed) return;
    let event; try { event = typeof input === 'string' ? strictJSON(input) : input; } catch { return; }
    if (!plain(event)) return;
    if (event.type === 'result') {
      const pending = this.rpcPending.get(event.requestId); if (!pending) return;
      clearTimeout(pending.timer); this.rpcPending.delete(event.requestId);
      if (event.ok === true && plain(event.result)) pending.resolve(event.result);
      else pending.reject(fault(event.error?.code || 'NOT_READY', event.error?.message || 'Native operation rejected', ['unknown','no_change'].includes(event.error?.outcome) ? event.error.outcome : pending.method === 'write' ? 'unknown' : 'no_change'));
    } else if (event.type === 'lifecycle') {
      this.background = copy(event);
      if(event.reason === 'user_stopped') this.background.userStopped = true;
      if(event.connected===false&&this.generation!==null){
        const error=fault('NOT_READY',event.reason||'Native connection ended',this.pendingCommand&&MUTATIONS.has(this.pendingCommand.op)?'unknown':'no_change');
        this._invalidate(error);this.failed=false;this._emit({stage:'disconnected'});
      }
      for(const listener of this.listeners)try{listener(this.getState());}catch{}
    } else if (event.type === 'device' && this.scanBusy) this._remember(event);
    else if (event.type === 'connection') this._connection(event);
    else if (event.type === 'frame') this._frame(event);
  }
  async initialize() {
    if (this.disposed || this.disposing) throw fault('NOT_READY', 'Transport is disposed');
    if (!this.initialized) {
      this.initialized = this._rpc('initialize').then(value => { this._availability(value); });
      this.initialized.catch(() => { this.initialized = null; });
    }
    return this.initialized;
  }
  _availability(value) {
    if (['off','legacy','cflocal2'].includes(value.mode)) this.mode = value.mode;
    if (value.available === false) this._emit({stage:'error', error:{code:'NOT_READY',message:'BLE hardware unavailable',outcome:'no_change'},generation:null});
    else if (value.granted === false) this._emit({stage:'permission_required'});
    else if (value.bluetoothEnabled === false) this._emit({stage:'bluetooth_off'});
    else if (this.generation === null && !this.scanBusy && !this.connectWait) this._emit({stage:'disconnected'});
  }
  async selectTransport(mode, command) {
    requireUser(command); if (!['legacy','cflocal2'].includes(mode)) throw fault('BAD_REQUEST', 'Unknown transport mode');
    await this.initialize(); if (this.routeBusy || this.scanBusy || this.pendingCommand || this.connectWait) throw fault('BUSY', 'Finish the current operation first');
    this.routeBusy = true;
    try {
      const result = await this._rpc('selectTransport', {mode,origin:command.origin});
      if (result.mode !== mode) throw fault('NOT_READY', 'Native transport selection was not confirmed');
      if (mode !== this.mode) { this._invalidate(fault('NOT_READY', 'Transport mode changed')); this.devices.clear(); this._emit({stage:'disconnected'}); }
      this.mode = mode; this.failed = false; return copy(result);
    } catch (error) {
      if (error.outcome === 'unknown') this.mode = 'off';
      this._emit({stage:'error',generation:this.generation,error:{code:error.code,message:error.message,outcome:error.outcome}}); throw error;
    } finally { this.routeBusy = false; }
  }
  async resumeSavedDevice(saved) {
    if(!saved||saved.schema!==1||saved.enabled!==true||(saved.address!==null&&!/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(saved.address))||!deviceId(saved.deviceId))throw fault('NOT_READY','No previously selected device');
    await this.initialize();
    // Existing native gates reject missing permission / disabled Bluetooth without prompting.
    const authorization={origin:'saved_device_reconnect',savedDevice:saved};
    await this.selectTransport('cflocal2',authorization);
    const devices=await this.scan({...authorization,durationMs:6000});
    const chosen=saved.address?devices.find(d=>d.address.toUpperCase()===saved.address.toUpperCase()):devices.length===1?devices[0]:null;
    if(!chosen)throw fault('NOT_READY','已绑定吧唧尚未唤醒或不在附近');
    const result=await this.connect(chosen,authorization);
    if(this.hello?.deviceId!==saved.deviceId){await this.disconnect();throw fault('OWNER_CONFLICT','设备身份变化，已停止自动连接，请手动核对。');}
    return result;
  }
  async requestPermissions(command) {
    if(command?.origin!=='explicit_user_action')throw fault('NOT_READY','Permission requests need a current explicit action');requireUser(command); await this.initialize();
    const value = await this._rpc('requestPermissions', {}, Math.max(this.nativeTimeoutMs, 125000));
    this._availability(value); return {granted:value.granted === true};
  }
  _remember(event) {
    if (!safe(event.generation) || event.generation <= Math.max(this.maxGeneration,this.maxScanGeneration) || event.source !== 'native_scan' || !/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(event.address || '') ||
        typeof event.name !== 'string' || !Number.isInteger(event.rssi) || event.rssi < -127 || event.rssi > 127) return;
    if (this.scanGeneration !== null && event.generation !== this.scanGeneration) return;
    this.scanGeneration = event.generation;
    const address = event.address.toUpperCase(); if (!this.devices.has(address) && this.devices.size >= 50) return;
    this.devices.set(address, {address:event.address,name:event.name.slice(0,100),rssi:event.rssi,source:'native_scan'});
  }
  async scan(command) {
    requireUser(command); await this.initialize();
    if (this.mode !== 'cflocal2') throw fault('NOT_READY', 'Select cflocal2 explicitly first');
    if (this.routeBusy || this.scanBusy || this.connectWait || this.generation !== null) throw fault('BUSY', 'Disconnect or finish the active operation first');
    if (!Number.isInteger(command.durationMs) || command.durationMs < 1000 || command.durationMs > 10000) throw fault('BAD_REQUEST', 'Invalid scan duration');
    const session = this.session; this.scanBusy = true; this.scanGeneration = null; this.devices.clear(); this.failed = false; this._emit({stage:'scanning'});
    try {
      const result = await this._rpc('scan', {durationMs:command.durationMs}, command.durationMs + this.nativeTimeoutMs);
      if (session !== this.session) throw fault('NOT_READY', 'Scan was cancelled');
      if (!safe(result.generation) || result.generation <= Math.max(this.maxGeneration,this.maxScanGeneration) || this.scanGeneration !== null && result.generation !== this.scanGeneration || result.devices !== undefined && !Array.isArray(result.devices)) throw fault('STALE_GENERATION','Scan completion was not from the current native scan');
      for (const item of result.devices || []) this._remember({...item,generation:item.generation ?? result.generation});
      this.maxScanGeneration = result.generation;
      const devices = [...this.devices.values()]; this._emit({stage:'selecting',devices}); return copy(devices);
    } catch (error) { if (session === this.session) { this.devices.clear(); this._emit({stage:'error',error:{code:error.code,message:error.message,outcome:error.outcome},generation:null}); void this._rpc('stopScan').catch(() => {}); } throw error; }
    finally { if (session === this.session) this.scanBusy = false; }
  }
  async connect(device, command) {
    requireUser(command); await this.initialize();
    if (this.mode !== 'cflocal2') throw fault('NOT_READY', 'Select cflocal2 explicitly first');
    if (this.routeBusy || this.scanBusy || this.connectWait || this.generation !== null) throw fault('BUSY', 'Finish the current connection first');
    const selected = this.devices.get(String(device?.address || '').toUpperCase());
    if (!selected || device?.source !== 'native_scan') throw fault('NOT_READY', 'Select a device from the actual scan');
    this.selectedAddress = selected.address; this.failed = false; this.hello = null; this.device = null;
    const session = this.session;
    const promise = new Promise((resolve,reject) => {
      this.connectWait = {resolve,reject,started:false,timer:setTimeout(() => this._fatal(fault('NOT_READY','Connection/HELLO/state handshake timed out')), this.nativeTimeoutMs + 2 * this.commandTimeoutMs + 1000)};
    });
    void this._rpc('connect', {address:selected.address}).then(result => {
      if (session !== this.session || !this.connectWait) return;
      if (!this._evidence(result)) throw fault('NOT_READY', 'Native subscription evidence missing');
      this._acceptGeneration(result.generation); this.connectEvidence = copy(result); this._handshake();
    }).catch(error => { if (session === this.session) this._fatal(error); });
    return promise;
  }
  _evidence(value) { return plain(value) && safe(value.generation) && typeof value.address === 'string' && value.address.toUpperCase() === this.selectedAddress?.toUpperCase() && ['serviceVerified','rxVerified','txVerified','subscribed'].every(key => value[key] === true); }
  _acceptGeneration(generation) {
    if (!safe(generation) || this.generation !== null && generation !== this.generation || this.generation === null && generation <= Math.max(this.maxGeneration,this.maxScanGeneration)) throw fault('STALE_GENERATION','Connection generation was not fresh');
    this.generation = generation; this.maxGeneration = Math.max(this.maxGeneration,generation);
  }
  _connection(event) {
    if (!safe(event.generation) || typeof event.address !== 'string' || event.address.toUpperCase() !== this.selectedAddress?.toUpperCase()) return;
    if (event.state === 'disconnected') {
      if (event.generation !== this.generation) return;
      if (this.connectWait || this.pendingCommand) this._fatal(fault('NOT_READY',event.reason || 'BLE disconnected',this.pendingCommand && MUTATIONS.has(this.pendingCommand.op) ? 'unknown':'no_change'));
      else { this._invalidate(fault('NOT_READY','BLE disconnected'),this.routeBusy?['selectTransport']:[]); if (!this.failed) this._emit({stage:'disconnected'}); }
      return;
    }
    if (!this.connectWait) return;
    if (event.generation < this.maxGeneration) return;
    try { this._acceptGeneration(event.generation); } catch (error) { this._fatal(error); return; }
    if (['connecting','discovering','subscribing'].includes(event.state)) this._emit({stage:event.state,generation:event.generation,deviceAddress:event.address});
    else if (event.state === 'subscribed') {
      if (!this._evidence(event)) { this._fatal(fault('NOT_READY','Native CCCD evidence missing')); return; }
      this.nativeSubscribed = copy(event); this._emit({stage:'handshaking',evidence:this._evidenceView(event)}); this._handshake();
    } else this._fatal(fault('UNSUPPORTED_PROTOCOL','Unexpected native connection stage'));
  }
  _evidenceView(value) { return {source:'native',generation:value.generation,deviceAddress:value.address,serviceVerified:true,rxVerified:true,txVerified:true,subscribed:true}; }
  _handshake() {
    const wait = this.connectWait;
    if (!wait || wait.started || !this.nativeSubscribed || !this.connectEvidence || this.nativeSubscribed.generation !== this.connectEvidence.generation) return;
    wait.started = true; const session = this.session;
    void (async () => {
      try {
        const hello = await this._request('hello', undefined, {}, true); if (session !== this.session) return; this.hello = copy(helloData(hello.data));
        const state = await this._request('state', undefined, {}, true); if (session !== this.session) return; this.device = copy(stateData(state.data,this.hello));
        if (session !== this.session || this.connectWait !== wait) return;
        clearTimeout(wait.timer); this.connectWait = null;
        this._emit({stage:'ready_local',evidence:this._evidenceView(this.nativeSubscribed),hello:copy(this.hello),device:copy(this.device),capabilities:{scene:'declared',snapshot:'declared',events:'declared',peer:this.hello.capabilities.includes('peer')?'declared':'unavailable'}});
        wait.resolve(this.getState());
      } catch (error) { if (session === this.session) this._fatal(error); }
    })();
  }
  request(op, data, extras = {}) { return this._request(op,data,extras,false); }
  _request(op, data, extras, internal) {
    try {
      if (!OPS.has(op)) throw fault('UNSUPPORTED_PROTOCOL','Unknown CFLOCAL2 operation');
      if (this.disposed || this.generation === null || !internal && this.link.stage !== 'ready_local') throw fault('NOT_READY','CFLOCAL2 handshake is not ready');
      if (this.pendingCommand) throw fault('BUSY','Only one application command may be in flight');
      keys(extras,['id','clientId','seq']);
      const mutation = MUTATIONS.has(op);
      if (mutation && (!ascii(extras.id,64) || !uuid(extras.clientId) || !Number.isSafeInteger(extras.seq) || extras.seq < 1)) throw fault('BAD_REQUEST','Mutation requires its persisted id/clientId/seq');
      const careConfirmation = op === 'care_capabilities';
      if (careConfirmation && (!uuid(extras.clientId) || 'seq' in extras)) throw fault('BAD_REQUEST','Care confirmation requires owner without mutation sequence');
      if (!mutation && !careConfirmation && ('clientId' in extras || 'seq' in extras)) throw fault('BAD_REQUEST','Read-only commands do not carry an owner sequence');
      const id = extras.id === undefined ? this.prefix + 'q' + (++this.commandSequence) : extras.id;
      if (!ascii(id,64) || id.startsWith('native-lock-') || id.startsWith('badge-context-')) throw fault('BAD_REQUEST','Invalid or reserved command id');
      // Deliberately stable outer insertion order; firmware hashes the exact UTF8 bytes.
      const command = {v:2,id,op}; if (data !== undefined) { if (!plain(data)) throw fault('BAD_REQUEST','data must be an object'); command.data = copy(data); }
      if (mutation) { command.clientId = extras.clientId; command.seq = extras.seq; }
      else if (careConfirmation) command.clientId = extras.clientId;
      const text = JSON.stringify(command); strictJSON(text);
      const bytes = new TextEncoder().encode(text + '\n'); if (op === 'day' && bytes.length > 1900) throw fault('BAD_REQUEST','Day frame exceeds 1900 bytes'); if (bytes.length > MAX_LINE) throw fault('MALFORMED_FRAME','Command exceeds 2048 bytes including LF');
      return new Promise((resolve,reject) => {
        const pending = {id,op,generation:this.generation,session:this.session,resolve,reject,ack:null,written:false,timer:null};
        this.pendingCommand = pending;
        void (async () => {
          try {
            await this._rpc('beginFlight',{generation:pending.generation,id:pending.id});
            if(this.pendingCommand!==pending||this.session!==pending.session)return;
            pending.timer = setTimeout(() => { if (this.pendingCommand === pending) this._fatal(fault('ACK_TIMEOUT_OUTCOME_UNKNOWN','Application ACK/write timeout; command was not replayed',mutation?'unknown':'no_change')); },this.commandTimeoutMs);
            for (let offset=0; offset<bytes.length; offset+=20) {
              if (this.pendingCommand !== pending || this.session !== pending.session) return;
              const result = await this._rpc('write',{generation:pending.generation,base64:b64encode(bytes.slice(offset,offset+20))});
              if (this.pendingCommand !== pending || this.session !== pending.session) return;
              if (result.generation !== pending.generation) throw fault('STALE_GENERATION','Write completion belongs to another connection',mutation?'unknown':'no_change');
            }
            pending.written = true; this._complete(pending);
          } catch (error) { if (this.pendingCommand === pending) this._fatal(error); }
        })();
      });
    } catch (error) { return Promise.reject(error?.code ? error : fault('BAD_REQUEST',error.message || 'Command serialization failed')); }
  }
  _frame(event) {
    if (event.generation !== this.generation || this.generation === null || this.failed) return;
    try {
      for (const value of b64decode(event.value)) {
        if (value === 0) throw fault('UNSUPPORTED_PROTOCOL','NUL notification byte');
        if (this.line.length + 1 > MAX_LINE) throw fault('UNSUPPORTED_PROTOCOL','Notification exceeds 2048 bytes including LF');
        if (!this.line.length && ![9,13,32,123].includes(value)) throw fault('UNSUPPORTED_PROTOCOL','Device did not send object NDJSON');
        this.line.push(value);
        if (value === 10) {
          const raw = Uint8Array.from(this.line.slice(0,-1)); this.line = [];
          const text = new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw);
          const reply = response(text); const pending = this.pendingCommand;
          if (!pending || reply.id !== pending.id) continue;
          if (reply.op !== pending.op) throw fault('UNSUPPORTED_PROTOCOL','Response id/op correlation mismatch');
          if (pending.ack !== null) { if (JSON.stringify(pending.ack) !== JSON.stringify(reply)) throw fault('UNSUPPORTED_PROTOCOL','Conflicting duplicate ACK'); continue; }
          if (reply.ok && reply.op === 'hello') {
            helloData(reply.data);
            if (this.hello && this.hello.deviceId.toLowerCase() !== reply.data.deviceId.toLowerCase()) throw fault('UNSUPPORTED_PROTOCOL','Device identity changed within the connection');
          }
          if (reply.ok && reply.op === 'state') stateData(reply.data,this.hello);
          pending.ack = reply; this._complete(pending);
        }
      }
    } catch (error) { this._fatal(error?.code ? error : fault('UNSUPPORTED_PROTOCOL','Invalid UTF8/JSON notification')); }
  }
  _complete(pending) {
    if (this.pendingCommand !== pending || !pending.written || pending.ack === null || pending.ending) return;
    pending.ending = true;
    void this._rpc('endFlight',{generation:pending.generation,id:pending.id}).then(() => {
      if (this.pendingCommand !== pending || pending.session !== this.session) return;
      this._finishComplete(pending);
    }).catch(error => { if (this.pendingCommand === pending) this._fatal(error); });
  }
  _finishComplete(pending) {
    this.pendingCommand = null; clearTimeout(pending.timer);
    if (!pending.ack.ok) {
      const error = fault(pending.ack.error.code,pending.ack.error.message || 'Device rejected ' + pending.op,pending.ack.error.outcome);
      error.applicationRejected = true; // only a correlated negative application ACK after every GATT write
      pending.reject(error); if (error.outcome === 'unknown') this._fatal(error); return;
    }
    if (pending.op === 'hello') { this.hello = copy(pending.ack.data); if (this.link.stage === 'ready_local') this._emit({...this.link,hello:copy(this.hello)}); }
    if (pending.op === 'state') { this.device = copy(pending.ack.data); if (this.link.stage === 'ready_local') this._emit({...this.link,device:copy(this.device)}); }
    pending.resolve({...copy(pending.ack),generation:pending.generation,gattWriteCompleted:true});
  }
  async readDeviceState() {
    const generation = this.generation, session = this.session;
    const result = await this.request('state');
    if (generation !== this.generation || session !== this.session || !this.hello) throw fault('STALE_GENERATION','State response belongs to an ended session');
    stateData(result.data,this.hello); return result;
  }
  _invalidate(error, preserveMethods = []) {
    this.session++; this.generation = null; this.line = []; this.nativeSubscribed = null; this.connectEvidence = null; this.hello = null; this.device = null;
    this.scanBusy = false; this.scanGeneration = null; this.devices.clear();
    const command = this.pendingCommand; this.pendingCommand = null;
    if (command) { clearTimeout(command.timer); command.reject(fault(error.code,error.message,MUTATIONS.has(command.op)?'unknown':error.outcome)); }
    const wait = this.connectWait; this.connectWait = null; if (wait) { clearTimeout(wait.timer); wait.reject(error); }
    for (const [id,pending] of this.rpcPending) {
      if (preserveMethods.includes(pending.method)) continue;
      clearTimeout(pending.timer); this.rpcPending.delete(id); pending.reject(fault(error.code,error.message,pending.method==='write'?'unknown':error.outcome));
    }
  }
  _fatal(input) {
    if (this.failed || this.disposed) return;
    const error = input?.code ? input : fault('NOT_READY',input?.message || 'Transport failed'); const generation = this.generation;
    this.failed = true; this._invalidate(error);
    this._emit({stage:'error',generation,error:{code:error.code,message:error.message,outcome:error.outcome}});
    void this._rpc('disconnect').catch(() => {});
  }
  async disconnect() {
    if (this.disposed) return;
    this._invalidate(fault('NOT_READY','Explicit disconnect')); this.selectedAddress = null; this.devices.clear(); this.failed = false;
    try { await this._rpc('disconnect'); } finally { this._emit({stage:'disconnected'}); }
  }
  async dispose() {
    if (this.disposed || this.disposing) return;
    this.disposing = true;
    this._invalidate(fault('NOT_READY','Transport disposed')); this.selectedAddress = null; this.devices.clear();
    try { await this._rpc('dispose'); } finally { this.disposed = true; this._invalidate(fault('NOT_READY','Transport disposed')); this.listeners.clear(); this.link={stage:'disconnected'}; }
  }
}
return {createControl:options => new Control(options), codec:{strictJSON,helloData,stateData,response,b64encode,b64decode,MAX_LINE}};
});
