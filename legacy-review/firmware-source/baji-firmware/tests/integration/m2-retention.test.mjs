import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { harness, TEST_POLICY, environmentEvent } from './m2-helper.mjs';

// Business records are created solely over HTTP. SQLite is opened read-only for physical-retention assertions.
test('M2 file SQLite restart physically purges seven-day environment/diary while retaining digest replay tombstone', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'baji-m2-retention-')), dbPath = join(dir, 'test.sqlite');
  let h;
  try {
    h = await harness(TEST_POLICY, { dbPath }); const [a] = h.users;
    const prior = await h.ok(a, '/consents');
    const consent = await h.ok(a, '/consents', 'PUT', { baseRevision: prior.revision, isLifeSyncEnabled: true, isLocationGranted: false, isMotionGranted: false, isMicrophoneGranted: false });
    await h.ok(a, '/life-days/2026-10-14', 'PUT', { baseRevision: 0, consentRevision: consent.revision, timeZone: 'Asia/Shanghai', source: 'MANUAL', segments: [], places: [], motion: null, moments: [{ id: 'ttl-moment', occurredAt: '2026-10-14 15:00:00', type: 'CARE', heart: 30 }] });
    await h.ok(a, '/pet-diaries', 'POST', { catId: 'cat-1', date: '2026-10-14', isTextCloudAllowed: false }, { key: 'ttl-diary-key' });
    const envPrior = await h.ok(a, '/environment-consent');
    const environment = await h.ok(a, '/environment-consent', 'PUT', { baseRevision: envPrior.revision, isEnvironmentGranted: true });
    h.advance(2000);
    const entry = { id: '9900001', deviceId: a.id, signedEventBase64: environmentEvent(a, { id: '9900001', seconds: Math.floor(h.now()/1000), revision: environment.revision }) };
    await h.ok(a, '/environment-events', 'POST', { consentRevision: environment.revision, events: [entry] });
    await h.restart();
    const duplicate = await h.ok(a, '/environment-events', 'POST', { consentRevision: environment.revision, events: [entry] }); assert.equal(duplicate.duplicateCount, 1);
    const inspect = () => {
      const db = new DatabaseSync(dbPath, { readOnly: true });
      try { return { events: db.prepare('SELECT count(*) n FROM environment_event').get().n, diaries: db.prepare('SELECT count(*) n FROM pet_diary').get().n, receipts: db.prepare('SELECT body FROM environment_receipt').all(), retry: db.prepare('SELECT body FROM m2_request').all() }; } finally { db.close(); }
    };
    const live = inspect(); assert.equal(live.events, 1); assert.equal(live.diaries, 1);
    assert.ok(live.receipts.every(row => !row.body.includes('signedEventBase64') && row.body.includes('fingerprint')), 'receipt stores only digest, never retained signed label payload');
    h.advance(7*86400000 + 1000); await h.restart();
    const expired = inspect();
    assert.equal(expired.events, 0, 'expired environment labels must be physically removed, not only hidden by GET');
    assert.equal(expired.diaries, 0, 'expired personal diaries must be physically removed');
    assert.equal(expired.receipts.length, 1, 'digest tombstone remains to prevent event revival');
    assert.ok(expired.retry.every(row => !row.body.includes('今天我陪你一起生活')), 'expiry must also purge retained private diary retry responses');
  } finally {
    await h?.close();
    // Exact directory returned by mkdtemp is checked before deleting this test-owned artifact.
    assert.ok(dir.startsWith(join(tmpdir(), 'baji-m2-retention-'))); await rm(dir, { recursive: true, force: true });
  }
});
