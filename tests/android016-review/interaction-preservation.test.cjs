'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const source=path.resolve(__dirname,'../../artifacts/html-offline-candidate/ui016/source');
const {fixture}=require(source+'/tests/encounter-ui-fixture.cjs');
const icons=require(source+'/web/offline-nav-icons.js');
test('six original disabled/enabled buttons retain properties and real click handlers through repeated SVG decoration',()=>{
 const h=fixture();try{
  const before=[...h.d.querySelectorAll('#m-rail button')],labels=before.map(b=>b.textContent.replace(/^[◎▦◔♧♢♡]/,''));let clicks=0;
  before.forEach((b,i)=>{b.disabled=i%2===0;b.addEventListener('click',()=>clicks++);});
  const disabled=before.map(b=>b.disabled);icons.install(h.d);icons.install(h.d);
  assert.deepEqual([...h.d.querySelectorAll('#m-rail button')],before);assert.deepEqual(before.map(b=>b.disabled),disabled);assert.deepEqual(before.map(b=>b.textContent),labels);
  before.forEach(b=>b.click());assert.equal(clicks,disabled.filter(x=>!x).length,'disabled original buttons must not dispatch their original handlers');
  for(const b of before.filter(b=>b.dataset.offlineIcon)){
   assert.equal(b.querySelector('svg').getAttribute('aria-hidden'),'true');assert.equal(b.querySelector('svg').getAttribute('focusable'),'false');
   assert.ok(b.textContent.trim().length>0);assert.equal(b.querySelector('a,button,[tabindex]'),null,'no nested focus/activation target');
  }
 }finally{h.close();}
});
test('actual social-v7 rUI live phases and original result text nodes survive every decorate call',()=>{
 const h=fixture();try{
  h.open();assert.equal(typeof h.w.rUI,'function');const s=h.w.__pgSocial,originalPeer=JSON.stringify([...s.peers]);
  const states={idle:'长按实体键',armed:'轻点屏幕开始敲',lead:'敲 4–8 下，停下就算敲完',watch:'看布丁敲…','follow-wait':'轮到你跟着敲！',follow:'跟着敲…','npc-follow':'布丁在跟…','wait-follow':'等对方跟敲…',judge:'比对中…'};
  for(const [phase,expected]of Object.entries(states)){
   s.M.R.ph=phase;h.w.rUI();const tx=h.d.getElementById('sc-rtxt'),value=tx.textContent;
   assert.equal(value,expected);h.ui.decorate(h.w);h.ui.decorate(h.w);assert.equal(h.d.getElementById('sc-rtxt'),tx);assert.equal(tx.textContent,value);
  }
  const act=h.d.getElementById('sc-mact');act.innerHTML='<ul class="sc-res"><li><span>礼</span></li></ul>';
  const literal=h.d.createTextNode('原始结果不可丢失'.repeat(80));act.querySelector('li').append(literal);h.ui.decorate(h.w);
  assert.equal(literal.parentElement.className,'offline-result-copy');assert.equal(JSON.stringify([...s.peers]),originalPeer);
 }finally{h.close();}
});
