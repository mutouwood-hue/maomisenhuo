const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),root=path.resolve(__dirname,'..');
test('short-screen rail keeps original entries and offers bounded paging down to badge, then back to top',async()=>{
 const dom=new JSDOM(fs.readFileSync(root+'/android/app/src/main/assets/index.html','utf8'),{runScripts:'outside-only'}),w=dom.window,d=w.document,rail=d.getElementById('m-rail');
 try{
  const badge=d.createElement('button');badge.textContent='吧唧';badge.id='offline-device-open';rail.append(badge);
  w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollIntoView=()=>{};w.requestAnimationFrame=fn=>{queueMicrotask(fn);return 1;};
  let height=320;Object.defineProperty(rail,'clientHeight',{get:()=>height});Object.defineProperty(rail,'scrollHeight',{get:()=>532});
  const scroll=top=>{rail.scrollTop=Math.max(0,Math.min(532-height,top));rail.dispatchEvent(new w.Event('scroll'));};rail.scrollBy=({top})=>scroll(rail.scrollTop+top);rail.scrollTo=({top})=>scroll(top);
  const original=[...rail.children];w.eval(fs.readFileSync(root+'/web/offline-layout.js','utf8'));
  const more=d.getElementById('offline-rail-more');assert.equal(more.hidden,false);assert.equal(rail.classList.contains('offline-rail-overflow'),true);assert.match(more.getAttribute('aria-label'),/手记和吧唧/);
  more.click();assert.equal(rail.scrollTop,212);assert.match(more.textContent,/返回/);assert.deepEqual([...rail.children],original);
  more.click();assert.equal(rail.scrollTop,0);assert.match(more.textContent,/更多/);
  height=600;w.dispatchEvent(new w.Event('resize'));assert.equal(more.hidden,true);assert.equal(rail.classList.contains('offline-rail-overflow'),false);
 }finally{w.dispatchEvent(new w.Event('pagehide'));await new Promise(resolve=>setImmediate(resolve));dom.window.close();}
});
