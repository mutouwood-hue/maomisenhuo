import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, challengeBody, transcript, proof, environmentEvent, hmac } from './m2-helper.mjs';

async function discover(h, user) {
  const setting = await h.ok(user, '/social-settings');
  await h.ok(user, '/social-settings', 'PUT', { baseRevision: setting.revision, isDiscoverable: true, venueId: 'TEST-VENUE' });
  return h.ok(user, '/discovery-tokens', 'POST', { deviceId: user.id, sessionId: user.binding.sessionId });
}
async function begin(h, method = 'QR') {
  const [a, b] = h.users;
  await discover(h, a); const token = await discover(h, b);
  const encounter = await h.ok(a, '/encounters', 'POST', { deviceId: a.id, sessionId: a.binding.sessionId, peerToken: token.token, method });
  const opposite = await h.ok(b, `/encounters/${encounter.id}`);
  return { a, b, encounter, ca: challengeBody(encounter.ownChallengeBase64, a).body, cb: challengeBody(opposite.ownChallengeBase64, b).body };
}
const submit = (h, u, id, encoded, options) => h.request(u, `/encounters/${id}/proofs`, 'POST', { deviceId: u.id, sessionId: u.binding.sessionId, proofBase64: encoded }, options);

test('M2 independent HTTP: anonymous discovery + verified opposite challenges + bilateral proofs + identity isolation', async () => {
  const h = await harness();
  try {
    const [a, b, outsider] = h.users;
    const denied = await h.request(a, '/discovery-tokens', 'POST', { deviceId: a.id, sessionId: a.binding.sessionId }); assert.notEqual(denied.code, 200);
    const { encounter, ca, cb } = await begin(h);
    assert.deepEqual(ca.subarray(17, 23), Buffer.from(a.id, 'hex'));
    assert.deepEqual(ca.subarray(23, 29), Buffer.from(b.id, 'hex'));
    assert.deepEqual(ca.subarray(1, 17), cb.subarray(1, 17));
    assert.deepEqual(ca.subarray(29), cb.subarray(29));
    assert.deepEqual(transcript(ca), transcript(cb));
    const again = await h.ok(a, `/encounters/${encounter.id}`);
    assert.equal(again.ownChallengeBase64, encounter.ownChallengeBase64, 'GET must return frozen challenge without issuing a new signed counter');
    const ownList = await h.ok(a, '/encounters');
    assert.ok(ownList.list.some(value => value.id === encounter.id));
    assert.equal((await h.ok(outsider, '/encounters')).total, 0);
    assert.ok([403, 404].includes((await h.request(outsider, `/encounters/${encounter.id}`)).status));
    assert.equal((await submit(h, a, encounter.id, proof(ca, a), { omitKey: true })).status, 400);
    const first = await submit(h, a, encounter.id, proof(ca, a), { key: 'proof-self-fixed-key' }); assert.equal(first.code, 200); assert.notEqual(first.data.status, 'CONFIRMED');
    assert.equal((await h.ok(a, '/friendships')).total, 0);
    const mismatch = Buffer.from(proof(ca, a), 'base64'); mismatch[0] ^= 1;
    assert.notEqual((await submit(h, a, encounter.id, mismatch.toString('base64'), { key: 'proof-self-fixed-key' })).code, 200);
    const final = await submit(h, b, encounter.id, proof(cb, b)); assert.equal(final.code, 200); assert.equal(final.data.status, 'CONFIRMED');
    const repeated = await submit(h, a, encounter.id, proof(ca, a), { key: 'proof-self-fixed-key' }); assert.equal(repeated.code, 200);
    const friends = await h.ok(a, '/friendships'); assert.equal(friends.total, 1); assert.equal(friends.list[0].isContactUnlocked, false); assert.equal(friends.list[0].contacts, undefined);
    assert.deepEqual(friends.list[0].peerPet, (await h.ok(b, '/discovery-tokens', 'POST', { deviceId: b.id, sessionId: b.binding.sessionId })).pet, 'friend peer pet must match currently bound discovery pet name/breed/outfit');
    const id = friends.list[0].id;
    const single = await h.ok(a, `/friendships/${id}/contact-consent`, 'PUT', { isContactAllowed: true, contact: 'TEST contact A' }); assert.equal(single.isContactUnlocked, false);
    const both = await h.ok(b, `/friendships/${id}/contact-consent`, 'PUT', { isContactAllowed: true, contact: 'TEST contact B' }); assert.equal(both.isContactUnlocked, false, 'both contacts still require a real linked pet interaction');
    const revoked = await h.ok(a, `/friendships/${id}/contact-consent`, 'PUT', { isContactAllowed: false }); assert.equal(revoked.isContactUnlocked, false); assert.equal(revoked.contacts, undefined);
    assert.ok([403, 404].includes((await h.request(outsider, `/friendships/${id}/contact-consent`, 'PUT', { isContactAllowed: true, contact: 'steal' })).status));
    await h.ok(a, `/blocks/${id}`, 'PUT', { isBlocked: true });
    const token = await h.ok(b, '/discovery-tokens', 'POST', { deviceId: b.id, sessionId: b.binding.sessionId });
    assert.notEqual((await h.request(a, '/encounters', 'POST', { deviceId: a.id, sessionId: a.binding.sessionId, peerToken: token.token, method: 'QR' })).code, 200);
  } finally { await h.close(); }
});

