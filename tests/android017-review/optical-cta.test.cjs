'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'../../artifacts/html-offline-candidate'),source=root+'/ui017/source';
const before=require(root+'/ui016/source/web/offline-nav-icons.js'),after=require(source+'/web/offline-nav-icons.js');
const {fixture}=require(source+'/tests/encounter-ui-fixture.cjs');
test('only life/wardrobe SVG output changes; original 26px slots, labels, targets and disabled state stay',()=>{
 for(const name of ['meet','dex','world','family'])assert.equal(after.svg(name,26,'cross-version'),before.svg(name,26,'cross-version'),name+' exact output');
 for(const name of ['life','wardrobe'])assert.notEqual(after.svg(name,26,'cross-version'),before.svg(name,26,'cross-version'));
 const h=fixture();try{
  const buttons=[...h.d.querySelectorAll('#m-rail button')],attrs=buttons.map(b=>[...b.attributes].map(a=>[a.name,a.value])),labels=buttons.map(b=>b.textContent.replace(/^[◎▦◔♧♢♡]/,''));
  buttons[0].disabled=true;after.install(h.d);after.install(h.d);
  assert.deepEqual([...h.d.querySelectorAll('#m-rail button')],buttons);assert.deepEqual(buttons.map(b=>b.textContent),labels);assert.equal(buttons[0].disabled,true);
  buttons.forEach((b,i)=>attrs[i].forEach(([key,value])=>assert.equal(b.getAttribute(key),value)));
  for(const svg of h.d.querySelectorAll('#m-rail svg')){assert.equal(svg.getAttribute('width'),'26');assert.equal(svg.getAttribute('height'),'26');assert.equal(svg.getAttribute('viewBox'),'0 0 48 48');assert.equal(svg.getAttribute('aria-hidden'),'true');}
  for(const name of ['life','wardrobe'])assert.match(after.svg(name,26,'optical'),/stroke-width="2\.3"/);
 }finally{h.close();}
});
test('full original+Host+polish cascade yields opaque accessible CTA and preserves activation',()=>{
 const h=fixture();try{
  for(const name of ['offline-host.css','offline-ui-polish.css']){const s=h.d.createElement('style');s.textContent=fs.readFileSync(source+'/web/'+name,'utf8');h.d.head.append(s);}
  const slot=h.d.createElement('div');slot.id='offline-notifications';h.d.body.append(slot);const banner=h.d.getElementById('sc-banner');slot.append(banner);banner.className='sc-banner';banner.hidden=false;banner.setAttribute('data-offline-selected','');
  banner.innerHTML='<span class="sc-bpet"></span><div><b>附近来了一只小猫</b><small>游戏内约1米</small></div><button type="button" class="g-btn" data-bmeet="npc-pudding">去遇见</button><button type="button" data-bx>×</button>';
  const button=banner.querySelector('[data-bmeet]');let clicks=0;button.addEventListener('click',()=>clicks++);
  const luminance=rgb=>{const v=rgb.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
  for(const disabled of [false,true]){
   button.disabled=disabled;const c=h.w.getComputedStyle(button),values=x=>x.match(/[\d.]+/g).map(Number),fg=values(c.color),bg=values(c.backgroundColor);
   assert.ok(fg.length===3||fg[3]===1);assert.ok(bg.length===3||bg[3]===1);
   const a=luminance(fg.slice(0,3)),b=luminance(bg.slice(0,3)),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(ratio>=4.5,String(ratio));
   for(let element=button;element;element=element.parentElement){const opacity=h.w.getComputedStyle(element).opacity;assert.equal(opacity===''?1:Number(opacity),1,'no static ancestor opacity reduction');}
   assert.ok(parseFloat(c.minHeight)>=48,'existing 48px CTA target retained');button.click();assert.equal(clicks,1,'disabled state must suppress activation');
  }
 }finally{h.close();}
});
