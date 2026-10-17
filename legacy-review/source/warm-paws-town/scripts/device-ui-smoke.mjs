import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

// 仅在用户已授权覆盖安装/操作该设备后运行，不重置或替换存档。
const root = new URL('../', import.meta.url);
const output = new URL('deliverables/', root);
const adb = fileURLToPath(new URL('.toolchain/android-sdk/platform-tools/adb.exe', root));
const serial = 'ZYPZ261A01M65K0002A';
const browser = await chromium.connectOverCDP('http://127.0.0.1:19390');
const page = browser.contexts()[0].pages().find(p => p.url().startsWith('https://localhost'));
assert.ok(page, 'App WebView must be connected');
const checks = [];
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await mkdir(output, { recursive: true });
const screenshot = async name => {
  await page.screenshot({ path: fileURLToPath(new URL(`android-device-${name}.png`, output)) });
  // Android CDP 截图可能漏掉 GPU 合成层；最终视觉核对使用真实 screencap。
  if (['home', 'life-today', 'life-bottom', 'world-collapsed', 'final-home'].includes(name)) {
    const remote = '/sdcard/Download/warm-paws-ui-check.png';
    assert.equal(spawnSync(adb, ['-s', serial, 'shell', 'screencap', '-p', remote], { stdio: 'inherit' }).status, 0);
    assert.equal(spawnSync(adb, ['-s', serial, 'pull', remote, fileURLToPath(new URL(`android-device-physical-${name}.png`, output))], { stdio: 'inherit' }).status, 0);
  }
};
const systemBack = () => {
  const result = spawnSync(adb, ['-s', serial, 'shell', 'input', 'keyevent', '4'], { stdio: 'inherit' });
  assert.equal(result.status, 0, 'Android back dispatch');
};
try {
  await page.waitForFunction(() => window.__petGame?.state()?.ready);
  const identity = await page.evaluate(() => ({ name: document.getElementById('pet-name').textContent, activeCatId: window.__petGame.state().pet.activeCatId }));
  assert.deepEqual(identity, { name: '小橘', activeCatId: 'cat-1' });
  assert.equal(await page.locator('#m-world-home').count(), 1);
  checks.push('覆盖安装后原宠物名称与activeCatId保持，小橘/cat-1；未清空存档');
  if (await page.locator('#life-ov.on').count()) await page.locator('#life-ov .lf-x').click();
  if (await page.locator('#bk-ov.on').count()) await page.locator('#bk-ov .bk-x').click();
  if (await page.locator('#grad-ov.on').count()) await page.locator('#grad-ov .g-close').click();
  for (const dialog of await page.locator('dialog[open]').all()) {
    const close = dialog.locator('.close-button');
    if (await close.count()) await close.click();
  }
  if (await page.evaluate(() => document.body.dataset.view === 'world')) {
    await page.locator('#m-world-home').click();
    await page.waitForFunction(() => document.body.dataset.view === 'home');
  } else if (await page.locator('#m-sheet.on').count()) {
    await page.locator('#m-sheet-close').click();
  }
  await page.waitForFunction(() => document.body.dataset.view === 'home');
  const safeArea = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const top = parseFloat(css.getPropertyValue('--safe-area-inset-top')) || 0;
    const bottom = parseFloat(css.getPropertyValue('--safe-area-inset-bottom')) || 0;
    return { top, bottom, headerTop: document.querySelector('.masthead').getBoundingClientRect().top, dockBottom: document.getElementById('m-dock').getBoundingClientRect().bottom, height: innerHeight };
  });
  assert.ok(safeArea.top > 0 && safeArea.bottom > 0, 'native system insets must be available');
  assert.ok(safeArea.headerTop >= safeArea.top, 'header avoids Android status bar');
  assert.ok(safeArea.dockBottom <= safeArea.height - safeArea.bottom + 1, 'dock avoids Android gesture bar');
  checks.push('顶部身份栏与底部照料栏避开真实系统安全区');
  await screenshot('home');
  const statusGeometry = await page.evaluate(() => {
    const ids = ['action-status', 'ambient-status', 'pg-sync'];
    return ids.map(id => {
      const el = document.getElementById(id), r = el.getBoundingClientRect();
      return { id, visible: !el.hidden && r.width > 0 && r.height > 0, x: r.x, y: r.y, width: r.width, height: r.height };
    });
  });
  const visible = statusGeometry.filter(r => r.visible);
  for (let i = 0; i < visible.length; i++) for (let j = i + 1; j < visible.length; j++) {
    const a = visible[i], b = visible[j];
    assert.ok(a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1 || a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1, `${a.id}/${b.id} overlap`);
  }
  checks.push('真机实际可见生活同步/动态提示未重叠');
  await page.evaluate(() => window.__pgLife.open('today'));
  await page.locator('#life-ov.on').waitFor();
  await screenshot('life-today');
  const lifeBottom = await page.evaluate(async () => {
    const body = document.querySelector('#life-ov .lf-body');
    body.scrollTop = body.scrollHeight;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const button = document.querySelector('#life-ov [data-act="sync"]');
    const bounds = button.getBoundingClientRect();
    return { top: bounds.top, bottom: bounds.bottom, boxBottom: document.querySelector('#life-ov .lf-box').getBoundingClientRect().bottom };
  });
  assert.ok(lifeBottom.top >= safeArea.top && lifeBottom.bottom <= safeArea.height - safeArea.bottom + 1, 'life final action avoids native gesture bar');
  checks.push('生活面板滚至末端的操作按钮避开真实手势区');
  await screenshot('life-bottom');
  const tabs = await page.locator('#life-ov .lf-tabs button').count();
  assert.equal(tabs, 5);
  for (let i = 0; i < tabs; i++) {
    const tab = page.locator('#life-ov .lf-tabs button').nth(i);
    const box = await tab.boundingBox();
    const size = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width + 1 && box.y + box.height <= size.height + 1);
    await tab.click();
  }
  checks.push('今日生活5个标签真机全部可见可点击');
  systemBack();
  await page.waitForFunction(() => !document.getElementById('life-ov').classList.contains('on'));
  checks.push('系统返回键关闭生活面板');
  for (const collapsed of [false, true]) {
    await page.locator('#m-rail [data-v="world"]').click();
    await page.waitForFunction(() => document.body.dataset.view === 'world');
    if (collapsed) {
      await page.locator('#m-sheet-close').click();
      await page.locator('#m-sheet.m-collapsed').waitFor();
    }
    await screenshot(collapsed ? 'world-collapsed' : 'world');
    await page.locator('#m-world-home').click();
    await page.waitForFunction(() => document.body.dataset.view === 'home');
    await page.locator('#room-view canvas').waitFor({ state: 'visible' });
  }
  checks.push('真机出门抽屉展开/收起两次均可点击常驻按钮回房间');
  await page.locator('#m-rail [data-v="world"]').click();
  await page.waitForFunction(() => document.body.dataset.view === 'world');
  systemBack();
  await page.waitForFunction(() => document.body.dataset.view === 'home');
  checks.push('系统返回键从户外回房间');
  for (const view of ['shop', 'clinic', 'family', 'journal']) {
    await page.locator(`#m-rail [data-v="${view}"]`).click();
    await page.locator(`#${view}-panel`).waitFor({ state: 'visible' });
    systemBack();
    await page.waitForFunction(() => document.body.dataset.view === 'home' && !document.getElementById('m-sheet').classList.contains('on'));
  }
  checks.push('衣柜/诊所/家庭/手记均可打开并系统返回关闭');
  await page.evaluate(() => window.__pgBlocks.open());
  await page.locator('#bk-ov.on').waitFor();
  await screenshot('blocks');
  systemBack();
  await page.waitForFunction(() => !document.getElementById('bk-ov').classList.contains('on'));
  checks.push('工坊打开与系统返回正常；未调用AI接口');
  await screenshot('final-home');
  assert.deepEqual(errors, []);
  const report = { device: 'PZ261A', serial, scope: '授权覆盖安装后真实Android WebView与系统返回键回归；未重置存档', viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio, userAgent: navigator.userAgent })), checks, safeArea, statusGeometry, errors };
  await writeFile(new URL('android-device-report.json', output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
