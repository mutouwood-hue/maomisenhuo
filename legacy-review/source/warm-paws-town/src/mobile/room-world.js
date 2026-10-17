/* 移动端原生 JS 适配；保留原游戏节点、监听器和业务状态，不修改只读快照。 */
(() => {
  const homeScene = document.getElementById('home-scene');
  const worldHome = document.getElementById('world-home');
  if (!homeScene || !worldHome || document.getElementById('m-room-info')) return;

  const mobileQuery = matchMedia('(max-width:600px)');
  const compactLandscapeQuery = matchMedia('(max-width:900px) and (max-height:600px)');
  const info = document.createElement('div');
  info.id = 'm-room-info';
  info.setAttribute('aria-label', '小猫动态与生活提示');
  homeScene.appendChild(info);

  const messages = {
    returnHome: '回房间',
    returnHomeLabel: '带小猫回到房间',
  };
  const returnButton = document.createElement('button');
  returnButton.id = 'm-world-home';
  returnButton.type = 'button';
  returnButton.className = 'life-button';
  returnButton.textContent = messages.returnHome;
  returnButton.setAttribute('aria-label', messages.returnHomeLabel);
  returnButton.hidden = true;
  // 独立于户外抽屉：收起、准备出门或加载失败时仍能回家。
  document.body.appendChild(returnButton);
  function handleReturnHome() {
    // 原按钮负责中断出行/视图切换；不在适配层直接改存档或结算。
    worldHome.click();
  }
  returnButton.addEventListener('click', handleReturnHome);

  const moved = ['pg-sync', 'message', 'action-status', 'ambient-status']
    .map(id => document.getElementById(id))
    .filter(Boolean)
    .map(element => ({ element, parent: element.parentNode, next: element.nextSibling }));
  let isMobile = false;

  const desktopStatus = document.createElement('div');
  desktopStatus.id = 'm-room-status';
  homeScene.appendChild(desktopStatus);

  function syncReturnButton() {
    const hasCompactControls = mobileQuery.matches || compactLandscapeQuery.matches;
    returnButton.hidden = !hasCompactControls || document.body.dataset.view !== 'world';
  }

  function handleLayoutChange() {
    // 先按原顺序恢复，再根据尺寸分配；横竖屏反复切换不复制原信息节点。
    [...moved].reverse().forEach(({ element, parent, next }) => {
      parent.insertBefore(element, next?.parentNode === parent ? next : null);
    });
    isMobile = mobileQuery.matches;
    if (isMobile) {
      moved.forEach(({ element }) => info.appendChild(element));
    } else {
      moved.filter(({ element }) => element.id !== 'message')
        .forEach(({ element }) => desktopStatus.appendChild(element));
    }
    info.hidden = !isMobile;
    desktopStatus.hidden = isMobile;
    syncReturnButton();
  }

  const viewObserver = new MutationObserver(syncReturnButton);
  viewObserver.observe(document.body, { attributes: true, attributeFilter: ['data-view'] });
  mobileQuery.addEventListener('change', handleLayoutChange);
  compactLandscapeQuery.addEventListener('change', syncReturnButton);
  handleLayoutChange();

  // BFCache 返回仍保留监听；仅真正销毁页面时解除适配层副作用。
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    viewObserver.disconnect();
    mobileQuery.removeEventListener('change', handleLayoutChange);
    compactLandscapeQuery.removeEventListener('change', syncReturnButton);
    returnButton.removeEventListener('click', handleReturnHome);
  }, { once: true });
})();
