import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, hmac } from './m2-helper.mjs';

function signedCare(h, user, id, type = 1, a = 0) {
  const raw = Buffer.alloc(16); raw.writeBigUInt64LE(BigInt(id)); raw.writeUInt32LE(Math.floor(h.now() / 1000), 8); raw[12] = type; raw[13] = a;
  return { eventId: String(id), eventBase64: Buffer.concat([raw, hmac(user.key, 'BAJI-EVENT-v1', Buffer.from(user.id, 'hex'), raw)]).toString('base64') };
}

test('M2 authoritative pet eligibility/balance cannot be replaced by legacy client save', async () => {
  const h = await harness();
  try {
    const [a] = h.users;
    const original = await h.ok(a, '/social-pets'); assert.equal(original.list.length, 1); assert.equal(original.list[0].xp, 0); assert.equal(original.list[0].isAdult, false); assert.equal(original.balanceCoins, 30);
    const current = await h.ok(a, '/pet-saves/current'), save = structuredClone(current.save);
    save.coins = 1000000; save.cats[0].xp = 1000000; save.cats[0].adultAt = h.now() - 86400000; save.cats[0].health = 100;
    const invented = structuredClone(save.cats[0]); invented.id = 'cat-2'; invented.name = '虚构成年猫'; save.cats.push(invented);
    await h.ok(a, '/pet-saves/current', 'PUT', { baseRevision: current.revision, save });
    const after = await h.ok(a, '/social-pets'); assert.deepEqual(after, original, 'self-uploaded balances, adult dates and extra cats cannot affect M2 authority');
    const event = signedCare(h, a, '7000001');
    const accepted = await h.ok(a, `/devices/${a.id}/event-batches`, 'POST', { sessionId: a.binding.sessionId, events: [event] });
    assert.equal(accepted.results[0].isSettled, true);
    const advanced = await h.ok(a, '/social-pets'); assert.ok(advanced.list[0].xp > 0 && advanced.list[0].xp < 160); assert.equal(advanced.balanceCoins, 31);
    await h.ok(a, `/devices/${a.id}/event-batches`, 'POST', { sessionId: a.binding.sessionId, events: [event] });
    assert.deepEqual(await h.ok(a, '/social-pets'), advanced, 'duplicate signed care must not advance authoritative xp twice');
    const newer = await h.ok(a, '/pet-saves/current'); newer.save.cats[0].xp = 0; newer.save.coins = 0;
    await h.ok(a, '/pet-saves/current', 'PUT', { baseRevision: newer.revision, save: newer.save });
    assert.deepEqual(await h.ok(a, '/social-pets'), advanced, 'legacy save cannot downgrade or erase authoritative pet either');
    await h.ok(a, `/device-bindings/${a.id}`, 'DELETE');
    const swapped = await h.ok(a, '/pet-saves/current'); swapped.save.activeCatId = 'cat-2';
    await h.ok(a, '/pet-saves/current', 'PUT', { baseRevision: swapped.revision, save: swapped.save });
    const challenge = await h.ok(a, `/devices/${a.id}/binding-challenges`, 'POST', {});
    await h.request(a, '/device-bindings', 'POST', { deviceId: a.id, challengeId: challenge.challengeId, proofBase64: hmac(a.key, 'BAJI-BIND-v1', Buffer.from(a.id, 'hex'), Buffer.from(challenge.challengeBase64, 'base64')).toString('base64') });
    assert.deepEqual(await h.ok(a, '/social-pets'), advanced, 'client-added active cat plus rebind cannot mint a second random starter or reroll genetics');
  } finally { await h.close(); }
});

test('M2 wrong current owner cannot inherit historical signed care authority after unbind/rebind', async () => {
  const h = await harness();
  try {
    const [a, , newcomer] = h.users; const event = signedCare(h, a, '7100001');
    await h.ok(a, `/devices/${a.id}/event-batches`, 'POST', { sessionId: a.binding.sessionId, events: [event] });
    await h.ok(a, `/device-bindings/${a.id}`, 'DELETE'); h.advance(5000);
    const challenge = await h.ok(newcomer, `/devices/${a.id}/binding-challenges`, 'POST', {});
    newcomer.id = a.id; newcomer.key = a.key;
    newcomer.binding = await h.ok(newcomer, '/device-bindings', 'POST', { deviceId: a.id, challengeId: challenge.challengeId, proofBase64: hmac(a.key, 'BAJI-BIND-v1', Buffer.from(a.id, 'hex'), Buffer.from(challenge.challengeBase64, 'base64')).toString('base64') });
    const before = await h.ok(newcomer, '/social-pets');
    const rejected = await h.ok(newcomer, `/devices/${a.id}/event-batches`, 'POST', { sessionId: newcomer.binding.sessionId, events: [event] });
    assert.equal(rejected.results[0].isSettled, false);
    assert.deepEqual(await h.ok(newcomer, '/social-pets'), before);
    assert.equal((await h.request(a, `/devices/${a.id}/sync-state`)).status, 403);
  } finally { await h.close(); }
});
