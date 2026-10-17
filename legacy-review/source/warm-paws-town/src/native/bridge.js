import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Geolocation } from '@capacitor/geolocation';

const messages = {
  exportFailed: '存档分享失败，请重试。原存档仍保留在本机。',
  exportBusy: '正在准备存档，请稍候。',
  geoDenied: '定位权限未开启，请在系统设置中允许定位；未记录的时段保持未知。',
};
function notify(message) {
  const toast = document.getElementById('life-toast');
  if (toast) toast.textContent = message;
  window.__pgLife?.toast?.(message);
  if (!window.__pgLife?.toast) window.alert(message);
}

// 网页预览不触发任何原生权限；只有已安装的 App 启用适配。
if (Capacitor.isNativePlatform()) {
  let exporting = false;
  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (!this.download || !this.href.startsWith('blob:')) return originalClick.call(this);
    if (exporting) { notify(messages.exportBusy); return; }
    exporting = true;
    const url = this.href;
    const filename = this.download.replace(/[\\/:*?"<>|]/g, '-');
    // 原游戏通过临时 Blob 导出；WebView 不支持普通浏览器的下载，改走系统分享。
    void (async () => {
      try {
        const response = await fetch(url);
        const data = await response.text();
        const file = await Filesystem.writeFile({ path: `exports/${filename}`, data, directory: Directory.Cache, encoding: Encoding.UTF8, recursive: true });
        await Share.share({ title: filename, files: [file.uri] });
      } catch {
        notify(messages.exportFailed);
      } finally {
        exporting = false;
      }
    })();
  };

  const watches = new Map();
  let nextWatch = 1;
  function geoError(error) {
    return { code: String(error?.code).includes('0003') ? 1 : 2, message: messages.geoDenied, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
  }
  // 保持游戏原来的 Geolocation 契约，原生插件负责运行时授权。
  const nativeGeo = {
    getCurrentPosition(success, failure, options) {
      void Geolocation.getCurrentPosition(options ?? {}).then(success).catch(error => failure?.(geoError(error)));
    },
    watchPosition(success, failure, options) {
      const id = nextWatch++;
      const pending = Geolocation.watchPosition(options ?? {}, (position, error) => {
        if (!watches.has(id)) return;
        if (error) failure?.(geoError(error)); else if (position) success(position);
      });
      watches.set(id, pending);
      void pending.catch(error => { watches.delete(id); failure?.(geoError(error)); });
      return id;
    },
    clearWatch(id) {
      const pending = watches.get(id);
      watches.delete(id);
      if (pending) void pending.then(nativeId => Geolocation.clearWatch({ id: nativeId })).catch(() => {});
    },
  };
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: nativeGeo });

  function handleBack() {
    const dialog = [...document.querySelectorAll('dialog[open]')].at(-1);
    if (dialog) {
      const close = dialog.querySelector('.close-button');
      if (close) close.click(); else dialog.close();
      return;
    }
    // 扩展面板优先使用原关闭按钮，避免绕过游戏状态清理。
    const closeSelectors = ['#bk-ov.on .bk-x', '#life-ov.on .lf-x', '#grad-ov.on .g-close'];
    for (const selector of closeSelectors) {
      const close = document.querySelector(selector);
      if (close) { close.click(); return; }
    }
    const sheet = document.querySelector('#m-sheet.on');
    if (sheet) {
      if (sheet.dataset.mode === 'world') document.getElementById('world-home')?.click();
      else document.getElementById('m-sheet-close')?.click();
      return;
    }
    if (document.body.dataset.view === 'world') { document.getElementById('world-home')?.click(); return; }
    void App.minimizeApp();
  }
  const listeners = [];
  void App.addListener('backButton', handleBack).then(listener => listeners.push(listener));
  void App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      // 原游戏只在前台采样；不添加后台定位，也不改变授权范围。
      window.__pgLife?.geoStop?.();
    } else if (window.__pgLife?.cfg?.geo) {
      void window.__pgLife.geoStart();
    }
  }).then(listener => listeners.push(listener));
  window.addEventListener('pagehide', () => {
    for (const id of watches.keys()) nativeGeo.clearWatch(id);
    for (const listener of listeners) void listener.remove();
  }, { once: true });
}
