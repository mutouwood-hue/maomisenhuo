import test from 'node:test';
import assert from 'node:assert/strict';
import { OP, encodeRequest, decodeFrame, decodeHello, decodeState, encodeBase64, decodeBase64 } from '../src/ble/protocol.js';
import { BleLocalClient } from '../src/ble/client.js';

const stateBytes = [3, 2, 1, 15, 2, 255, 0, 255, 0x34, 0x12];
function ack(sequence, opcode, data = [], status = 0) {
  const frame = new Uint8Array(20); frame.set([0x42, 0x4a, 1, OP.ACK, sequence & 255, sequence >> 8, data.length + 2, 0, opcode, status, ...data]); return frame;
}
function fixture(timeoutMs = 100) {
  const writes = []; const listeners = new Map(); const changes = [];
  const transport = {
    async addListener(name, callback) { listeners.set(name, callback); return { async remove() { listeners.delete(name); } }; },
    async write(event) { writes.push(event); return { generation: event.generation }; },
    async disconnect() { this.disconnected = true; },
  };
  const client = new BleLocalClient(transport, { timeoutMs, onChange: event => changes.push(event) });
  client.generation = 7; client.isReady = true;
  const emit = frame => client.handleFrame({ generation: 7, value: encodeBase64(frame) });
  return { client, transport, writes, listeners, changes, emit };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function revisionBytes(revision) { return [...stateBytes.slice(0, 8), revision & 255, revision >> 8]; }
function stateFrame(revision) {
  const frame = new Uint8Array(20); frame.set([0x42, 0x4a, 1, OP.STATE, 0, 0, 10, 0, ...revisionBytes(revision)]); return frame;
}

test('state revisions accept wraparound and reject duplicate, stale and half-range frames', async () => {
  const f = fixture(); f.emit(stateFrame(65535)); f.emit(stateFrame(0));
  assert.equal(f.client.state.revision, 0);
  for (const revision of [0, 65535, 32768]) f.emit(stateFrame(revision));
  assert.equal(f.client.state.revision, 0); assert.equal(f.changes.filter(event => event.type === 'state').length, 2);
  f.client.invalidate('epoch ended'); f.client.generation = 7; f.emit(stateFrame(40000));
  assert.equal(f.client.state.revision, 40000); await f.client.dispose();
});
test('GET_STATE ACK cannot roll back a newer notification and returns accepted state', async () => {
  const f = fixture(); f.emit(stateFrame(10)); const request = f.client.getState();
  f.emit(stateFrame(12)); f.emit(ack(1, OP.GET_STATE, revisionBytes(11)));
  assert.equal((await request).revision, 12); assert.equal(f.client.state.revision, 12); await f.client.dispose();
});
test('handshake keeps newer state received before GET_STATE ACK', async () => {
  const f = fixture(); f.client.handleConnection({ state: 'ready', generation: 10 }); await flush();
  const emit = frame => f.client.handleFrame({ generation: 10, value: encodeBase64(frame) });
  emit(ack(1, OP.HELLO, [1, 15, 1, 2, 3, 4, 5, 6])); await flush();
  emit(stateFrame(21)); emit(ack(2, OP.GET_STATE, revisionBytes(20))); await flush();
  assert.equal(f.client.isReady, true); assert.equal(f.changes.find(event => event.type === 'ready').state.revision, 21);
  await f.client.dispose();
});

test('fixed20 requests validate every opcode, sequence, length and zero padding', () => {
  for (const opcode of [1, 2, 3]) assert.deepEqual([...encodeRequest(opcode, 0x1234)], [66, 74, 1, opcode, 52, 18, 0, 0, ...Array(12).fill(0)]);
  for (const length of [0, 1, 10]) assert.equal(encodeRequest(OP.PING, 65535, Array(length).fill(9))[6], length);
  for (const face of [0, 1, 2]) assert.equal(encodeRequest(OP.SET_FACE, 1, [face])[8], face);
  for (const sequence of [0, -1, 65536, 1.5]) assert.throws(() => encodeRequest(1, sequence));
  for (const [op, data] of [[1, [0]], [2, [0]], [3, [0]], [4, Array(11).fill(0)], [5, []], [5, [3]], [5, [0, 0]], [9, []], [4, [-1]], [4, [256]], [4, [1.5]]]) assert.throws(() => encodeRequest(op, 1, data));
});
test('inbound strict framing rejects reserved, padding, length, opcode and sequence errors', () => {
  assert.equal(decodeFrame(ack(0x1234, 4, [1, 2])).sequence, 0x1234);
  for (const [index, value] of [[0, 0], [1, 0], [2, 2], [3, 1], [6, 13], [7, 1], [19, 1], [8, 9], [9, 5]]) { const frame = ack(1, 4); frame[index] = value; assert.throws(() => decodeFrame(frame)); }
  assert.throws(() => decodeFrame(ack(0, 4)));
  assert.throws(() => decodeFrame(new Uint8Array(19)));
  const frame = ack(0, 4); frame[3] = OP.STATE; frame[6] = 10; frame.fill(0, 8); frame.set(stateBytes, 8);
  assert.equal(decodeFrame(frame).state.revision, 0x1234);
  frame[4] = 1; assert.throws(() => decodeFrame(frame));
});
test('HELLO and ten-byte state decode contract without claiming cloud ownership', () => {
  assert.deepEqual(decodeHello([1, 15, 1, 2, 3, 4, 5, 6]), { version: 1, capabilities: 15, mac: '01:02:03:04:05:06' });
  assert.throws(() => decodeHello([2, 15, 1, 2, 3, 4, 5, 6]));
  assert.throws(() => decodeHello([1, 7, 1, 2, 3, 4, 5, 6]));
  assert.deepEqual(decodeState(stateBytes), { screen: 3, step: 2, phase: 1, flags: { local: true, authenticated: true, tutorial: true, suspended: true }, face: 2, battery: null, power: 'unknown', usb: null, revision: 0x1234 });
  for (const [index, value] of [[3, 16], [4, 3], [5, 101], [6, 3], [7, 2]]) { const input = [...stateBytes]; input[index] = value; assert.throws(() => decodeState(input)); }
  assert.deepEqual(decodeBase64(encodeBase64(encodeRequest(4, 42, [255]))), encodeRequest(4, 42, [255]));
});
test('ACK requires both sequence and original opcode and actual GATT completion', async () => {
  const f = fixture(); let done = false;
  const request = f.client.request(OP.PING, [8]).then(() => { done = true; });
  f.emit(ack(2, 4, [8])); f.emit(ack(1, 3)); await flush(); assert.equal(done, false);
  f.emit(ack(1, 4, [8])); await request; assert.equal(f.writes.length, 1); assert.equal(done, true);
  await f.client.dispose();
});
test('GATT write completion alone is not application ACK; timeout never retries mutation', async () => {
  const f = fixture(10); const request = f.client.request(OP.START_LOCAL);
  await assert.rejects(request, /outcome is unknown.*No command was retried/);
  assert.equal(f.writes.length, 1); assert.equal(f.client.pending, null);
  await f.client.dispose();
});
test('PING exact echo and nonzero statuses reject correlated requests', async () => {
  for (const [data, status, pattern] of [[[9], 0, /echo mismatch/], [[], 3, /status 3/]]) {
    const f = fixture(); const request = f.client.request(OP.PING, [8]); f.emit(ack(1, 4, data, status)); await assert.rejects(request, pattern); await f.client.dispose();
  }
});
test('disconnect rejects pending and isolates stale generations and listener teardown', async () => {
  const f = fixture(); await f.client.initialize(); const request = f.client.request(OP.SET_FACE, [1]);
  const rejected = assert.rejects(request, /Manual disconnect/); await f.client.disconnect(); await rejected;
  f.client.generation = 9; f.client.isReady = true; f.emit(ack(1, 5)); assert.equal(f.client.pending, null);
  await f.client.dispose(); assert.equal(f.listeners.size, 0); assert.equal(f.transport.disconnected, true);
});
test('reconnect performs only HELLO + GET_STATE and restores state before ready', async () => {
  const f = fixture(); f.client.handleConnection({ state: 'ready', generation: 10 });
  assert.equal(f.client.isReady, false); await flush();
  const first = decodeBase64(f.writes[0].value); assert.equal(first[3], OP.HELLO);
  f.client.handleFrame({ generation: 10, value: encodeBase64(ack(first[4], OP.HELLO, [1, 15, 1, 2, 3, 4, 5, 6])) }); await flush();
  const second = decodeBase64(f.writes[1].value); assert.equal(second[3], OP.GET_STATE);
  f.client.handleFrame({ generation: 10, value: encodeBase64(ack(second[4], OP.GET_STATE, stateBytes)) }); await flush();
  assert.equal(f.client.isReady, true); assert.equal(f.client.state.revision, 0x1234); assert.equal(f.writes.length, 2);
  await f.client.dispose();
});
test('commands are single-flight and sequence never wraps into a stale ACK', async () => {
  const f = fixture(); const first = f.client.request(OP.PING);
  await assert.rejects(f.client.request(OP.GET_STATE), /pending command/); f.emit(ack(1, OP.PING)); await first;
  f.client.sequence = 65535; await assert.rejects(f.client.request(OP.GET_STATE), /Sequence exhausted/); await f.client.dispose();
});
