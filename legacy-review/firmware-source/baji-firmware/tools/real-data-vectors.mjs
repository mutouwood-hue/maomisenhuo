import { createHash, createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Public deterministic TEST-ONLY key. Never provision it on a real badge.
const key = Buffer.from(Array.from({ length: 32 }, (_, i) => i));
const device = Buffer.from('aabbccddeeff', 'hex');
const challengeId = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
const sessionId = Buffer.from('ffeeddccbbaa99887766554433221100', 'hex');
const sign = (domain, ...parts) => createHmac('sha256', key).update(Buffer.concat([Buffer.from(domain, 'ascii'), device, ...parts])).digest();
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) { value ^= byte; for (let i = 0; i < 8; i++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0); }
  return (value ^ 0xffffffff) >>> 0;
}
function frames(kind, object) {
  const request = (op, sequence, payload) => {
    const b = Buffer.alloc(20); b.set([0x42, 0x4a, 1, op]); b.writeUInt16LE(sequence, 4); b[6] = payload.length; payload.copy(b, 8); return b.toString('hex');
  };
  const transfer = 0x1234;
  const begin = Buffer.alloc(9); begin[0] = kind; begin.writeUInt16LE(transfer, 1); begin.writeUInt16LE(object.length, 3); begin.writeUInt32LE(crc32(object), 5);
  const result = [request(0x10, 1, begin)];
  for (let offset = 0, page = 0; offset < object.length; offset += 9, page++) {
    const prefix = Buffer.alloc(3); prefix.writeUInt16LE(transfer); prefix[2] = page;
    result.push(request(0x11, page + 2, Buffer.concat([prefix, object.subarray(offset, offset + 9)])));
  }
  const end = Buffer.alloc(2); end.writeUInt16LE(transfer); result.push(request(0x12, result.length + 1, end));
  return result;
}
const challenge = Buffer.concat([challengeId, Buffer.from(Array.from({ length: 32 }, (_, i) => 255 - i)), u32(1791949860), u32(123456)]);
const proof = sign('BAJI-BIND-v1', challenge);
const grantHead = Buffer.concat([Buffer.from([1]), sessionId, u32(1791950700), challengeId]);
const grant = Buffer.concat([grantHead, sign('BAJI-GRANT-v1', grantHead)]);
const eventHead = Buffer.concat([u64('9007199254740993'), u32(1791949800), Buffer.from([1, 0, 0, 0])]);
const event = Buffer.concat([eventHead, sign('BAJI-EVENT-v1', eventHead)]);
const ackBody = u64('9007199254740993');
const ackCounter = u32(1);
const ack = Buffer.concat([sessionId, ackCounter, ackBody, sign('BAJI-SYNC-v1', Buffer.from([8]), sessionId, ackCounter, ackBody)]);
const timeBody = Buffer.alloc(6); timeBody.writeUInt32LE(1791949800); timeBody.writeInt16LE(480, 4);
const timeCounter = u32(2);
const time = Buffer.concat([sessionId, timeCounter, timeBody, sign('BAJI-SYNC-v1', Buffer.from([9]), sessionId, timeCounter, timeBody)]);
const encode = b => ({ length: b.length, hex: b.toString('hex'), base64: b.toString('base64'), crc32: crc32(b).toString(16).padStart(8, '0') });
const result = {
  warning: 'PUBLIC TEST-ONLY KEY. Do not provision in real firmware or production backend.',
  version: 1, deviceId: device.toString('hex'), testKeyBase64: key.toString('base64'),
  challengeId: '00112233-4455-6677-8899-aabbccddeeff', sessionId: 'ffeeddcc-bbaa-9988-7766-554433221100',
  eventId: '9007199254740993', challenge: encode(challenge), proof: encode(proof), grant: encode(grant), event: encode(event), ack: encode(ack), time: encode(time),
  grantFrames: frames(7, grant), signedAckFrames: frames(8, ack),
  standardCrc32: { ascii: '123456789', expectedHex: 'cbf43926', actualHex: crc32(Buffer.from('123456789')).toString(16) },
  domainLengths: Object.fromEntries(['BAJI-BIND-v1', 'BAJI-GRANT-v1', 'BAJI-EVENT-v1', 'BAJI-SYNC-v1'].map(s => [s, Buffer.byteLength(s, 'ascii')]))
};
if (result.standardCrc32.actualHex !== result.standardCrc32.expectedHex) throw new Error('CRC oracle mismatch');
const output = resolve('tests/integration/real-data-vectors.json');
await mkdir(resolve('tests/integration'), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(`Generated public test vectors: ${output}; SHA256=${createHash('sha256').update(JSON.stringify(result)).digest('hex')}`);
