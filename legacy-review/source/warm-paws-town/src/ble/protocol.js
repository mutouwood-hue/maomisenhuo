export const OP = Object.freeze({ HELLO: 1, GET_STATE: 2, START_LOCAL: 3, PING: 4, SET_FACE: 5, ACK: 0x80, STATE: 0x81 });
export const UUIDS = Object.freeze({ service: 'e7f1a000-1c9b-4a7e-9d2f-3b8c5e6f7a00', rx: 'e7f1a000-1c9b-4a7e-9d2f-3b8c5e6f7a01', tx: 'e7f1a000-1c9b-4a7e-9d2f-3b8c5e6f7a02' });
export function bytes(input) {
  if (!(input instanceof Uint8Array) && !Array.isArray(input)) throw new Error('Expected bytes');
  if ([...input].some(value => !Number.isInteger(value) || value < 0 || value > 255)) throw new Error('Invalid byte');
  return Uint8Array.from(input);
}
export function encodeRequest(opcode, sequence, payload = []) {
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
export function decodeFrame(input) {
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
export function decodeHello(input) {
  const value = bytes(input);
  if (value.length !== 8 || value[0] !== 1 || value[1] !== 15) throw new Error('Unsupported HELLO version/capabilities');
  return { version: value[0], capabilities: value[1], mac: [...value.slice(2)].map(byte => byte.toString(16).padStart(2, '0')).join(':') };
}
export function decodeState(input) {
  const value = bytes(input);
  if (value.length !== 10 || value[3] > 15 || value[4] > 2 || (value[5] > 100 && value[5] !== 255) || value[6] > 2 || ![0, 1, 255].includes(value[7])) throw new Error('Malformed device state');
  return { screen: value[0], step: value[1], phase: value[2], flags: { local: !!(value[3] & 1), authenticated: !!(value[3] & 2), tutorial: !!(value[3] & 4), suspended: !!(value[3] & 8) }, face: value[4], battery: value[5] === 255 ? null : value[5], power: ['unknown', 'normal', 'low'][value[6]], usb: value[7] === 255 ? null : value[7] === 1, revision: value[8] | (value[9] << 8) };
}
export function encodeBase64(input) { return btoa(String.fromCharCode(...bytes(input))); }
export function decodeBase64(input) { return Uint8Array.from(atob(input), value => value.charCodeAt(0)); }
