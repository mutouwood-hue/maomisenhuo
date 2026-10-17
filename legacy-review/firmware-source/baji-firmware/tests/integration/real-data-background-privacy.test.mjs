import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplication } from '../../backend/src/app.mjs';

test('background location never widens cloud consent DTO or raw-coordinate ingress', async () => {
  const app = createApplication({ config: { dbPath: ':memory:', inviteCode: 'background-test', deviceKeys: {}, origins: [] }, clock: () => new Date('2026-10-14T13:00:00+08:00') });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${app.server.address().port}`;
  let token;
  const call = async (method, path, body) => {
    const response = await fetch(url + path, { method, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { http: response.status, ...await response.json() };
  };
  try {
    const registered = await call('POST', '/api/accounts', { username: 'background_user', password: 'test-only-password', inviteCode: 'background-test' });
    assert.equal(registered.code, 200); token = registered.data.accessToken;
    const consent = { baseRevision: 0, isLifeSyncEnabled: true, isLocationGranted: true, isMotionGranted: false, isMicrophoneGranted: false };
    assert.equal((await call('PUT', '/api/consents', { ...consent, isBackgroundLocationGranted: true })).http, 400, 'OS background permission is local, not a forged cloud boolean');
    const allowed = await call('PUT', '/api/consents', consent); assert.equal(allowed.code, 200);
    const summary = { baseRevision: 0, consentRevision: allowed.data.revision, timeZone: 'Asia/Shanghai', source: 'NATIVE', segments: [{ id: 'stay', startAt: '2026-10-14 10:00:00', endAt: '2026-10-14 10:20:00', type: 'OTHER', placeId: 'place', placeAlias: '常去地点1' }], places: [{ id: 'place', alias: '常去地点1', type: 'OTHER', visitIds: ['stay'] }], motion: null, moments: [] };
    const attempts = [
      { ...summary, coordinates: [{ latitude: 31, longitude: 121 }] },
      { ...summary, samples: [{ timestamp: 1791939600000, coords: { latitude: 31, longitude: 121, accuracy: 15 } }] },
      { ...summary, places: [{ ...summary.places[0], lat: 31, lon: 121 }] },
      { ...summary, segments: [{ ...summary.segments[0], location: { latitude: 31, longitude: 121 } }] },
    ];
    for (const attempt of attempts) assert.equal((await call('PUT', '/api/life-days/2026-10-14', attempt)).http, 400);
    assert.equal((await call('GET', '/api/life-days/2026-10-14')).data, null, 'rejected coordinates cannot be persisted');
    const accepted = await call('PUT', '/api/life-days/2026-10-14', summary); assert.equal(accepted.code, 200);
    assert.equal(accepted.data.summary.stepCount, null); assert.doesNotMatch(JSON.stringify(accepted.data), /"(?:latitude|longitude|coords|lat|lon|samples)"/);
    const cleared = await call('DELETE', '/api/life-data'); assert.equal(cleared.code, 200);
    assert.deepEqual(Object.fromEntries(Object.entries(cleared.data).filter(([key]) => key.startsWith('is'))), { isLifeSyncEnabled: false, isLocationGranted: false, isMotionGranted: false, isMicrophoneGranted: false });
    assert.equal((await call('PUT', '/api/life-days/2026-10-14', { ...summary, baseRevision: 1 })).http, 403);
    assert.equal((await call('GET', '/api/life-days/2026-10-14')).data, null);
  } finally { await app.close(); }
});
