import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const FLASH_BYTES = 32 * 1024 * 1024;
const APP_ALIGNMENT = 0x10000;
const DATA_ALIGNMENT = 0x1000;
const ROOT = new URL('../', import.meta.url);
const readSource = name => readFileSync(new URL(name, ROOT), 'utf8');

function parsePartitions(source) {
  return source.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#')).map(line => {
    const [name, type, subtype, offset, size] = line.split(',').map(value => value.trim());
    return { name, type, subtype, offset: Number(offset), size: Number(size) };
  });
}

test('M2 OTA分区双槽、对齐、不重叠且未超32MB', () => {
  const partitions = parsePartitions(readSource('partitions-m2.csv'));
  assert.equal(partitions.length, 7);
  let previousEnd = 0;
  for (const partition of partitions) {
    assert.ok(Number.isSafeInteger(partition.offset));
    assert.ok(Number.isSafeInteger(partition.size) && partition.size > 0);
    assert.equal(partition.offset % (partition.type === 'app' ? APP_ALIGNMENT : DATA_ALIGNMENT), 0);
    assert.ok(partition.offset >= previousEnd, `${partition.name} overlaps preceding partition`);
    previousEnd = partition.offset + partition.size;
    assert.ok(previousEnd <= FLASH_BYTES);
  }
  for (const name of ['ota_0', 'ota_1']) {
    const partition = partitions.find(entry => entry.name === name);
    assert.equal(partition.type, 'app');
    assert.equal(partition.subtype, name);
    assert.equal(partition.size, 8 * 1024 * 1024);
  }
  assert.equal(partitions.find(entry => entry.name === 'assets_a').size, partitions.find(entry => entry.name === 'assets_b').size);
  assert.equal(partitions.find(entry => entry.name === 'otadata').size, 2 * DATA_ALIGNMENT);
});

test('M2显式覆盖启用rollback且legacy分区默认不改变', () => {
  const legacy = readSource('partitions.csv');
  assert.match(legacy, /factory,\s+app,\s+factory/);
  assert.match(legacy, /storage,\s+data,\s+spiffs/);
  assert.match(readSource('sdkconfig.defaults'), /CONFIG_PARTITION_TABLE_CUSTOM_FILENAME="partitions.csv"/);
  const m2 = readSource('sdkconfig.m2.defaults');
  assert.match(m2, /CONFIG_PARTITION_TABLE_CUSTOM_FILENAME="partitions-m2.csv"/);
  assert.match(m2, /CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE=y/);
  assert.doesNotMatch(m2, /^CONFIG_SECURE_BOOT.*=y/m);
});

test('M2构建入口显式隔离配置与stage且拒绝直接刷写', () => {
  const script = readSource('tools/build-firmware.ps1');
  assert.match(script, /\[switch\]\$M2/);
  assert.match(script, /orangecat-m2-build/);
  assert.match(script, /orangecat-m2'/);
  assert.match(script, /sdkconfig\.m2'\)\.Replace/);
  assert.match(script, /-DSDKCONFIG_DEFAULTS=sdkconfig\.defaults;sdkconfig\.m2\.defaults/);
  assert.match(script, /'flash', 'erase-flash'/);
  assert.match(script, /-DBAJI_V2=ON/);
  assert.match(script, /isM2\s+= \[bool\]\$M2/);
});

test('配置核验优先实际M2配置并合并覆盖默认值', () => {
  const script = readSource('tools/check-sdkconfig.mjs');
  assert.match(script, /if \(record\?\.isM2\)/);
  assert.match(script, /sdkconfig\.m2\.defaults/);
  assert.match(script, /defaults\.set\(name, value\)/);
  assert.match(script, /\[record\.sdkconfig,/);
  assert.match(script, /record\.isM2 \? 'sdkconfig\.m2' : 'sdkconfig'/);
});

test('头文件整数1保持数值并按期望类型匹配布尔', () => {
  const script = readSource('tools/check-sdkconfig.mjs');
  const parser = script.slice(script.indexOf('function parseHeader(text)'), script.indexOf('\nconst failures = []'));
  const parseHeader = runInNewContext(`${parser}\nparseHeader`);
  const values = parseHeader('#define CONFIG_NUMBER 1\n#define CONFIG_ENABLED 1\n#define CONFIG_TEXT "test"');
  assert.equal(values.get('CONFIG_NUMBER'), '1');
  assert.equal(values.get('CONFIG_ENABLED'), '1');
  assert.equal(values.get('CONFIG_TEXT'), '"test"');
  assert.match(script, /expectedHeaderValue = want === 'y' \? '1' : want/);
  assert.match(script, /got !== expectedHeaderValue/);
});
