import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);

test('original HTML is an exact copy of the authorized source', async () => {
  const source = await readFile(new URL('original/game.html', root));
  assert.equal(createHash('sha256').update(source).digest('hex'), 'c4f872d0bf8a899cf93a6aa877c13c5a5090e1f592729500bd2ef476205e9952');
});
test('all original scripts are preserved in original order and parse', async () => {
  const source = await readFile(new URL('original/game.html', root), 'utf8');
  const manifest = JSON.parse(await readFile(new URL('www/build-manifest.json', root), 'utf8'));
  const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.equal(manifest.scripts.length, scripts.length);
  for (const [index, filename] of manifest.scripts.entries()) {
    const code = await readFile(new URL(`www/${filename}`, root), 'utf8');
    assert.equal(code, scripts[index][1]);
    new vm.Script(code, { filename });
  }
});
test('packaging preserves original markup and CSS outside explicit adapter wiring', async () => {
  const source = await readFile(new URL('original/game.html', root), 'utf8');
  const result = await readFile(new URL('www/index.html', root), 'utf8');
  const stripScripts = html => html.replace(/<!-- companion-(?:adaptation|prelude):start -->[\s\S]*?<!-- companion-(?:adaptation|prelude):end -->/g, '').replace(/<!-- mobile-adaptation:start -->[\s\S]*?<!-- mobile-adaptation:end -->/g, '').replace(/<!-- ble-local-panel:start -->[\s\S]*?<!-- ble-local-panel:end -->/g, '').replace('<link rel="stylesheet" href="ble-local.css">', '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/\n<\/head>/, '</head>');
  const restoreSafeArea = html => html.replace(/var\(--safe-area-inset-(top|right|bottom|left), env\(safe-area-inset-\1\)\)/g, 'env(safe-area-inset-$1)');
  assert.equal(restoreSafeArea(stripScripts(result)), stripScripts(source));
});
test('mobile adapters load after original rules and match their maintained source', async () => {
  const html = await readFile(new URL('www/index.html', root), 'utf8');
  const assets = ['room-world.css', 'life-panels.css', 'room-world.js', 'life-panels.js'];
  assert.ok(html.indexOf('<!-- mobile-adaptation:start -->') > html.lastIndexOf('</style>'));
  for (const filename of assets) {
    assert.ok(html.includes(`mobile-${filename}`));
    const source = await readFile(new URL(`src/mobile/${filename}`, root), 'utf8');
    const expected = filename.endsWith('.css') ? source.replace(/env\(safe-area-inset-(top|right|bottom|left)\)/g, 'var(--safe-area-inset-$1, env(safe-area-inset-$1))') : source;
    assert.equal(await readFile(new URL(`www/mobile-${filename}`, root), 'utf8'), expected);
    if (filename.endsWith('.js')) new vm.Script(await readFile(new URL(`www/mobile-${filename}`, root), 'utf8'));
  }
});
test('Android uses HTTPS assets and declares independent location foreground service without boot restart', async () => {
  const config = JSON.parse(await readFile(new URL('capacitor.config.json', root), 'utf8'));
  assert.equal(config.server.androidScheme, 'https');
  assert.equal(config.server.url, undefined);
  const manifest = await readFile(new URL('android/app/src/main/AndroidManifest.xml', root), 'utf8');
  assert.ok(manifest.includes('ACCESS_BACKGROUND_LOCATION'));assert.ok(manifest.includes('FOREGROUND_SERVICE_LOCATION'));assert.ok(manifest.includes('android:foregroundServiceType="location"'));assert.ok(!manifest.includes('BOOT_COMPLETED'));
  assert.ok(manifest.includes('android:allowBackup="false"'));
});
