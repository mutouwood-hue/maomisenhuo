import { Capacitor, registerPlugin } from '@capacitor/core';
import { BleLocalClient } from './client.js';
import { OP } from './protocol.js';

// Single-language native JS application: React/Vue appendix does not apply.
const text = Object.freeze({ unsupported: '网页预览不调用蓝牙；请安装 Android APK 后测试。', disconnected: '已断开，自动重连已停止。', empty: '暂无设备，请先扫描。', unnamed: '未命名设备', scanning: '正在扫描，最多 8 秒…', scanDone: '扫描已结束。请选择设备。', permissionGranted: '权限已允许，请扫描设备。', permissionDenied: '蓝牙权限未允许；请在系统设置中授权。', waiting: '正在连接、订阅 CCCD 并执行 HELLO + GET_STATE…', ready: '本地协议就绪（不是账号认证或设备绑定）。', commandDone: '已收到同序号、同操作码的应用 ACK。', noState: '尚未收到设备状态。', working: '命令处理中，等待设备应用 ACK…', unexpected: '操作失败，请重试。' });
const connectionLabels = Object.freeze({ connecting: '连接中…', discovering: '发现 GATT 服务中…', subscribing: '订阅 TX 通知中…', ready: '传输就绪，协议握手中…', disconnected: '设备已断开。', reconnecting: '正在等待有界前台重连…' });
const plugin = registerPlugin('BleLocal');

function mountPanel() {
  const get = suffix => document.getElementById(`ble-local-${suffix}`);
  const dialog = get('dialog');
  if (!dialog) return;
  const status = get('status');
  const error = get('error');
  const devices = get('device');
  const native = Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('BleLocal');
  const commandButtons = ['state', 'start', 'send-ping', 'send-face'].map(get);
  let scanning = false;
  let busy = false;
  let granted = false;
  let connected = false;
  const events = new AbortController();
  const client = new BleLocalClient(plugin, { onChange: handleChange });
  window.__companionBle = client;
  function controls() {
    get('permissions').disabled = !native || busy || scanning || connected;
    get('scan').disabled = !native || !granted || scanning || busy || connected;
    get('stop').disabled = !scanning;
    devices.disabled = scanning || connected || devices.options.length === 0 || !devices.value;
    get('connect').disabled = !native || busy || scanning || connected || !devices.value;
    get('disconnect').disabled = !native;
    for (const button of commandButtons) button.disabled = !client.isReady || busy;
  }
  function renderState() { get('readout').textContent = client.state ? JSON.stringify({ localIdentityNotBinding: client.hello, state: client.state }, null, 2) : text.noState; }
  function handleChange(event) {
    if (event.type === 'device') {
      let option = [...devices.options].find(item => item.value === event.address);
      if (!option) {
        if (devices.options.length === 1 && !devices.options[0].value) devices.replaceChildren();
        option = document.createElement('option'); option.value = event.address; devices.append(option);
      }
      option.textContent = `${event.name || text.unnamed} · ${event.address} · ${event.rssi} dBm`;
    } else if (event.type === 'connection') {
      connected = ['connecting', 'discovering', 'subscribing', 'ready', 'reconnecting'].includes(event.state);
      status.textContent = connectionLabels[event.state] || event.state;
      if (event.reason && event.state === 'disconnected') error.textContent = event.reason;
      renderState();
    } else if (event.type === 'ready') { status.textContent = text.ready; connected = true; renderState(); }
    else if (event.type === 'state') renderState();
    else if (event.type === 'error' || event.type === 'protocolError') error.textContent = event.message;
    controls();
  }
  async function run(action, message = text.working) {
    busy = true; error.textContent = ''; status.textContent = message; controls();
    try { await action(); }
    catch (failure) { error.textContent = failure?.message || text.unexpected; }
    finally { busy = false; controls(); }
  }
  const on = (suffix, action) => get(suffix).addEventListener('click', action, { signal: events.signal });
  on('open', () => { dialog.showModal(); controls(); if (!native) status.textContent = text.unsupported; });
  dialog.querySelector('.close-button').addEventListener('click', () => dialog.close(), { signal: events.signal });
  dialog.addEventListener('close', () => {
    if (native) void run(async () => { await client.disconnect(); connected = false; status.textContent = text.disconnected; renderState(); });
    get('open').focus();
  }, { signal: events.signal });
  on('permissions', () => void run(async () => { const result = await plugin.requestBlePermissions(); granted = result.granted; status.textContent = granted ? text.permissionGranted : text.permissionDenied; }));
  on('scan', () => void run(async () => {
    scanning = true; devices.replaceChildren(new Option(text.empty, '')); controls();
    try { await plugin.scan({ durationMs: 8000 }); status.textContent = text.scanDone; }
    finally { scanning = false; controls(); }
  }, text.scanning));
  on('stop', () => void plugin.stopScan().catch(failure => { error.textContent = failure.message; }));
  devices.addEventListener('change', controls, { signal: events.signal });
  on('connect', () => void run(async () => { await plugin.connect({ address: devices.value }); }, text.waiting));
  on('disconnect', () => void run(async () => { await client.disconnect(); connected = false; status.textContent = text.disconnected; renderState(); }));
  on('state', () => void run(async () => { await client.getState(); status.textContent = text.commandDone; }));
  on('start', () => void run(async () => { await client.request(OP.START_LOCAL); await client.getState(); status.textContent = text.commandDone; }));
  on('send-ping', () => void run(async () => { await client.request(OP.PING, new TextEncoder().encode(get('ping').value)); status.textContent = text.commandDone; }));
  on('send-face', () => void run(async () => { await client.request(OP.SET_FACE, [Number(get('face').value)]); await client.getState(); status.textContent = text.commandDone; }));
  controls();
  if (native) void client.initialize().catch(failure => { error.textContent = failure.message; });
  window.addEventListener('pagehide', () => { events.abort(); if (native) void client.dispose().catch(() => {}); }, { once: true });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountPanel, { once: true }); else mountPanel();
