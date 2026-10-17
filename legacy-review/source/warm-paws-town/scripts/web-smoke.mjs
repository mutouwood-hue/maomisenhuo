import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const server = createServer(async (req, res) => {
  try {
    const path = req.url === '/' ? 'index.html' : req.url.slice(1).split('?')[0];
    if (!/^[a-z\d.-]+$/i.test(path)) { res.writeHead(400).end(); return; }
    const data = await readFile(new URL(`www/${path}`, root));
    res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript; charset=utf-8' : path.endsWith('.css') ? 'text/css; charset=utf-8' : path.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8');
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
const checks = [];
page.on('pageerror', error => errors.push(error.message));
await mkdir(new URL('deliverables/', root), { recursive: true });
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.__petGame?.state()?.ready, { timeout: 30000 });
  await page.locator('#room-view canvas').waitFor();
  checks.push('游戏启动，3D canvas 已挂载');
  await page.screenshot({ path: fileURLToPath(new URL('deliverables/android-home-preview.png', root)) });
  console.log('INITIAL', JSON.stringify(await page.evaluate(() => ({ ready: window.__petGame.state().ready, width: innerWidth, controls: [...document.querySelectorAll('#m-rail button,#m-dock button')].map(b => ({ text: b.textContent, v: b.dataset.v, m: b.dataset.m })) }))));
  for (const view of ['shop', 'clinic', 'family', 'journal']) {
    await page.locator(`#m-rail [data-v="${view}"]`).click();
    console.log('VIEW', view, await page.evaluate(() => ({ view: document.body.dataset.view, nav: document.querySelector('.town-nav [aria-current="page"]')?.dataset.view, sheet: document.getElementById('m-sheet').className, mode: document.getElementById('m-sheet').dataset.mode, errors: window.__petGame.state().life })));
    await page.locator('#m-sheet.on').waitFor();
    await page.locator(`#${view}-panel`).waitFor({ state: 'visible' });
    checks.push(`${view} 面板可打开`);
    if (view === 'shop') await page.screenshot({ path: fileURLToPath(new URL('deliverables/android-wardrobe-preview.png', root)) });
    await page.locator('#m-sheet-close').click();
    await page.waitForFunction(() => !document.getElementById('m-sheet').classList.contains('on'));
  }
  await page.locator('#rename-button').click();
  console.log('RENAME', await page.locator('dialog[open]').innerText());
  await page.locator('dialog[open] input').fill('安卓小橘');
  await page.locator('dialog[open] .primary-button').click();
  await page.waitForFunction(() => document.getElementById('pet-name').textContent === '安卓小橘');
  await page.reload();
  await page.waitForFunction(() => window.__petGame?.state()?.ready);
  assert.equal(await page.locator('#pet-name').textContent(), '安卓小橘');
  checks.push('改名与刷新后存档恢复');
  await page.locator('#m-dock [data-m="more"]').click();
  await page.locator('#m-sheet[data-mode="care"].on').waitFor();
  assert.equal(await page.locator('#m-sheet .care-action').count(), 8);
  checks.push('完整 8 项照料入口保留');
  await page.locator('#m-sheet-close').click();
  await page.locator('#m-dock [data-m="drink"]').click();
  await page.waitForFunction(() => window.__petGame.state().room.targets.some(t => t.id === 'water-bowl'));
  for (let sip = 0; sip < 3; sip++) {
    await page.waitForFunction(() => window.__petGame.state().room.targets.some(t => t.id === 'water-bowl') || window.__petGame.state().pet.counts.drink > 0);
    if (await page.evaluate(() => window.__petGame.state().pet.counts.drink > 0)) break;
    const target = await page.evaluate(() => window.__petGame.state().room.targets.find(t => t.id === 'water-bowl'));
    const bounds = await page.locator('#room-view canvas').boundingBox();
    await page.mouse.click(bounds.x + target.x * bounds.width, bounds.y + target.y * bounds.height);
    await page.waitForFunction(sip => window.__petGame.state().room.interaction?.hits > sip || window.__petGame.state().pet.counts.drink > 0, sip);
  }
  await page.waitForFunction(() => window.__petGame.state().pet.counts.drink > 0);
  checks.push('喝水动画完成，照料计数实际增长');
  await page.locator('#m-dock [data-m="more"]').click();
  await page.locator('#m-sheet .care-action[data-action="play"]').click();
  await page.locator('#game-dialog[open]').waitFor();
  await page.locator('#start-mini').click();
  await page.waitForFunction(() => window.__petGame.state().mini.running);
  checks.push('接鱼小游戏实际启动');
  await page.locator('#game-dialog .close-button').click();
  await page.locator('#m-rail [data-v="world"]').click();
  await page.locator('#world-scene').waitFor({ state: 'visible' });
  await page.locator('#world-view canvas').waitFor();
  checks.push('户外 3D 场景可打开');
  await page.screenshot({ path: fileURLToPath(new URL('deliverables/android-world-preview.png', root)) });
  await page.locator('#m-sheet-close').click();
  await page.locator('#m-sheet.m-collapsed').waitFor();
  await page.locator('#m-world-home').click();
  await page.waitForFunction(() => document.body.dataset.view === 'home');
  await page.locator('#room-view canvas').waitFor({ state: 'visible' });
  checks.push('户外抽屉收起后常驻入口可返回房间');
  await page.locator('#m-rail [data-v="world"]').click();
  await page.locator('#world-scene').waitFor({ state: 'visible' });
  await page.locator('#m-world-home').click();
  await page.waitForFunction(() => document.body.dataset.view === 'home');
  checks.push('再次出门并在抽屉展开时返回房间');
  await page.evaluate(() => window.__pgLife.open('today'));
  await page.locator('#life-ov.on').waitFor();
  checks.push('今日生活面板可打开');
  await page.locator('#life-ov .lf-x').click();
  await page.evaluate(() => window.__pgBlocks.open());
  await page.locator('#bk-ov.on').waitFor();
  checks.push('AI 积木工坊可打开（不发出付费 API 请求）');
  assert.deepEqual(errors, []);
  const report = { checks, errors, scope: '桌面 Chromium 手机尺寸网页回归；不是安卓真机验证', viewport: { width: 393, height: 852 } };
  await writeFile(new URL('deliverables/web-smoke-report.json', root), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
