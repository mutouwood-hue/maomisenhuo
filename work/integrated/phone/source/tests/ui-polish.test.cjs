const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture,root}=require('./encounter-ui-fixture.cjs'),icons=require('../web/offline-nav-icons.js');
test('six decorative local icons keep all original labels, button nodes, order and delegated actions',()=>{
 const h=fixture();try{
  const rail=h.d.getElementById('m-rail'),before=[...rail.children],names=before.map(x=>x.textContent),calls=[];
  for(const b of before)b.addEventListener('click',()=>calls.push(b));icons.install(h.d);icons.install(h.d);
  assert.deepEqual([...rail.children],before);assert.deepEqual(before.map(x=>x.textContent),names.map(s=>s.replace(/^[◎▦◔♧♢♡]/,'')));
  assert.equal(rail.querySelectorAll('svg.offline-nav-icon').length,6);
  for(const button of rail.querySelectorAll('[data-offline-icon]')){const svg=button.querySelector('svg');assert.equal(svg.getAttribute('aria-hidden'),'true');assert.equal(svg.getAttribute('focusable'),'false');svg.querySelector('path').dispatchEvent(new h.w.MouseEvent('click',{bubbles:true}));assert.equal(calls.at(-1),button);}
  const ids=[...h.d.querySelectorAll('svg.offline-nav-icon [id]')].map(x=>x.id);assert.equal(ids.length,new Set(ids).size);
  const style=h.d.createElement('style');style.textContent=fs.readFileSync(root+'/web/offline-ui-polish.css','utf8');h.d.head.append(style);const disabled=rail.querySelector('[data-offline-icon]');disabled.disabled=true;assert.equal(h.w.getComputedStyle(disabled).opacity,'1','original global disabled opacity must not fade the retained label');assert.equal(h.w.getComputedStyle(disabled.querySelector('svg')).opacity,'0.5');
  for(const svg of rail.querySelectorAll('svg'))assert.equal(svg.querySelector('image,script,foreignObject'),null);
 }finally{h.close();}
});
test('original NPC modal copy retains timing and real actions; text wrapping never touches pet data',()=>{
 const h=fixture();try{
  h.open();const s=h.w.__pgSocial,peerBefore=JSON.stringify([...s.peers]);
  const hint=h.d.getElementById('sc-hint'),act=h.d.getElementById('sc-mact');assert.match(hint.textContent,/长按右侧「键」1 秒/);assert.match(hint.textContent,/15 秒/);assert.match(act.textContent,/4–8 下.*1\.2 秒.*5 秒/);
  assert.equal(h.d.querySelectorAll('#sc-meet .offline-meet-scroll').length,1);assert.equal(h.d.querySelector('#sc-meet .sc-mhead').parentElement.className,'sc-mbox');
  const button=act.querySelector('[data-r=npclead]');assert.ok(button);h.ui.decorate(h.w);assert.equal(act.querySelector('[data-r=npclead]'),button);assert.equal(JSON.stringify([...s.peers]),peerBefore);
  h.d.querySelector('[data-mclose]').click();assert.equal(h.d.getElementById('sc-meet').classList.contains('on'),false);assert.equal(s.M,null);
 }finally{h.close();}
});
test('NPC banner is labeled game distance, while non-NPC text and live rhythm hints stay intact',()=>{
 const h=fixture();try{
  const banner=h.d.getElementById('sc-banner');banner.dataset.fid='npc-pudding';banner.hidden=false;banner.innerHTML='<span class="sc-bpet"></span><div><b>附近 3 米内有一只暹罗猫</b><small>约 1.2 米 · 主人匿名，先让小猫们打个招呼</small><small class="offline-test-mode">本地试玩 · 官方 NPC</small></div><button data-bmeet="npc-pudding">去遇见</button><button data-bx>×</button>';
  const btn=banner.querySelector('[data-bmeet]');h.ui.decorate(h.w);assert.equal(banner.querySelector('b').textContent,'附近来了一只暹罗猫');assert.match(banner.querySelector('small').textContent,/游戏内约 1.2 米/);assert.equal(btn,banner.querySelector('[data-bmeet]'));assert.equal(banner.querySelector('.offline-test-mode').textContent,'本地试玩 · 官方 NPC');
  banner.dataset.fid='anonymous-real';banner.querySelector('b').textContent='附近的匿名小猫';h.ui.decorate(h.w);assert.equal(banner.querySelector('b').textContent,'附近的匿名小猫');
  h.open();h.d.getElementById('sc-hint').textContent='轮到你跟着敲！';h.ui.decorate(h.w);assert.equal(h.d.getElementById('sc-hint').textContent,'轮到你跟着敲！');
 }finally{h.close();}
});
test('result copy is node-preserving and idempotent with long literal text and empty hints',()=>{
 const h=fixture();try{
  h.open();const act=h.d.getElementById('sc-mact');act.innerHTML='<ul class="sc-res"><li><span>礼</span></li></ul><div class="lf-row"><button data-mclose>完成</button></div>';
  const li=act.querySelector('li'),literal='很长的原结果文本'.repeat(20)+' <不解析为HTML>';li.append(h.d.createTextNode(literal));const button=act.querySelector('button'),icon=li.firstElementChild;h.d.getElementById('sc-hint').textContent='';
  h.ui.decorate(h.w);h.ui.decorate(h.w);assert.equal(li.querySelector('.offline-result-copy').textContent,literal);assert.equal(li.firstElementChild,icon);assert.equal(act.querySelector('button'),button);assert.equal(li.querySelectorAll('.offline-result-copy').length,1);assert.equal(h.d.getElementById('sc-hint').hidden,true);
 }finally{h.close();}
});
test('local vectors have a common small-size slot and readable default/disabled label contrast',()=>{
 const report=JSON.parse(fs.readFileSync(root+'/tests/icon-size-reference.json'));assert.equal(report.iconSourceSha256,require('node:crypto').createHash('sha256').update(fs.readFileSync(root+'/web/offline-nav-icons.js')).digest('hex'),'size reference must belong to current icon source');assert.ok(report.contrast.normalLabel>=4.5);assert.ok(report.contrast.disabledLabel>=4.5);assert.ok(report.contrast.essentialOutline>=3);
 assert.ok(Math.max(...report.metrics.map(x=>Math.max(x.solidWidth,x.solidHeight)))-Math.min(...report.metrics.map(x=>Math.max(x.solidWidth,x.solidHeight)))<=4,'017 optical adjustment fits the unchanged 26px slot');
 const css=fs.readFileSync(root+'/web/offline-ui-polish.css','utf8');assert.match(css,/width:26px; height:26px/);assert.match(css,/min-width:48px/);assert.match(css,/\.offline-result-copy[^}]*min-width:0/);
});
test('017 leaves the other four rendered SVG definitions byte-identical to frozen016',()=>{
 const expected={meet:'a7a1d6aec6b2a91b40f3a4e51fa413232156f1635b8ff9555b798e3b07679951',dex:'e66cdef480c89df98121c6847a9220c4945e751384187354a7b3b20f4249b10f',world:'7deb851c7250e6129f64de1726f699e6f4cfe2a909deaa344e0d253edb1070c3',family:'e768f98a77e8d54c227b4038358b236e5b3746f7e4608d17a59fd2a36fcde2c9'};
 for(const [key,sha]of Object.entries(expected))assert.equal(require('node:crypto').createHash('sha256').update(icons.svg(key,26,'unchanged-016')).digest('hex'),sha,key);
});
test('017 original encounter CTA computed cascade exceeds 4.5 contrast enabled and disabled',()=>{
 const h=fixture();try{
  const style=h.d.createElement('style');style.textContent=fs.readFileSync(root+'/web/offline-ui-polish.css','utf8');h.d.head.append(style);
  const slot=h.d.createElement('div');slot.id='offline-notifications';h.d.body.append(slot);const banner=h.d.getElementById('sc-banner');slot.append(banner);banner.hidden=false;banner.innerHTML='<button class="g-btn" data-bmeet="npc-pudding">去遇见</button>';const button=banner.firstElementChild;
  const luminance=c=>{const rgb=c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
  for(const disabled of [false,true]){button.disabled=disabled;const c=h.w.getComputedStyle(button),a=luminance(c.color),b=luminance(c.backgroundColor),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(ratio>=4.5,`${disabled?'disabled':'enabled'} ${ratio}`);assert.equal(c.opacity,'1');assert.match(c.backgroundColor,/^rgb\(/,'opaque background');}
 }finally{h.close();}
});
test('automatic original-modal decoration settles without a self-triggering frame loop',async()=>{
 const h=fixture(),frames=[];try{
  h.w.requestAnimationFrame=fn=>{frames.push(fn);return frames.length;};h.open();h.ui.install(h.w);h.ui.install(h.w);h.d.getElementById('sc-hint').textContent='';let count=0;
  for(let i=0;i<8;i++){await new Promise(resolve=>setImmediate(resolve));const batch=frames.splice(0);for(const fn of batch){count++;fn();}}
  assert.ok(count<8,'decorator must not re-set unchanged hidden attributes forever');assert.equal(frames.length,0);assert.equal(h.d.getElementById('sc-hint').hidden,true);
 }finally{h.close();}
});
