import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const phase = process.argv.find(arg => arg.startsWith('--phase='))?.slice(8) || 'baseline';
if (!/^[a-z\d-]+$/i.test(phase)) throw new Error('Invalid audit phase');
const quick = process.argv.includes('--quick');
const requestedViewport=process.argv.find(arg=>arg.startsWith('--viewport='))?.slice(11);
const viewports = requestedViewport ? [{width:Number(requestedViewport.split('x')[0]),height:Number(requestedViewport.split('x')[1])}] : quick ? [{ width: 393, height: 852 }] : [
  ...(process.argv.includes('--include-narrow') ? [{width:320,height:640}] : []),
  { width: 360, height: 640 }, { width: 393, height: 852 },
  { width: 412, height: 915 }, { width: 852, height: 393 },
  { width: 1440, height: 1000 },
];
// 每次运行固定网页快照，避免 Lead 同时构建时混用两个版本。
const assets = new Map(await Promise.all((await readdir(new URL('www/', root)))
  .filter(name => /^[a-z\d.-]+$/i.test(name))
  .map(async name => [name, await readFile(new URL(`www/${name}`, root))])));
const server = createServer((req, res) => {
  const name = req.url === '/' ? 'index.html' : req.url.slice(1).split('?')[0];
  const data = assets.get(name);
  if (!data) { res.writeHead(404).end(); return; }
  const mime = name.endsWith('.css') ? 'text/css' : name.endsWith('.js') ? 'text/javascript' : name.endsWith('.json') ? 'application/json' : 'text/html';
  res.setHeader('Content-Type', `${mime}; charset=utf-8`); res.end(data);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
await mkdir(new URL('deliverables/', root), { recursive: true });
const report = {
  phase, timestamp: new Date().toISOString(),
  simulatedSafeArea: process.argv.includes('--safe-area') ? {top:38,bottom:24,left:0,right:0} : null,
  scope: '桌面 Chromium 手机/横屏/桌面尺寸网页回归，非安卓真机；原生 JavaScript/CSS + Capacitor，前端规范 §1 按原生映射、§2 不适用。',
  styleEntry: '原 game.html 内联 style 与 :root 色彩真源；构建追加适配样式，不引入 CDS。',
  assetManifest: JSON.parse(assets.get('build-manifest.json').toString()),
  assetHashes: Object.fromEntries([...assets].filter(([name])=>/mobile|room-world|life-panel|index\.html/.test(name)).map(([name,data])=>[name,createHash('sha256').update(data).digest('hex')])),
  limitations: ['非安卓真机；真机由 Lead 独立回归', '未测试付费 AI 请求、真实定位/麦克风授权流程及权限拒绝', '未覆盖 BFCache、进程被杀、后台恢复与长期存档兼容性', '毕业仅测试强制准备后的首屏打开/关闭，不执行不可逆毕业', '触控滚动为 Chromium CDP 合成触摸事件，非真实硬件手势'],
  checks: [], findings: [], screenshots: [], errors: [],
};
function finding(viewport, stage, code, details) { report.findings.push({ viewport, stage, code, ...details }); }
async function geometry(page, selectors) {
  return page.evaluate(selectors => selectors.flatMap(selector => [...document.querySelectorAll(selector)].map((el, index) => {
    const r = el.getBoundingClientRect(), css = getComputedStyle(el);
    const visible = r.width > 0 && r.height > 0 && css.display !== 'none' && css.visibility !== 'hidden' && Number(css.opacity) > 0;
    const centerX = Math.min(innerWidth - 1, Math.max(0, r.x + r.width / 2));
    const centerY = Math.min(innerHeight - 1, Math.max(0, r.y + r.height / 2));
    const hit = document.elementFromPoint(centerX, centerY);
    return { selector, index, text: el.textContent?.trim().slice(0, 90), visible,
      rect: { x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom },
      overflow: el.scrollWidth > el.clientWidth + 2,
      hit: visible && !!hit && (hit === el || el.contains(hit)),
      offscreen: visible && (r.x < -1 || r.right > innerWidth + 1 || r.y < -1 || r.bottom > innerHeight + 1),
    };
  })), selectors);
}
function overlap(a, b) {
  return a.visible && b.visible && Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.x, b.rect.x) > 2
    && Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.y, b.rect.y) > 2;
}
async function screenshot(page, viewport, stage) {
  const name = `ui-audit-${phase}-${viewport.width}x${viewport.height}-${stage}.png`;
  await page.screenshot({ path: fileURLToPath(new URL(`deliverables/${name}`, root)), animations: 'disabled' });
  report.screenshots.push(name);
}
async function panelBounds(page, viewport, stage, selectors) {
  const items = await geometry(page, selectors);
  for (const item of items) {
    if (item.visible && (item.rect.x < -1 || item.rect.right > viewport.width + 1))
      finding(viewport, stage, 'horizontal-outside-viewport', { selector: item.selector, text:item.text, rect:item.rect });
  }
    const stageCloseSelectors = stage==='blocks-overlay' ? ['#bk-ov .bk-x'] : stage==='graduation-overlay' ? ['#grad-ov .g-close'] : [];
    if(viewport.width<=600&&process.argv.includes('--safe-area')&&stageCloseSelectors.length){
      for(const control of await geometry(page,stageCloseSelectors))if(control.visible&&control.rect.y<38)finding(viewport,'safe-area','overlay-close-enters-status-bar',{selector:control.selector,rect:control.rect});
    }
    if(viewport.width<=600&&process.argv.includes('--safe-area')){
      const scrollSelector=stage==='blocks-overlay' ? '#bk-ov .bk-box' : stage==='graduation-overlay' ? '#grad-ov .g-box' : null;
      if(scrollSelector){
        const scroller=page.locator(scrollSelector);const previous=await scroller.evaluate(el=>el.scrollTop);
        await scroller.evaluate(el=>{el.scrollTop=el.scrollHeight;});
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        for(const control of await geometry(page,[`${scrollSelector} button`]))if(control.visible&&control.rect.y<viewport.height&&control.rect.bottom>viewport.height-24+1)finding(viewport,'safe-area',`${stage}-control-enters-gesture-bar`,{selector:control.selector,text:control.text,rect:control.rect});
        await scroller.evaluate((el,top)=>{el.scrollTop=top;},previous);
      }
    }
  return items;
}
try {
  for (const viewport of viewports) {
    const mobile = viewport.width <= 600;
    const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
    if(process.argv.includes('--safe-area'))await context.addInitScript(()=>{
      const apply=()=>{document.documentElement.style.setProperty('--safe-area-inset-top','38px');document.documentElement.style.setProperty('--safe-area-inset-bottom','24px');};
      if(document.documentElement)apply();else document.addEventListener('DOMContentLoaded',apply,{once:true});
    });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push({ viewport, message:error.message }));
    page.setDefaultTimeout(7000);
    async function check(stage, fn) {
      try { await fn(); report.checks.push({ viewport, stage, ok:true }); }
      catch (error) { finding(viewport, stage, 'interaction-failed', { message: error.message.split('\n').slice(0, 7).join('\n') }); }
    }
    await check('startup', async () => {
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.waitForFunction(() => window.__petGame?.state()?.ready, { timeout:30000 });
      if(mobile&&process.argv.includes('--safe-area')){
        const safeControls=await geometry(page,['.masthead','#m-dock']);
        for(const control of safeControls)if(control.visible&&(control.rect.y<38||control.rect.bottom>viewport.height-24))finding(viewport,'safe-area','controls-enter-system-bars',{selector:control.selector,rect:control.rect});
      }
      await screenshot(page, viewport, 'home');
    });
    if (!await page.evaluate(() => !!window.__petGame?.state()?.ready)) { await context.close(); continue; }
    await check('room-simultaneous-info', async () => {
      const items = await page.evaluate(() => {
        const ids = ['message','action-status','ambient-status','pg-sync'];
        const texts = ['小橘想和你一起玩一会儿。','正在喝水，点一下水碗继续。','小橘正在看窗外的小鸟。','你工作「公司」 小橘正在看窗外的小鸟「小花坛」'];
        ids.forEach((id,index) => { const el=document.getElementById(id); if(el){el.hidden=false;el.classList.remove('m-faded');el.textContent=texts[index];} });
        return ids;
      });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const bounds = await geometry(page, items.map(id => `#${id}`).concat('#m-dock'));
      for (let i=0;i<bounds.length;i++) for(let j=i+1;j<bounds.length;j++)
        if(overlap(bounds[i],bounds[j])) finding(viewport,'room-simultaneous-info','info-overlap',{ selectors:[bounds[i].selector,bounds[j].selector], rects:[bounds[i].rect,bounds[j].rect] });
      for(const item of bounds) if(mobile&&item.offscreen) finding(viewport,'room-simultaneous-info','info-offscreen',{selector:item.selector,rect:item.rect});
      await screenshot(page,viewport,'simultaneous-info');
      await page.reload(); await page.waitForFunction(() => window.__petGame?.state()?.ready);
    });
    if(mobile)await check('room-info-scroll',async()=>{
      await page.evaluate(()=>['message','action-status','ambient-status','pg-sync'].forEach(id=>{const el=document.getElementById(id);el.hidden=false;el.classList.remove('m-faded');el.textContent='很长的生活提示需要换行，确保所有信息可以滚动查看。'.repeat(15);}));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.evaluate(()=>{document.getElementById('pg-sync').hidden=true;});
      const container=await page.locator('#m-room-info').evaluate(el=>({clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,scrollTop:el.scrollTop,rect:el.getBoundingClientRect().toJSON(),pointerEvents:getComputedStyle(el).pointerEvents}));
      if(container.scrollHeight>container.clientHeight+5){
        const x=container.rect.x+container.rect.width/2,y=container.rect.y+container.rect.height-12;
        await page.mouse.move(x,y);await page.mouse.wheel(0,350);
        await page.waitForFunction(()=>document.getElementById('m-room-info').scrollTop>0,{},{timeout:1500}).catch(()=>{});
        const after=await page.locator('#m-room-info').evaluate(el=>el.scrollTop);
        if(after<=container.scrollTop)finding(viewport,'room-info-scroll','overflow-not-scrollable',{selector:'#m-room-info',container,after,step:'4条长提示使容器溢出→在容器底部状态信息处滚动'});
        await page.waitForTimeout(250);
        await page.locator('#m-room-info').evaluate(el=>{el.scrollTop=0;});
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const touchSession=await context.newCDPSession(page);
        const touchHit=await page.evaluate(({x,y})=>{const el=document.elementFromPoint(x,y);return {id:el?.id,tag:el?.tagName,scrollTop:document.getElementById('m-room-info').scrollTop};},{x,y});
        await touchSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
        for(let step=1;step<=8;step++){
          await touchSession.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-step*20}]});
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
        }
        await touchSession.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        await page.waitForFunction(()=>document.getElementById('m-room-info').scrollTop>0,{},{timeout:1500}).catch(()=>{});
        const touchAfter=await page.locator('#m-room-info').evaluate(el=>el.scrollTop);
        if(touchAfter<=0)finding(viewport,'room-info-scroll','overflow-not-touch-scrollable',{selector:'#m-room-info',container,touchAfter,touchHit});
        await touchSession.detach();
      }
      await screenshot(page,viewport,'room-info-scroll');
      await page.reload();await page.waitForFunction(()=>window.__petGame?.state()?.ready);
    });
    await check('life-tabs', async () => {
      await page.evaluate(() => window.__pgLife.open('today'));
      await page.locator('#life-ov.on').waitFor();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const ringTexts = await page.locator('.lf-ring .lf-cs,.lf-ring .lf-cs2').evaluateAll(els => els.map(el => ({text:el.textContent, width:el.getBBox().width})));
      for(const text of ringTexts) if(text.width > 112.5) finding(viewport,'life-today','ring-text-overflow',{selector:'.lf-ring .lf-cs/.lf-cs2',...text});
      const header = await geometry(page,['.lf-head b','#lf-date','#lf-mode','.lf-x']);
      if(mobile&&process.argv.includes('--safe-area'))for(const control of header.filter(item=>item.selector==='.lf-x'))if(control.visible&&control.rect.y<38)finding(viewport,'safe-area','overlay-close-enters-status-bar',{selector:control.selector,rect:control.rect});
      for(let i=0;i<header.length;i++)for(let j=i+1;j<header.length;j++)
        if(overlap(header[i],header[j]))finding(viewport,'life-today','header-overlap',{selectors:[header[i].selector,header[j].selector]});
      await panelBounds(page,viewport,'life-today',['.lf-head','.lf-hero','.lf-ringwrap','.lf-ring','.lf-now','.lf-card','#lf-date','.lf-head>div']);
      const tabs=await page.locator('.lf-tabs button').evaluateAll(els=>els.map(el=>{const p=el.parentElement.getBoundingClientRect(),r=el.getBoundingClientRect();return {text:el.textContent,height:r.height,clipped:r.bottom>p.bottom+1||r.top<p.top-1};}));
      for(const tab of tabs) if(tab.clipped||tab.height<24)finding(viewport,'life-today','tab-vertical-clipping',{selector:'.lf-tabs button',...tab});
      await screenshot(page,viewport,'life-today');
      for(const tab of ['heart','places','badge','privacy','today']) {
        await page.locator(`.lf-tabs [data-tab="${tab}"]`).click();
        await panelBounds(page,viewport,`life-${tab}`,['.lf-box','.lf-body','.lf-body section','.lf-body .lf-places','.lf-body .lf-bz','.lf-body .lf-voice']);
        const layout = await page.evaluate(() => ({bodyWidth:document.querySelector('.lf-body').clientWidth, scrollWidth:document.querySelector('.lf-body').scrollWidth}));
        if(layout.scrollWidth>layout.bodyWidth+2)finding(viewport,`life-${tab}`,'body-horizontal-overflow',layout);
        if(mobile&&process.argv.includes('--safe-area')){
          const scrollViewport=await page.locator('.lf-body').boundingBox();
          if(scrollViewport.y+scrollViewport.height>viewport.height-24+1)finding(viewport,'safe-area',`life-${tab}-scroll-viewport-enters-gesture-bar`,{selector:'.lf-body',rect:scrollViewport});
          await page.locator('.lf-body').evaluate(el=>{el.scrollTop=el.scrollHeight;});
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          const bottomControls=await geometry(page,['.lf-body button','.lf-body input']);
          for(const control of bottomControls)if(control.visible&&control.rect.y<viewport.height&&control.rect.bottom>viewport.height-24+1)finding(viewport,'safe-area',`life-${tab}-control-enters-gesture-bar`,{selector:control.selector,text:control.text,rect:control.rect});
          await page.locator('.lf-body').evaluate(el=>{el.scrollTop=0;});
        }
        await screenshot(page,viewport,`life-${tab}`);
      }
      await page.locator('#life-ov .lf-x').click();
    });
    for (const view of ['shop','family','clinic','journal']) await check(`panel-${view}`, async () => {
      await page.locator(mobile ? `#m-rail [data-v="${view}"]` : `.town-nav [data-view="${view}"]`).click();
      await page.locator(`#${view}-panel`).waitFor({state:'visible'});
      await panelBounds(page,viewport,`panel-${view}`,[`#${view}-panel`, `#${view}-panel input`, `#${view}-panel select`, '#m-sheet .m-head']);
      if(mobile) {
        const body = await page.locator('#m-sheet-body').evaluate(el => ({clientWidth:el.clientWidth,scrollWidth:el.scrollWidth}));
        if(body.scrollWidth>body.clientWidth+2)finding(viewport,`panel-${view}`,'sheet-horizontal-overflow',body);
      }
      await screenshot(page,viewport,`panel-${view}`);
      if(view==='clinic') {
        await page.locator('#visit-clinic').click();
        await page.locator('#clinic-dialog[open]').waitFor();
        await panelBounds(page,viewport,'clinic-dialog',['#clinic-dialog','.clinic-instruments']);
        await page.locator('#clinic-dialog .close-button').click();
      }
      if(mobile)await page.locator('#m-sheet-close').click();else await page.locator('.town-nav [data-view="home"]').click();
    });
    await check('rename-dialog',async()=>{
      await page.locator('#rename-button').click();await page.locator('#rename-dialog[open]').waitFor();
      await panelBounds(page,viewport,'rename-dialog',['#rename-dialog','#rename-dialog input']);
      await page.locator('#rename-dialog .close-button').click();
    });
    await check('care-entrances',async()=>{
      if(mobile) { await page.locator('#m-dock [data-m="more"]').click();await page.locator('#m-sheet[data-mode="care"].on').waitFor(); }
      else await page.locator('#care-shortcuts summary').click();
      if(await page.locator('.care-action').count()!==8)finding(viewport,'care-entrances','care-action-count',{count:await page.locator('.care-action').count()});
      await screenshot(page,viewport,'care');
      await page.locator('.care-action[data-action="play"]').click();await page.locator('#game-dialog[open]').waitFor();
      await panelBounds(page,viewport,'game-dialog',['#game-dialog']);await page.locator('#game-dialog .close-button').click();
    });
    await check('care-live-bubble',async()=>{
      if(mobile)await page.locator('#m-dock [data-m="drink"]').click();
      else await page.locator('.care-action[data-action="drink"]').click();
      await page.waitForFunction(()=>!!window.__petGame.state().room.interaction);
      await page.locator('#pg-think:not([hidden])').waitFor();
      await panelBounds(page,viewport,'care-live-bubble',['#pg-think .pg-bub','#pg-think [data-a="rest"]']);
      await screenshot(page,viewport,'care-live');
      await page.locator('#pg-think [data-a="rest"]').click();
      await page.waitForFunction(()=>!window.__petGame.state().room.interaction);
      if(mobile)await page.locator('#m-dock:not([hidden])').waitFor();
    });
    await check('world-return-repeat',async()=>{
      for(let trip=0;trip<2;trip++) {
        await page.locator(mobile ? '#m-rail [data-v="world"]' : '.town-nav [data-view="world"]').click();
        await page.locator('#world-scene').waitFor({state:'visible'});
        if(mobile) {
          await page.locator('#m-sheet[data-mode="world"].on').waitFor();
          await screenshot(page,viewport,`world-open-${trip}`);
          await page.locator('#m-sheet-close').click();
          await screenshot(page,viewport,`world-collapsed-${trip}`);
          const returns=await geometry(page,['#mobile-world-home','#m-world-home','#world-home','.world-return','#world-entry-status [data-world-remedy="home"]']);
          const usable=returns.filter(item=>item.visible&&!item.offscreen&&item.hit);
          if(!usable.length) finding(viewport,'world-collapsed','no-visible-return',{step:'点击出门 → 点击收起 → 寻找回房间/回到小家入口',controls:returns});
          const button = page.locator('#mobile-world-home,#m-world-home').first();
          if(await button.isVisible()) await button.click();
          else {await page.locator('#m-sheet-close').click();await page.locator('#world-home').click();}
        } else {
          if(viewport.width<=900&&viewport.height<=600){
            const landscapeReturn=(await geometry(page,['#m-world-home']))[0];
            if(!landscapeReturn?.visible||landscapeReturn.offscreen||!landscapeReturn.hit)finding(viewport,'world-landscape','no-visible-return',{selector:'#m-world-home',control:landscapeReturn});
            await screenshot(page,viewport,`world-landscape-${trip}`);
            if(landscapeReturn?.visible)await page.locator('#m-world-home').click();else await page.locator('#world-home').click();
          }else await page.locator('#world-home').click();
        }
        await page.waitForFunction(()=>document.body.dataset.view==='home');
        await page.locator('#home-scene').waitFor({state:'visible'});
      }
    });
    if(mobile)await check('orientation-roundtrip',async()=>{
      await page.setViewportSize({width:852,height:393});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const wide=await page.locator('#m-room-info').evaluate(el=>({hidden:el.hidden,count:el.children.length}));
      if(!wide.hidden||wide.count)finding(viewport,'orientation-roundtrip','wide-info-not-restored',wide);
      await page.setViewportSize(viewport);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const narrow=await page.locator('#m-room-info').evaluate(el=>({hidden:el.hidden,count:el.children.length,ids:[...el.children].map(x=>x.id)}));
      if(narrow.hidden||narrow.count!==4||new Set(narrow.ids).size!==4)finding(viewport,'orientation-roundtrip','mobile-info-not-restored',narrow);
      if(await page.locator('#m-world-home').count()!==1)finding(viewport,'orientation-roundtrip','duplicate-return-button',{});
    });
    await check('blocks-overlay',async()=>{
      await page.evaluate(()=>window.__pgBlocks.open());await page.locator('#bk-ov.on').waitFor();
      await panelBounds(page,viewport,'blocks-overlay',['#bk-ov .bk-box','.bk-head','.bk-main','.bk-form']);
      await screenshot(page,viewport,'blocks');await page.locator('#bk-ov .bk-x').click();
    });
    await check('life-long-name',async()=>{
      await page.locator('#rename-button').click();await page.locator('#name-input').fill('名字很长的小橘猫猫小朋友');
      await page.locator('#rename-dialog .primary-button').click();
      await page.evaluate(()=>window.__pgLife.open('today'));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await panelBounds(page,viewport,'life-long-name',['.lf-head','.lf-card','.lf-now']);
      const labels=await page.locator('.lf-ring .lf-cs,.lf-ring .lf-cs2').evaluateAll(els=>els.map(el=>({text:[...el.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).map(node=>node.textContent).join(''),width:el.getBBox().width,renderedWidth:el.getBoundingClientRect().width,fontSize:getComputedStyle(el).fontSize})));
      for(const label of labels){
        if(label.width>112.5)finding(viewport,'life-long-name','ring-text-overflow',{selector:'.lf-ring .lf-cs/.lf-cs2',...label});
        if(label.text.length>14&&label.renderedWidth/label.text.length<5)finding(viewport,'life-long-name','ring-text-overcompressed',{selector:'.lf-ring .lf-cs2',...label});
      }
      await screenshot(page,viewport,'life-long-name');await page.locator('#life-ov .lf-x').click();
    });
    await check('graduation-overlay',async()=>{
      await page.evaluate(()=>{const id=window.__petGame.state().pet.activeCatId;window.__petGrad.call(id,true);window.__petGrad.open(id);});await page.locator('#grad-ov.on').waitFor();
      await panelBounds(page,viewport,'graduation-overlay',['#grad-ov .g-box','#grad-ov .g-body']);
      await screenshot(page,viewport,'graduation');await page.locator('#grad-ov .g-close').click();
    });
    await context.close();
    console.log('VIEWPORT',JSON.stringify({viewport,checks:report.checks.filter(x=>x.viewport===viewport).length,findings:report.findings.filter(x=>x.viewport===viewport)}));
  }
} finally {
  await browser.close();await new Promise(resolve=>server.close(resolve));
  await writeFile(new URL(`deliverables/ui-audit-${phase}-report.json`,root),JSON.stringify(report,null,2));
  console.log('AUDIT',JSON.stringify({phase,checks:report.checks.length,findings:report.findings.length,errors:report.errors,report:`deliverables/ui-audit-${phase}-report.json`}));
  if ((phase.startsWith('final') || process.argv.includes('--strict')) && (report.findings.length || report.errors.length)) process.exitCode=1;
}
