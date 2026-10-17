/* 仅适配 DOM 中的时间环，不修改生活数据、环弧或原始游戏脚本。 */
const lifePanel = document.getElementById('life-ov');
if (lifePanel) {
  let frame = 0;
  function fitRingLabels() {
    frame = 0;
    if (!lifePanel.classList.contains('on')) return;
    for (const label of lifePanel.querySelectorAll('.lf-ring .lf-cs, .lf-ring .lf-cs2')) {
      // 中心左右的 6/18 小时刻度在原 SVG 的 x=60/200，给文字留出内侧空隙。
      // 下方现在卡片保留完整信息；环中央使用省略显示，不能挤扁字形。
      const fullText = label.dataset.fullText ?? label.textContent;
      label.dataset.fullText = fullText;
      label.setAttribute('aria-label', fullText);
      label.removeAttribute('textLength');
      label.removeAttribute('lengthAdjust');
      label.textContent = fullText;
      const available = 112;
      const characters = Array.from(fullText);
      while (label.getComputedTextLength() > available && characters.length > 1) {
        characters.pop();
        label.textContent = `${characters.join('')}…`;
      }
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = fullText;
      label.appendChild(title);
    }
  }
  function scheduleRingFit() {
    if (!frame) frame = requestAnimationFrame(fitRingLabels);
  }
  // 今日页和回放都会替换整段 SVG；忽略本适配层的文本写回，避免自触发。
  const contentObserver = new MutationObserver(records => {
    const changedOutsideLabels = records.some(record => {
      const element = record.target instanceof Element ? record.target : record.target.parentElement;
      return !element?.closest('.lf-cs, .lf-cs2');
    });
    if (changedOutsideLabels) scheduleRingFit();
  });
  const body = lifePanel.querySelector('.lf-body');
  if (body) contentObserver.observe(body, { childList: true, subtree: true, characterData: true });
  const visibilityObserver = new MutationObserver(scheduleRingFit);
  visibilityObserver.observe(lifePanel, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', scheduleRingFit);
  void document.fonts?.ready.then(scheduleRingFit);
  scheduleRingFit();
  window.addEventListener('pagehide', () => {
    contentObserver.disconnect();
    visibilityObserver.disconnect();
    window.removeEventListener('resize', scheduleRingFit);
    if (frame) cancelAnimationFrame(frame);
  }, { once: true });
}