test('M2 independent HTTP: wrong key/method + one-sided expiry cannot confirm', async () => {
  const h = await harness();
  try {
    const { a, b, encounter, ca, cb } = await begin(h);
    assert.notEqual((await submit(h, a, encounter.id, proof(ca, { ...a, key: b.key }))).code, 200);
    const altered = Buffer.from(ca); altered[65] = 2;
    assert.notEqual((await submit(h, a, encounter.id, proof(altered, a))).code, 200);
    assert.equal((await submit(h, a, encounter.id, proof(ca, a))).code, 200);
    h.advance(16000);
    assert.notEqual((await submit(h, b, encounter.id, proof(cb, b))).code, 200);
    assert.equal((await h.ok(a, '/friendships')).total, 0);
  } finally { await h.close(); }
});

test('M2 independent HTTP: cancel/replay and discovery revoke/unbind invalidate live challenge', async () => {
  const h = await harness();
  try {
    const first = await begin(h);
    await h.ok(first.a, `/encounters/${first.encounter.id}/cancel`, 'POST', {});
    assert.notEqual((await submit(h, first.a, first.encounter.id, proof(first.ca, first.a))).code, 200);
    const second = await begin(h);
    assert.notEqual((await submit(h, second.a, second.encounter.id, proof(first.ca, first.a))).code, 200, 'proof is bound to encounter nonce and UUID');
    const settings = await h.ok(second.a, '/social-settings');
    await h.ok(second.a, '/social-settings', 'PUT', { baseRevision: settings.revision, isDiscoverable: false, venueId: 'TEST-VENUE' });
    assert.notEqual((await submit(h, second.a, second.encounter.id, proof(second.ca, second.a))).code, 200);
    await h.ok(second.b, `/encounters/${second.encounter.id}/cancel`, 'POST', {});
    const third = await begin(h);
    await h.ok(third.b, `/device-bindings/${third.b.id}`, 'DELETE');
    assert.notEqual((await submit(h, third.b, third.encounter.id, proof(third.cb, third.b))).code, 200, 'stale binding proof must fail closed');
    assert.equal((await h.ok(third.a, '/friendships')).total, 0);
  } finally { await h.close(); }
});

async function setEnvironment(h, u, granted) {
  const before = await h.ok(u, '/environment-consent');
  return h.ok(u, '/environment-consent', 'PUT', { baseRevision: before.revision, isEnvironmentGranted: granted });
}
function event(h, u, revision, id, extra = {}) { return { id: String(id), deviceId: u.id, signedEventBase64: environmentEvent(u, { id, seconds: Math.floor(h.now() / 1000), revision, ...extra }) }; }
const upload = (h, u, revision, events, options) => h.request(u, '/environment-events', 'POST', { consentRevision: revision, events }, options);

