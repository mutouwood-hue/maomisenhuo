/* Thin host adaptation. Original game/social stores remain the only gameplay writers. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let foreground = true, roomActive = null, ports = null, unsubscribe = null, deviceBusy=false, foregroundEpoch=0;
  const notice = text => window.__pgLife?.toast?.(text);
  const slot = document.createElement('div');
  slot.id = 'offline-notifications';
  slot.setAttribute('aria-label', '小猫提示');
  document.body.append(slot);
  const dialog = document.createElement('dialog');
  dialog.id = 'offline-device';
  dialog.setAttribute('aria-labelledby', 'offline-device-title');
  dialog.innerHTML = `<div class="offline-device-inner"><header class="lf-head"><b id="offline-device-title">我的吧唧</b><button type="button" class="lf-x" data-device-close aria-label="关闭吧唧">×</button></header><div class="offline-device-body"><canvas id="offline-device-cat" width="104" height="112" aria-label="我的小猫"></canvas><h3>让小猫住进吧唧</h3><p id="offline-device-status" role="status" aria-live="polite"></p><p id="offline-device-note"></p><div id="offline-device-list"></div><button type="button" class="g-btn" id="offline-device-primary">寻找吧唧</button><button type="button" class="g-btn" id="offline-device-start" hidden>在吧唧上开始陪伴</button><button type="button" class="g-btn ghost" id="offline-device-disconnect" hidden>断开连接</button><p class="lf-note">照料、家庭与图鉴保存在这台手机。连接就绪不代表宠物已同步或好友已确认。</p></div></div>`;
  document.body.append(dialog);
  dialog.querySelector('[data-device-close]').addEventListener('click', () => dialog.close());
  let lastFocus = null;
  function openDevice() {
    lastFocus = document.activeElement;
    if(window.__pgLife?.open){window.__pgLife.open('badge');reconcile();}
    else notice('吧唧页面正在准备，请稍后再打开。');
  }
  dialog.addEventListener('close', () => { lastFocus?.focus?.(); reconcile(); });
  const railButton = document.createElement('button');
  railButton.type = 'button';
  railButton.innerHTML = '<span aria-hidden="true">▣</span>吧唧';
  railButton.addEventListener('click', openDevice);
  $('m-rail')?.append(railButton);
  const desktopButton = document.createElement('button');
  desktopButton.type = 'button'; desktopButton.className = 'pg-navsocial';
  desktopButton.innerHTML = '<span aria-hidden="true">▣</span>吧唧';
  desktopButton.addEventListener('click', openDevice);
  document.querySelector('.town-nav')?.append(desktopButton);

  function validatedLink() {
    const current=window.CatOfflineSceneSync?.state;
    if(current)return current;
    if (!ports) return null;
    const state = ports.control.getState();
    if (state?.stage === 'ready_local') {
      const e = state.evidence;
      if (!e || e.source !== 'native' || !e.serviceVerified || !e.rxVerified || !e.txVerified || !e.subscribed ||
          state.hello?.version !== 1 || state.hello?.capabilities !== 15 || state.capabilities?.legacyControl !== 'verified' || !state.device) {
        return { stage: 'error', error: { message: '设备确认资料不完整，尚不能视为连接就绪。' } };
      }
    }
    return state;
  }
  const friendlyDeviceError=error=>/App left foreground|foreground-only|activity.*foreground|app.*background/i.test(error?.message||error||'')?'应用已暂停连接，请重新明确连接。':error?.message||String(error||'');
  const labels = { disconnected: '吧唧尚未连接', permission_required: '需要蓝牙权限才能寻找吧唧', bluetooth_off: '请先开启手机蓝牙', scanning: '正在寻找附近的吧唧…', selecting: '选一只你身边的吧唧', connecting: '正在连接吧唧…', discovering: '正在确认吧唧的连接能力…', subscribing: '正在准备接收吧唧消息…', handshaking: '正在与吧唧打招呼…', ready_local: '已连接吧唧 · 本地控制就绪' };
  function renderDevice() {
    const state = validatedLink();
    $('offline-device-status').textContent = state ? labels[state.stage] || friendlyDeviceError(state.error) || '连接暂未确认' : '吧唧连接尚在联调';
    const battery=state?.device?.battery;
    const batteryText=Number.isInteger(battery)&&battery>=0&&battery<=100?`吧唧电量 ${battery}%。` : '';
    $('offline-device-note').textContent = state?.stage === 'ready_local' ? batteryText+'宠物同步与真实双机遇见尚未开放；当前不会向吧唧结算照料或好友奖励。' : ports ? '请让吧唧靠近手机。此处只显示实际扫描和握手结果；相同蓝牙服务也可能使用不同协议，握手失败不会进入本地控制。' : '当前可体验完整本地游戏与 NPC 试玩。真实蓝牙适配器尚未接入，本候选不会模拟已连接或自动连接设备。';
    const button = $('offline-device-primary');
    button.disabled = deviceBusy || !ports || ['scanning', 'connecting', 'discovering', 'subscribing', 'handshaking', 'ready_local'].includes(state?.stage);
    button.hidden=state?.stage==='ready_local';
    $('offline-device-start').hidden=state?.stage!=='ready_local';
    $('offline-device-start').disabled=deviceBusy;
    button.textContent = !ports ? '连接测试待接入' : state?.stage === 'permission_required' ? '允许寻找吧唧' : state?.stage === 'ready_local' ? '已连接' : '寻找吧唧';
    $('offline-device-disconnect').hidden = !ports || !['ready_local', 'connecting', 'discovering', 'subscribing', 'handshaking'].includes(state?.stage);
    const list = $('offline-device-list'); list.replaceChildren();
    for (const device of state?.stage === 'selecting' ? state.devices : []) {
      if (device.source !== 'native_scan') continue;
      const row = document.createElement('button'); row.type = 'button'; row.className = 'g-btn ghost';
      row.disabled=deviceBusy;
      row.textContent = device.name || '附近的吧唧';
      row.addEventListener('click', () => runDevice(() => ports.control.connect(device, { origin: 'explicit_user_action' })));
      list.append(row);
    }
    window.CatOfflineSceneSync?.render();
  }
  async function runDevice(action, successMessage) {
    if(deviceBusy)return;
    const operationEpoch=foregroundEpoch;deviceBusy=true;renderDevice();
    let failure=null;
    try { await action(); } catch (error) { failure=friendlyDeviceError(error) || '操作未确认，请重试。'; }
    deviceBusy=false;
    renderDevice();
    if(foreground&&operationEpoch===foregroundEpoch){if(failure)$('offline-device-status').textContent=failure;else if(successMessage)$('offline-device-status').textContent=successMessage;}
  }
  $('offline-device-primary').addEventListener('click', () => {
    if (!ports) return;
    void runDevice(async () => {
      await window.CatOfflineSceneSync?.selectLegacy();
      const permission = await ports.control.requestPermissions({ origin: 'explicit_user_action' });
      if (permission.granted) await ports.control.scan({ origin: 'explicit_user_action', durationMs: 8000 });
    });
  });
  $('offline-device-disconnect').addEventListener('click', () => { if (ports) void runDevice(() => ports.control.disconnect()); });
  $('offline-device-start').addEventListener('click',()=>{
    const state=validatedLink();
    if(state?.stage!=='ready_local')return;
    void runDevice(async()=>{
      await ports.control.startLocal({requestId:crypto.randomUUID(),generation:state.evidence.generation,origin:'explicit_user_action'});
      await ports.control.readDeviceState();
    },'吧唧已接收陪伴请求。请查看设备画面；这不代表手机宠物已同步。');
  });

  function attachPorts(value) {
    if (!value?.control || value.control.protocolFamily !== 'legacy-e7f1-bj20') throw new Error('设备协议未确认，不接入其他协议。');
    if (ports) throw new Error('设备适配器已接入，不能在活动页面替换。');
    ports = value;
    unsubscribe = ports.control.subscribe(renderDevice);
    // initialize installs listeners only; contract forbids auto scan/connect/START_LOCAL.
    void ports.control.initialize().then(renderDevice).catch(error => notice(friendlyDeviceError(error)));
    renderDevice();
  }
  function panelOpen() {
    return Boolean(document.querySelector('dialog[open],#m-sheet.on,#sc-hub.on,#sc-meet.on,#life-ov.on,#bk-ov.on,#grad-ov.on,#pg-away.on'));
  }
  function reconcile() {
    for (const id of ['sc-banner', 'pg-toast', 'pg-envchip', 'message', 'action-status', 'ambient-status', 'pg-sync']) {
      const node = $(id); if (node && node.parentNode !== slot) slot.append(node);
    }
    const blocked = !foreground || document.hidden || panelOpen() || document.body.dataset.view === 'world' || document.body.dataset.townExperience === 'open';
    const state = window.__petGame?.state();
    const banner=$('sc-banner');
    if(banner && !banner.querySelector('.offline-test-mode')) {
      const mode=document.createElement('small');mode.className='offline-test-mode';
      const peer=window.__pgSocial?.peers?.get(banner.dataset.fid);
      mode.textContent=peer?.src==='npc'?'本地试玩 · 官方 NPC':'本地试玩 · 原型消息，未验证真实吧唧';
      banner.querySelector('div')?.append(mode);
    }
    const meetSubtitle=$('sc-msub');
    if(meetSubtitle && !meetSubtitle.textContent.startsWith('本地试玩 · ')) meetSubtitle.textContent='本地试玩 · '+meetSubtitle.textContent;
    const aiOnly=$('offline-ai-dialog')?.open&&!document.querySelector('dialog[open]:not(#offline-ai-dialog),#m-sheet.on,#life-ov.on,#sc-hub.on,#sc-meet.on');
    const desired = !blocked||(foreground&&!document.hidden&&aiOnly&&document.body.dataset.townExperience!=='open');
    if (state?.ready && roomActive !== desired) {
      roomActive = desired;
      window.__petGame.setRoomActive(desired);
    }
    document.body.classList.toggle('offline-obscured', blocked);
    const priority = state?.busy ? ['action-status'] : ['sc-banner', 'pg-toast', 'pg-envchip', 'pg-sync', 'message', 'ambient-status'];
    const candidate = blocked ? null : priority.map($).find(node => {
      if (!node || node.hidden || !node.textContent.trim()) return false;
      if (node.id === 'pg-toast') return node.classList.contains('on');
      if (node.id === 'message') return !node.classList.contains('m-faded');
      return true;
    });
    for (const node of slot.children) {
      const selected = node === candidate;
      if (node.hasAttribute('data-offline-selected') !== selected) node.toggleAttribute('data-offline-selected', selected);
    }
    const hub = $('sc-hbody');
    if (hub && !$('offline-social-note')) {
      const tip = document.createElement('p'); tip.id = 'offline-social-note'; tip.className = 'lf-note';
      tip.textContent = '真实相遇在两台吧唧完成敲暗号或连点暗号，并由双方确认保存；连接「我的吧唧」后自动补传好友、印章和世界成长。游戏角色互动另列，不代表附近真实设备。缘分擦肩保持独立、关闭；当面晃一晃未开放，扫码已取消。';
      hub.prepend(tip);
    }
  }
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; reconcile(); });
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden', 'data-view'] });

  function handleBack() {
    if(window.CatTownExperience?.handleBack())return true;
    const meet = $('sc-meet');
    if (meet?.classList.contains('on')) { window.__pgSocial?.closeMeet(); return true; }
    const openDialog = [...document.querySelectorAll('dialog[open]')].at(-1);
    if (openDialog) { openDialog.close(); return true; }
    for (const selector of ['#sc-hub.on [data-hclose]', '#bk-ov.on .bk-x', '#life-ov.on .lf-x', '#grad-ov.on .g-close', '#pg-away.on [data-awayclose]']) {
      const button = document.querySelector(selector); if (button) { button.click(); return true; }
    }
    if ($('m-sheet')?.classList.contains('on')) {
      if ($('m-sheet').dataset.mode === 'world') $('world-home')?.click(); else $('m-sheet-close')?.click();
      return true;
    }
    if (window.__petGame?.state()?.busy) { window.__petGame.hostSuspend(); window.__petGame.hostResume(); reconcile(); return true; }
    if (document.body.dataset.view === 'world') { $('world-home')?.click(); return true; }
    return false;
  }
  function suspend() {
    if (!foreground) return;
    foreground = false;foregroundEpoch++;
    window.CatTownExperience?.suspend();
    window.CatOfflineSceneSync?.setForeground(false);
    window.CatOfflineMedia?.suspend();
    window.__pgLife?.hostStopCapture?.();
    window.__petGame?.hostSuspend();
    window.__pgSocial?.closeMeet();
    window.__pgLife?.geoStop?.();
    window.__pgLife?.env?.stop?.();
    reconcile();
    // Do not leave camera/microphone streams live in hidden custom overlays.
    for (const video of document.querySelectorAll('video')) {
      video.srcObject?.getTracks?.().forEach(track => track.stop()); video.srcObject = null;
    }
  }
  function resume() {
    if (foreground) return;
    foreground = true;foregroundEpoch++;window.CatTownExperience?.resume();window.__petGame?.hostResume();renderDevice();
    window.CatOfflineSceneSync?.setForeground(true);
    window.CatOfflineMedia?.resume();
    if (window.__pgLife?.cfg?.geo) void window.__pgLife.geoStart();
    roomActive = null; reconcile();
  }
  window.CatOfflineHost = { handleBack, suspend, resume, openDevice, attachPorts, get deviceBusy(){return deviceBusy;}, get deviceState() { return validatedLink(); } };
  document.addEventListener('visibilitychange', () => document.hidden ? suspend() : resume());
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && dialog.open) dialog.close(); });

  // Preserve the game's Blob export; use Android's document picker without broad storage permissions.
  if (window.CatOfflineNative?.exportSave) {
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (!this.download || !this.href.startsWith('blob:')) return originalClick.call(this);
      const filename = this.download;
      void fetch(this.href).then(response => response.text()).then(data => window.CatOfflineNative.exportSave(filename, data)).catch(() => notice('导出未完成，原存档仍保留在本机。'));
    };
  }
  // Native popup hosts use the same HTML origin and slot-scoped localStorage, preserving original two-player testing.
  if (window.CatOfflineNative?.openPlayer) {
    window.open = url => {
      const target = new URL(url, location.href);
      if (target.origin === location.origin && target.pathname === location.pathname) window.CatOfflineNative.openPlayer(target.searchParams.get('slot') === 'B' ? 'B' : 'A');
      return null;
    };
  }
  window.addEventListener('pagehide', event => { if (!event.persisted) { observer.disconnect(); unsubscribe?.(); void ports?.control.dispose(); } });
  renderDevice(); reconcile();
})();
