import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bindProof, makeChallenge, makeGrant, makeEnvelope, parseSignedEvent } from '../../backend/src/device/crypto.mjs';

const vectors = JSON.parse(await readFile(new URL('./real-data-vectors.json', import.meta.url), 'utf8'));
const key = Buffer.from(vectors.testKeyBase64, 'base64');
const bytes = name => Buffer.from(vectors[name].hex, 'hex');
// Key and IDs are deterministic public test material, not production provisioning.
test('backend crypto matches independent Node/Python bind and grant golden vectors', () => {
  const challenge = bytes('challenge');
  assert.deepEqual(makeChallenge(vectors.challengeId, challenge.subarray(16, 48), challenge.readUInt32LE(48), challenge.readUInt32LE(52)), challenge);
  assert.deepEqual(bindProof(key, vectors.deviceId, challenge), bytes('proof'));
  assert.deepEqual(makeGrant(key, vectors.deviceId, vectors.sessionId, bytes('grant').readUInt32LE(17), vectors.challengeId), bytes('grant'));
});
test('backend signed ACK and time match canonical domain and kind framing', () => {
  assert.deepEqual(makeEnvelope(key, vectors.deviceId, vectors.sessionId, 1, 8, bytes('ack').subarray(20, 28)), bytes('ack'));
  assert.deepEqual(makeEnvelope(key, vectors.deviceId, vectors.sessionId, 2, 9, bytes('time').subarray(20, 26)), bytes('time'));
});
test('signed events retain uint64 above JS safe integer and original PRD 8B', () => {
  const event = parseSignedEvent(key, vectors.deviceId, vectors.eventId, vectors.event.base64);
  assert.equal(event.id, '9007199254740993');
  assert.equal(event.type, 1);
  assert.equal(event.a, 0);
  assert.equal(event.b, 0);
  assert.equal(event.time, 1791949800);
});
test('wrong MAC, different device, mismatched event ID and malformed 48B reject', () => {
  const altered = bytes('event'); altered[13] ^= 1;
  assert.throws(() => parseSignedEvent(key, vectors.deviceId, vectors.eventId, altered.toString('base64')));
  assert.throws(() => parseSignedEvent(key, 'aabbccddee00', vectors.eventId, vectors.event.base64));
  assert.throws(() => parseSignedEvent(key, vectors.deviceId, '9007199254740992', vectors.event.base64));
  assert.throws(() => parseSignedEvent(key, vectors.deviceId, '0', vectors.event.base64));
  assert.throws(() => parseSignedEvent(key, vectors.deviceId, '18446744073709551616', vectors.event.base64));
  assert.throws(() => parseSignedEvent(key, vectors.deviceId, vectors.eventId, bytes('event').subarray(0, 47).toString('base64')));
});
