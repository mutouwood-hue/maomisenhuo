import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './m2-helper.mjs';

test('M2 HTTP ordinary life consent revocation removes diary and old-key response cannot resurrect it', async () => {
  const h = await harness();
  try {
    const [a, , stranger] = h.users;
    const before = await h.ok(a, '/consents');
    const consent = await h.ok(a, '/consents', 'PUT', { baseRevision: before.revision, isLifeSyncEnabled: true, isLocationGranted: false, isMotionGranted: false, isMicrophoneGranted: false });
    const summary = { baseRevision: 0, consentRevision: consent.revision, timeZone: 'Asia/Shanghai', source: 'MANUAL', segments: [], places: [], motion: null, moments: [{ id: 'real-test-moment', occurredAt: '2026-10-14 14:59:59', type: 'CARE', heart: 20 }] };
    await h.ok(a, '/life-days/2026-10-14', 'PUT', summary);
    const request = { catId: 'cat-1', date: '2026-10-14', isTextCloudAllowed: false }, key = 'diary-private-retry-key';
    const diary = await h.ok(a, '/pet-diaries', 'POST', request, { key });
    assert.equal((await h.ok(a, '/pet-diaries')).list.some(row => row.id === diary.id), true);
    assert.equal((await h.ok(stranger, '/pet-diaries')).total, 0);
    await h.ok(a, '/consents', 'PUT', { baseRevision: consent.revision, isLifeSyncEnabled: false, isLocationGranted: false, isMotionGranted: false, isMicrophoneGranted: false });
    assert.equal((await h.ok(a, '/pet-diaries')).total, 0, 'normal consent revocation must erase derived diary, not just DELETE life-data');
    const replay = await h.request(a, '/pet-diaries', 'POST', request, { key });
    assert.notEqual(replay.data?.text, diary.text, 'old idempotency response cannot replay revoked personal diary');
    assert.equal((await h.ok(a, '/pet-diaries')).total, 0);
  } finally { await h.close(); }
});
