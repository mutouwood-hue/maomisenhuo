import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from '../../mobile-pet/src/companion/api-client.js';
import { SocialClient, SocialDeviceBridge, decodeEnvironmentStatus } from '../../mobile-pet/src/social/client.js';
import { harness, proof, challengeBody, environmentEvent } from './m2-helper.mjs';
const storage = () => { const values = new Map(); return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k), values }; };

// Transport is a test hardware substitute; actual production mobile codecs/client/HTTP run unchanged.
// It independently signs locally confirmed QR; this is not evidence of physical BLE or touch.
function badge(h, user) {
  let challenge = null;
  return {
    session: { id: user.binding.sessionId }, deviceId: () => user.id, requireSession() {},
    transport: {
      async write(kind, bytes) { assert.equal(kind, 10); challenge = challengeBody(Buffer.from(bytes).toString('base64'), user).body; },
      async read(kind) {
        if (kind === 12) { assert.ok(challenge); return new Uint8Array(Buffer.from(proof(challenge, user), 'base64')); }
        if (kind === 14) return new Uint8Array(Buffer.from(environmentEvent(user, { id: '9007199254740993', seconds: Math.floor(h.now() / 1000), revision: 1 }), 'base64'));
        throw new Error(`unexpected test transport kind ${kind}`);
      },
    },
  };
}
test('M2 real mobile SocialClient and SocialDeviceBridge use HTTP signed QR contract and lease renewal', async () => {
  const h = await harness();
  try {
    const [a, b] = h.users, data = storage();
    const apis = h.users.slice(0, 2).map(user => new ApiClient({ getEndpoint: () => h.base, getToken: () => user.token }));
    const clients = apis.map((api, i) => new SocialClient({ api, storage: data, getOwner: () => h.users[i].userId }));
    for (let i = 0; i < 2; i++) { const current = await clients[i].get('social-settings'); await clients[i].settings({ baseRevision: current.revision, isDiscoverable: true, venueId: 'TEST-VENUE' }); }
    const old = await clients[1].discovery({ deviceId: b.id, sessionId: b.binding.sessionId });
    h.advance(61000);
    const fresh = await clients[1].discovery({ deviceId: b.id, sessionId: b.binding.sessionId });
    assert.notEqual(old.token, fresh.token, 'expired discovery round must create a fresh server lease');
    const encounter = await clients[0].encounter({ deviceId: a.id, sessionId: a.binding.sessionId, peerToken: fresh.token, method: 'QR' });
    const bridgeA = new SocialDeviceBridge({ badge: badge(h, a), now: h.now }), bridgeB = new SocialDeviceBridge({ badge: badge(h, b), now: h.now });
    await bridgeA.challenge(encounter); await bridgeB.challenge(await clients[1].encounterState(encounter.id));
    await assert.rejects(() => bridgeA.proof('wrong-encounter'));
    const pa = await bridgeA.proof(encounter.id), pb = await bridgeB.proof(encounter.id);
    const partial = await clients[0].proof(encounter.id, pa, { operationKey: 'self-proof-once' }); assert.notEqual(partial.status, 'CONFIRMED');
    const confirmed = await clients[1].proof(encounter.id, pb, { operationKey: 'peer-proof-once' }); assert.equal(confirmed.status, 'CONFIRMED');
    await clients[0].proof(encounter.id, pa, { operationKey: 'self-proof-once' });
    assert.equal((await clients[0].get('friendships')).total, 1);
    const ambient = await bridgeA.environmentEvent(); assert.equal(ambient.id, '9007199254740993'); assert.equal(Buffer.from(ambient.signedEventBase64, 'base64').length, 56);
    assert.ok([...data.values.values()].every(value => !value.includes('signedEventBase64') && !value.includes('proofBase64')), 'retry records never persist sensitive request body');
  } finally { await h.close(); }
});
test('M2 mobile environment status decoder respects sliced byte offset and confidence', () => {
  const backing = new Uint8Array(20), raw = backing.subarray(3, 13); raw[0] = 1; raw[1] = 7; raw[6] = 4;
  new DataView(backing.buffer).setUint32(5, 0x12345678, true); new DataView(backing.buffer).setUint16(10, 999, true);
  const decoded = decodeEnvironmentStatus(raw); assert.equal(decoded.revision, 0x12345678); assert.equal(decoded.label, 'MUSIC'); assert.equal(decoded.confidencePermille, 999); assert.equal(decoded.isModelAvailable, true);
  raw[1] = 0x87; assert.throws(() => decodeEnvironmentStatus(raw)); raw[1] = 7;
  raw[9] = 1; assert.throws(() => decodeEnvironmentStatus(raw)); raw[9] = 0; new DataView(backing.buffer).setUint16(10, 1001, true); assert.throws(() => decodeEnvironmentStatus(raw));
});