test('M2 independent HTTP: environment exact bytes, domain, independent consent, duplicates and ownership', async () => {
  const h = await harness();
  try {
    const [a, b] = h.users;
    const old = await h.ok(a, '/consents');
    await h.ok(a, '/consents', 'PUT', { baseRevision: old.revision, isLifeSyncEnabled: true, isLocationGranted: false, isMotionGranted: false, isMicrophoneGranted: true });
    assert.equal((await h.ok(a, '/environment-consent')).isEnvironmentGranted, false, 'old active microphone consent does not grant ambient collection');
    h.advance(61000);
    const rev = (await setEnvironment(h, a, true)).revision;
    const signed = await h.ok(a, `/devices/${a.id}/signed-objects`, 'POST', { sessionId: a.binding.sessionId, kind: 11 });
    const env = Buffer.from(signed.envelopeBase64, 'base64'); assert.equal(env.length, 62); assert.equal(env[20], 1); assert.equal(env.readUInt32LE(21), rev); assert.equal(env[25], 1);
    assert.ok(env.readUInt32LE(26) * 1000 <= Date.parse(a.binding.expiresAt.replace(' ', 'T') + '+08:00'), 'environment grant cannot exceed device session expiry');
    assert.deepEqual(env.subarray(30), hmac(a.key, 'BAJI-SYNC-v1', Buffer.from(a.id, 'hex'), Buffer.from([11]), env.subarray(0, 30)));
    const e = event(h, a, rev, '9007199254740993');
    const first = await upload(h, a, rev, [e]); assert.equal(first.code, 200); assert.equal(first.data.acceptedCount, 1); assert.equal(first.data.results[0].isTerminal, true);
    const unknownAck = await h.request(a, `/devices/${a.id}/signed-objects`, 'POST', { sessionId: a.binding.sessionId, kind: 15, eventId: '9007199254740999' }); assert.notEqual(unknownAck.code, 200);
    const ack = await h.ok(a, `/devices/${a.id}/signed-objects`, 'POST', { sessionId: a.binding.sessionId, kind: 15, eventId: e.id });
    const ackBytes = Buffer.from(ack.envelopeBase64, 'base64'); assert.equal(ackBytes.length, 60); assert.equal(ackBytes.readBigUInt64LE(20).toString(), e.id);
    assert.deepEqual(ackBytes.subarray(28), hmac(a.key, 'BAJI-SYNC-v1', Buffer.from(a.id, 'hex'), Buffer.from([15]), ackBytes.subarray(0, 28)));
    const duplicate = await upload(h, a, rev, [e]); assert.equal(duplicate.code, 200); assert.equal(duplicate.data.duplicateCount, 1);
    const bRev = (await setEnvironment(h, b, true)).revision;
    assert.notEqual((await upload(h, b, bRev, [e])).data?.acceptedCount, 1, 'other owner cannot submit signed device data');
    const tampered = event(h, a, rev, '9007199254740994'); const bytes = Buffer.from(tampered.signedEventBase64, 'base64'); bytes[17] = 4; tampered.signedEventBase64 = bytes.toString('base64');
    assert.notEqual((await upload(h, a, rev, [tampered])).data?.acceptedCount, 1);
    const invalid = event(h, a, rev, '9007199254740995', { flags: 1 }); assert.notEqual((await upload(h, a, rev, [invalid])).data?.acceptedCount, 1);
    const forbidden = await h.request(a, '/environment-events', 'POST', { consentRevision: rev, events: [e], audioBase64: 'UNEXPECTED' }); assert.notEqual(forbidden.code, 200);
  } finally { await h.close(); }
});

test('M2 independent HTTP: sample-start TTL + revoke/regrant tombstone + life clear prevents resurrection', async () => {
  const h = await harness();
  try {
    const [a] = h.users;
    const life = await h.ok(a, '/consents');
    await h.ok(a, '/consents', 'PUT', { baseRevision: life.revision, isLifeSyncEnabled: true, isLocationGranted: false, isMotionGranted: false, isMicrophoneGranted: false });
    h.advance(2000);
    const rev = (await setEnvironment(h, a, true)).revision;
    const e = event(h, a, rev, '100'); const first = await upload(h, a, rev, [e]); assert.equal(first.code, 200, JSON.stringify(first)); assert.equal(first.data.acceptedCount, 1);
    const outside = event(h, a, rev, '101', { seconds: Math.floor(h.now() / 1000) - 7 * 86400 + 1, sampleSeconds: 2 });
    assert.notEqual((await upload(h, a, rev, [outside])).data?.acceptedCount, 1, 'sampling start older than seven days must reject even if event end inside TTL');
    await setEnvironment(h, a, false); const rev2 = (await setEnvironment(h, a, true)).revision; assert.ok(rev2 > rev);
    const replay = await upload(h, a, rev, [e]); assert.notEqual(replay.data?.acceptedCount, 1);
    const migrated = event(h, a, rev2, '100'); assert.notEqual((await upload(h, a, rev2, [migrated])).data?.acceptedCount, 1, 'old event id cannot resurrect after consent regrant');
    await h.ok(a, '/life-data', 'DELETE'); assert.equal((await h.ok(a, '/environment-consent')).isEnvironmentGranted, false);
    const day = await h.ok(a, '/environment-days/2026-10-14'); assert.equal(day?.events?.length ?? 0, 0);
    assert.notEqual((await upload(h, a, rev2, [event(h, a, rev2, '102')])).data?.acceptedCount, 1);
  } finally { await h.close(); }
});
