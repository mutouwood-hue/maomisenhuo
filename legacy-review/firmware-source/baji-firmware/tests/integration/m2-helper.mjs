import { createHmac, createHash } from 'node:crypto';
import { createApplication } from '../../backend/src/app.mjs';
import assert from 'node:assert/strict';

// Independent test-only producer: never import backend/firmware crypto or canonical helpers.
export const IDS = ['112233445566', 'aabbccddeeff'];
export const KEYS = [Buffer.alloc(32, 0x36), Buffer.alloc(32, 0x5c)];
const mac = id => Buffer.from(id, 'hex');
const uuid = id => Buffer.from(id.replaceAll('-', ''), 'hex');
export const digest = bytes => createHash('sha256').update(bytes).digest();
export function hmac(key, domain, ...bytes) {
  const hash = createHmac('sha256', key).update(Buffer.from(domain, 'ascii'));
  for (const bytesPart of bytes) hash.update(bytesPart);
  return hash.digest();
}
export function saveFixture(time, sex = 'male') {
  return { version: 2, activeCatId: 'cat-1', cats: [{ id: 'cat-1', name: sex === 'male' ? '公猫测试' : '母猫测试', xp: 200, stats: { food: 50, mood: 50, clean: 50, energy: 50 }, counts: { feed: 0, bath: 0, pet: 0, play: 0, sleep: 0, climb: 0, tease: 0, drink: 0 }, claimedGoals: [], breed: sex === 'male' ? 'orange' : 'silver', sex, outfit: 'none', health: 100, healthIssue: null, joinedAt: time - 86400000, adultAt: time - 10000, generation: 1, heritage: null, gradCalledAt: null, gradDelayUntil: null }], coins: 100, wardrobe: ['none'], inventory: { fish: 0, flower: 0, shell: 0, star: 0 }, world: { completed: { walk: 0, explore: 0, fish: 0 }, collected: { fish: 0, flower: 0, shell: 0, star: 0 }, claimedOrders: [], choices: 0, lastLocation: 'garden', nextSession: 1 }, family: { pair: null, babiesBorn: 0 }, journal: [], createdAt: time - 86400000, lastSavedAt: time, graduates: [] };
}
export const TEST_POLICY = {
  version: 'independent-test-only-v1', isExperimental: true, venueIds: ['TEST-VENUE'],
  catalog: [{ id: 'test-gift', kind: 'ITEM', rarity: 1, isGiftable: true, isExchangeable: true }, { id: 'test-stamp', kind: 'STAMP', rarity: 1, isGiftable: true, isExchangeable: true }, { id: 'test-rare', kind: 'TRAIT', rarity: 3, isGiftable: false, isExchangeable: false }],
  encounterRewards: { newCatalogIds: ['test-gift', 'test-stamp'], repeatCatalogIds: [], repeatCooldownSeconds: 60, repeatLimitPerDay: 3 },
  giverRewardCatalogIds: ['test-stamp'], starterCoins: 30, starterCatalogIds: ['test-gift', 'test-stamp'], encounterActionSeconds: 300, highValueCooldownSeconds: 60, exchangeExpirySeconds: 60, giftMaxRarity: 1,
  skillRules: [{ id: 'test-cooking', name: 'TEST skill', careAction: 2, careTarget: 5, minIntimacy: 1, probabilityPermille: 1000, isTeachable: true }],
  breeding: { costCoins: 30, incubationSeconds: 60, careTarget: 3, cooldownSeconds: 60, minIntimacy: 1, rareProbabilityPermille: 1000, rareCatalogIds: ['test-rare'], cancelRefundCoins: 30 },
  personality: { dimensions: ['outgoing', 'clingy', 'showy', 'calm'], initialPermille: 500, careDeltaPermille: 10, expressionCooldownSeconds: 60 },
};
export async function harness(policy = TEST_POLICY, { randomInt, dbPath = ':memory:', venueAuthorizer, privacyEligibilityProvider, afterTrustedCare, gateway, config: extraConfig = {} } = {}) {
  const venueMembers = new Set();
  const testVenueAuthorizer = context => venueMembers.has(context.accountId) && context.venueId === 'TEST-VENUE' ? { accountId: context.accountId, deviceId: context.deviceId, sessionId: context.sessionId, venueId: context.venueId, expiresAt: context.now + 60000, scope: 'PILOT_MEMBERSHIP', evidenceId: 'independent-test-member' } : null;
  const testPrivacyProvider = context => venueMembers.has(context.accountId) ? { accountId: context.accountId, ageBand: '14_PLUS', guardianScopes: [], evidenceId: 'independent-test-eligibility', expiresAt: context.now + 86400000 } : null;
  let time = Date.parse('2026-10-14T15:00:00+08:00'), serial = 0;
  const env = policy ? { BAJI_M2_POLICY_JSON: JSON.stringify(policy) } : {};
  const start = () => createApplication({ randomInt, afterTrustedCare, gateway, privacyEligibilityProvider: privacyEligibilityProvider === undefined ? testPrivacyProvider : privacyEligibilityProvider, venueAuthorizer: venueAuthorizer === undefined ? testVenueAuthorizer : venueAuthorizer, env, config: { ...extraConfig, m2Policy: policy, dbPath, inviteCode: 'M2-TEST-ONLY', deviceKeys: Object.fromEntries(IDS.map((id, i) => [id, KEYS[i]])), origins: [] }, clock: () => new Date(time) });
  let app = start(), closed = false;
  const close = async () => { if (!closed) { await app.close(); closed = true; } };
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  let base = `http://127.0.0.1:${app.server.address().port}`;
  const users = [];
  async function request(user, path, method = 'GET', body, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (user?.token) headers.Authorization = `Bearer ${user.token}`;
    if (method === 'POST' && !options.omitKey) headers['Idempotency-Key'] = options.key ?? `m2-independent-${++serial}`;
    const response = await fetch(base + '/api' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const envelope = await response.json();
    return { status: response.status, ...envelope };
  }
  async function ok(user, path, method = 'GET', body, options) {
    const result = await request(user, path, method, body, options);
    assert.equal(result.code, 200, `${method} ${path}: ${JSON.stringify(result)}`);
    return result.data;
  }
  try {
    for (let i = 0; i < 3; i++) {
      const account = await ok(null, '/accounts', 'POST', { username: `m2user_${i}`, password: 'TEST-ONLY-password-24', inviteCode: 'M2-TEST-ONLY' });
      const user = { token: account.accessToken, userId: account.userId, id: IDS[i], key: KEYS[i] };
      users.push(user);
      await ok(user, '/pet-saves/current', 'PUT', { baseRevision: 0, save: saveFixture(time, i === 1 ? 'female' : 'male') });
      if (i < 2) {
        venueMembers.add(user.userId);
        const challenge = await ok(user, `/devices/${user.id}/binding-challenges`, 'POST', {});
        const proof = hmac(user.key, 'BAJI-BIND-v1', mac(user.id), Buffer.from(challenge.challengeBase64, 'base64'));
        user.binding = await ok(user, '/device-bindings', 'POST', { deviceId: user.id, challengeId: challenge.challengeId, proofBase64: proof.toString('base64') });
      }
    }
  } catch (error) { await app.close(); throw error; }
  return { get base() { return base; }, users, request, ok, close, restart: async () => { assert.notEqual(dbPath, ':memory:'); await close(); app = start(); closed = false; await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${app.server.address().port}`; }, now: () => time, advance: ms => { time += ms; } };
}
export function challengeBody(base64, user) {
  const envelope = Buffer.from(base64, 'base64');
  assert.equal(envelope.length, 118, 'kind10 envelope20 + challenge66 + MAC32');
  assert.deepEqual(envelope.subarray(0, 16), uuid(user.binding.sessionId));
  const expected = hmac(user.key, 'BAJI-SYNC-v1', mac(user.id), Buffer.from([10]), envelope.subarray(0, 86));
  assert.deepEqual(envelope.subarray(86), expected, 'signed challenge independently verifies sync domain + kind');
  return { envelope, body: envelope.subarray(20, 86), expected };
}
export function transcript(body, pattern = Buffer.alloc(0)) {
  assert.equal(body.length, 66);
  assert.equal(body[0], 1);
  const pair = [body.subarray(17, 23), body.subarray(23, 29)].sort(Buffer.compare);
  return digest(Buffer.concat([Buffer.from('BAJI-TRANSCRIPT-v1', 'ascii'), body.subarray(1, 17), ...pair, body.subarray(29, 61), body.subarray(65, 66), pattern]));
}
export function proof(body, user, hash = transcript(body)) {
  return Buffer.concat([hash, hmac(user.key, 'BAJI-MEET-v1', mac(user.id), body, hash)]).toString('base64');
}
export async function accompanyParents(h, users = h.users.slice(0, 2)) {
  for (let index = 0; index < 6; index++) {
    for (const user of users) {
      if (new Date(user.binding.expiresAt.replace(' ', 'T') + '+08:00').getTime() <= h.now() + 10000) {
        const challenge = await h.ok(user, `/devices/${user.id}/binding-challenges`, 'POST', {});
        user.binding = await h.ok(user, '/device-bindings', 'POST', {deviceId:user.id,challengeId:challenge.challengeId,proofBase64:hmac(user.key,'BAJI-BIND-v1',mac(user.id),Buffer.from(challenge.challengeBase64,'base64')).toString('base64')});
      }
    }
    const from = Math.floor(h.now() / 1000); h.advance(10000);
    for (const user of users) {
      const body = Buffer.alloc(39); body[0] = 1;
      const eventId = String(from); body.writeBigUInt64LE(BigInt(eventId), 1); body.writeUInt32LE(1, 9);
      body.writeUInt32LE(from, 13); body.writeUInt32LE(from + 10, 17); body.writeUInt16LE(10, 21); uuid(user.binding.sessionId).copy(body, 23);
      const signedEventBase64 = Buffer.concat([body, hmac(user.key, 'BAJI-ACTIVE-v1', mac(user.id), body)]).toString('base64');
      const receipt = await h.ok(user, `/devices/${user.id}/active-batches`, 'POST', {sessionId:user.binding.sessionId,events:[{eventId,signedEventBase64}]});
      assert.equal(receipt.acceptedCount, 1); assert.equal(receipt.results[0].isSettled, true, JSON.stringify(receipt));
    }
  }
}

export function environmentEvent(user, { id, seconds, revision, label = 1, confidence = 900, sampleSeconds = 1, flags = 0, version = 1 }) {
  const body = Buffer.alloc(24);
  body[0] = version; body.writeBigUInt64LE(BigInt(id), 1); body.writeUInt32LE(seconds, 9); body.writeUInt32LE(revision, 13); body[17] = label; body.writeUInt16LE(confidence, 18); body.writeUInt16LE(sampleSeconds, 20); body.writeUInt16LE(flags, 22);
  return Buffer.concat([body, hmac(user.key, 'BAJI-ENV-v1', mac(user.id), body)]).toString('base64');
}
