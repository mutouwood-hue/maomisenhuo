import { OP, bytes, encodeRequest, decodeFrame, decodeHello, decodeState, encodeBase64, decodeBase64 } from './protocol.js';

// Transport is injected: protocol correlation is testable without an Android radio.
export class BleLocalClient {
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
