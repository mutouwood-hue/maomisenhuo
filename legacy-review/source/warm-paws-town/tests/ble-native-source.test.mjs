import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../android/app/src/main/java/com/warmpaws/town/ble/BleLocalPlugin.java', import.meta.url), 'utf8');

test('native source gate: CCCD success establishes ready without initial READ', () => {
  const callback = source.slice(source.indexOf('@Override public void onDescriptorWrite'), source.indexOf('@Override public void onCharacteristicWrite'));
  assert.match(callback, /GATT_SUCCESS/);
  assert.match(callback, /finishOperation\(null\);\s*ready = true;/);
  assert.match(callback, /pending\.resolve\(connected\)/);
  assert.match(callback, /emitConnection\("ready", ""\)/);
  assert.doesNotMatch(source, /initialRead/);
});
test('native source gate: stale reconnect cannot clear newer task; lost gate/device cancels intent', () => {
  const callback = source.slice(source.indexOf('reconnectTask = () ->'), source.indexOf('handler.postDelayed(reconnectTask, delay)'));
  assert.match(callback, /if \(token != generation\) return;\s*reconnectTask = null;/);
  assert.match(callback, /!foreground \|\| desiredAddress == null \|\| !gate\(null\).*disconnectInternal\("Reconnect gate unavailable"\)/);
  assert.match(callback, /device == null.*disconnectInternal\("Reconnect device unavailable"\)/);
  const cleanup = source.slice(source.indexOf('private void disconnectInternal'));
  assert.match(cleanup, /desiredAddress = null; reconnectAttempts = 0/);
  assert.match(cleanup, /teardown\(reason\)/);
  assert.match(cleanup, /emitConnection\("disconnected", reason\)/);
});
