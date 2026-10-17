import test from 'node:test';
import assert from 'node:assert/strict';
import { SocialClient } from '../../mobile-pet/src/social/client.js';

test('M2 mobile explicit idempotency uses account namespace, fresh leases and body-free records', async () => {
  const values = new Map(), requests = []; let owner = 'account-A', serial = 0;
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v) };
  const client = new SocialClient({ storage, getOwner: () => owner, createId: () => `test-key-${++serial}`, api: { request: async (path, options) => { requests.push({ path, ...options }); return {}; } } });
  await client.proof('encounter-1', { proofBase64: 'TEST-SENSITIVE-PROOF' }, { operationKey: 'same-action' });
  await client.proof('encounter-1', { proofBase64: 'TEST-SENSITIVE-PROOF' }, { operationKey: 'same-action' });
  assert.equal(requests[0].idempotencyKey, requests[1].idempotencyKey);
  owner = 'account-B'; await client.proof('encounter-1', {}, { operationKey: 'same-action' });
  assert.notEqual(requests[2].idempotencyKey, requests[0].idempotencyKey);
  await client.discovery({}); await client.discovery({}); assert.notEqual(requests[3].idempotencyKey, requests[4].idempotencyKey);
  assert.ok([...values.values()].every(value => !value.includes('TEST-SENSITIVE') && Object.keys(JSON.parse(value)).join() === 'id'));
  values.set('m2-request:account-B:broken', '{');
  const before = requests.length; await assert.rejects(() => client.gift({}, { operationKey: 'broken' })); assert.equal(requests.length, before);
  owner = null; await assert.rejects(() => client.discovery({})); assert.equal(requests.length, before);
});
