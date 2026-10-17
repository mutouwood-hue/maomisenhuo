'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=path.resolve(__dirname,'../../artifacts/html-offline-candidate/ui014/source');
const {JSDOM}=require(source+'/node_modules/jsdom');
test('actual rail pages multiple screens to final badge; mutations/route changes do not dispatch gameplay or BLE actions',async()=>{
 const dom=new JSDOM(fs.readFileSync(source+'/android/app/src/main/assets/index.html','utf8'),{runScripts:'outside-only'}),w=dom.window,d=w.document,rail=d.getElementById('m-rail');
 try{
  w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollIntoView=()=>{};w.requestAnimationFrame=fn=>{queueMicrotask(fn);return 1;};
  const badge=d.createElement('button');badge.id='offline-device-open';badge.textContent='吧唧';rail.append(badge);
  let actions=0,radio=0;w.CatLocalV2Native={postMessage(){radio++;}};
  for(const element of [...rail.children,d.getElementById('world-home')])element?.addEventListener('click',()=>actions++);
  Object.defineProperty(rail,'clientHeight',{get:()=>240});Object.defineProperty(rail,'scrollHeight',{get:()=>1100});
  const scroll=top=>{rail.scrollTop=Math.max(0,Math.min(860,top));rail.dispatchEvent(new w.Event('scroll'));};rail.scrollBy=({top})=>scroll(rail.scrollTop+top);rail.scrollTo=({top})=>scroll(top);
  const original=[...rail.children];w.eval(fs.readFileSync(source+'/web/offline-layout.js','utf8'));
  const more=d.getElementById('offline-rail-more');let pages=0;
  while(rail.scrollTop<860&&pages<10){more.click();pages++;}
  assert.equal(rail.scrollTop,860);assert.equal(pages,5);assert.match(more.textContent,/返回/);assert.deepEqual([...rail.children],original);
  assert.equal(actions,0);assert.equal(radio,0);
  for(let i=0;i<100;i++)d.body.classList.toggle('fixture-transition',i%2===0);
  d.body.dataset.view='world';await new Promise(resolve=>setImmediate(resolve));
  d.body.dataset.view='home';await new Promise(resolve=>setImmediate(resolve));
  assert.equal(actions,0);assert.equal(radio,0);assert.equal(rail.scrollTop,860);
  badge.click();assert.equal(actions,1,'only an actual final-button click dispatches its original handler');
  more.click();assert.equal(rail.scrollTop,0);assert.equal(actions,1);
 }finally{w.dispatchEvent(new w.Event('pagehide'));await new Promise(resolve=>setImmediate(resolve));dom.window.close();}
});
