import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const parseSize = value => /M$/i.test(value) ? Number(value.slice(0, -1)) * 1024 ** 2 : Number(value);
async function partitions(name) {
  const text = await readFile(new URL(`../../${name}`, import.meta.url), 'utf8');
  let end = 0x9000;
  return text.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#')).map(line => {
    const [name, type, subtype, offset, size] = line.split(',').map(x => x.trim());
    const start = offset ? parseSize(offset) : type === 'app' ? Math.ceil(end / 0x10000) * 0x10000 : end;
    const row = { name, type, subtype, start, size: parseSize(size) }; end = row.end = start + row.size; return row;
  });
}
test('M2 partition allocation fits 32MiB, dual slots/asset banks do not overlap', async () => {
  const rows = await partitions('partitions-m2.csv');
  for (let i = 0; i < rows.length; i++) {
    assert.ok(rows[i].size > 0);
    assert.ok(rows[i].end <= 32 * 1024 ** 2);
    if (i) assert.ok(rows[i].start >= rows[i - 1].end, `${rows[i].name} overlaps`);
    if (rows[i].type === 'app') assert.equal(rows[i].start % 0x10000, 0);
  }
  const apps = rows.filter(x => x.type === 'app'); assert.deepEqual(apps.map(x => x.subtype), ['ota_0', 'ota_1']); assert.equal(apps[0].size, apps[1].size); assert.equal(apps[0].size, 8 * 1024 ** 2);
  assert.equal(rows.find(x => x.name === 'otadata').size, 0x2000);
  assert.equal(rows.at(-1).end, 0x1e20000);
  assert.equal(32 * 1024 ** 2 - rows.at(-1).end, 0x1e0000);
});
test('M2 OTA layout is not a legacy factory partition OTA upgrade', async () => {
  const legacy = await partitions('partitions.csv');
  assert.ok(legacy.some(x => x.subtype === 'factory'));
  assert.equal(legacy.some(x => x.subtype === 'ota_0' || x.subtype === 'ota_1'), false);
  assert.equal(legacy.some(x => x.subtype === 'ota'), false);
  const config = await readFile(new URL('../../sdkconfig.m2.defaults', import.meta.url), 'utf8');
  assert.match(config, /CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE=y/);
  assert.match(config, /CONFIG_PARTITION_TABLE_CUSTOM_FILENAME="partitions-m2.csv"/);
  // This checks source allocation only. No artifact sizing/flash/hardware/rollback is implied.
});
