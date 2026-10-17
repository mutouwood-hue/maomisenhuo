/* Real production CSS + original arm + production input in unattached WebKit.
   :active is mirrored to an attribute selector of equal specificity for
   deterministic offscreen states; actual Android input remains separate. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),{fixture,root}=require('../tests/encounter-ui-fixture.cjs');
const out=path.resolve(root,'../evidence/key');fs.mkdirSync(out,{recursive:true});
const h=fixture();h.open();const markup=h.d.getElementById('sc-meet').outerHTML,asset=fs.readFileSync(root+'/android/app/src/main/assets/index.html','utf8'),inline=[...asset.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(x=>x[1]);h.close();
const files=['life-panels.css','offline-host.css','offline-ui-polish.css','offline-page-polish.css'],css=[...inline,...files.map(f=>fs.readFileSync(root+'/web/'+f,'utf8'))],social=fs.readFileSync(root+'/android/app/src/main/assets/game-08.js','utf8'),rUI=social.slice(social.indexOf('function rUI(){'),social.indexOf('function pulse(')),arm=social.slice(social.indexOf('function arm(){'),social.indexOf('const keyControl=')),moduleText=fs.readFileSync(root+'/web/offline-meet-key.js','utf8');
const meta={engine:'macOS offscreen WKWebView, nonpersistent, no window/device/browser tab',viewport:{width:360,height:640},productionStyles:files.map((f,i)=>({file:f,sha256:crypto.createHash('sha256').update(css[inline.length+i]).digest('hex')})),inlineIndexSha256:crypto.createHash('sha256').update(asset).digest('hex'),inputSha256:crypto.createHash('sha256').update(moduleText).digest('hex'),limitation:':active mirrored to equal-specificity attribute state; synthetic PointerEvents and deterministic clock; actual Android touch/cancel/native selection still pending'};
const script=String.raw`
${moduleText}
(async()=>{const rows=[];try{
Object.defineProperty(document,'hidden',{get:()=>false});
const modal=document.getElementById('sc-meet'),key=document.getElementById('sc-key'),$=id=>document.getElementById(id),M={tab:'rhythm',peer:{src:'npc'},R:{ph:'idle'}},tone=()=>{},vib=()=>{},send=()=>{},track=()=>{};
${rUI}
${arm}
let time=100,id=0;const tasks=new Map();window.Date.now=()=>time;window.setTimeout=(fn,ms)=>{tasks.set(++id,{fn,at:time+ms});return id;};window.clearTimeout=id=>tasks.delete(id);window.setInterval=()=>++id;window.clearInterval=()=>{};
const control=CatOfflineMeetKey.bind({w:window,modal,key,getSession:()=>M,arm});
const aliases=[];function alias(rules){let text='';for(const rule of rules){if(rule.selectorText?.includes(':active')){const selector=rule.selectorText.replaceAll(':active','[data-engine-active]');text+=selector+'{'+rule.style.cssText+'}';aliases.push({original:rule.selectorText,alias:selector});}else if(rule.cssRules){const inner=alias(rule.cssRules);if(inner)text+=rule.cssText.slice(0,rule.cssText.indexOf('{')+1)+inner+'}';}}return text;}
for(const sheet of [...document.styleSheets]){const style=document.createElement('style');style.textContent=alias(sheet.cssRules);sheet.ownerNode.after(style);}
const bounds=()=>{const r=key.getBoundingClientRect();return{left:r.left,top:r.top,width:r.width,height:r.height}};
const assert=(condition,name,detail)=>{rows.push({name,pass:!!condition,detail});if(!condition)throw Error(name);};
const fire=(type,p,extra={})=>key.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:1,pointerType:'touch',isPrimary:true,button:0,clientX:p.x,clientY:p.y,...extra}));
const advance=ms=>{time+=ms;for(const[k,v]of [...tasks])if(v.at<=time){tasks.delete(k);v.fn();}};
const reset=()=>{control.cancel(true);M.R={ph:'idle'};key.removeAttribute('data-engine-active');};
// Exact production cascade and layout, including normal, active, down, armed.
const initial=bounds();key.setAttribute('data-engine-active','');const active=bounds();key.classList.add('down');const down=bounds();key.classList.remove('down');key.classList.add('armed');const armed=bounds();key.classList.remove('armed');
assert(aliases.some(x=>x.original==='button:not(:disabled):active'),'production global active rule included',aliases);
assert([active,down,armed].every(r=>Math.abs(r.top-initial.top)<.01&&Math.abs(r.left-initial.left)<.01),'production active/down/armed keep same actual WebKit rectangle',{initial,active,down,armed,transform:getComputedStyle(key).transform,transition:getComputedStyle(key).transitionProperty});
assert(!getComputedStyle(key).transitionProperty.split(',').some(x=>['all','transform'].includes(x.trim())),'no geometry transition on hold target');
reset();const rect=bounds(),center={x:rect.left+rect.width/2,y:rect.top+rect.height/2};
fire('pointerdown',center);key.setAttribute('data-engine-active','');fire('pointermove',center);advance(999);assert(M.R.ph==='idle','stable hold stays idle before1000');advance(1);fire('pointerup',center);assert(M.R.ph==='armed','actual CSS + input + original arm succeed for stationary center hold',bounds());
reset();fire('pointerdown',center);key.setAttribute('data-engine-active','');advance(300);fire('pointerup',center);advance(1000);assert(M.R.ph==='idle','short release under active cascade remains idle');
for(const kind of ['pointercancel','lostpointercapture','pointerleave']){reset();fire('pointerdown',center);key.setAttribute('data-engine-active','');advance(700);fire(kind,center);advance(600);assert(M.R.ph==='idle'&&tasks.size===0,kind+' does not arm under active CSS');}
reset();fire('pointerdown',center);key.setAttribute('data-engine-active','');fire('pointermove',{x:rect.left-2,y:center.y});advance(1100);assert(M.R.ph==='idle','genuine slide outside still cancels');
// Remove only019 fix: same CSS engine must reproduce018 movement/cancel.
reset();const polish=document.getElementById('production-polish');polish.textContent=polish.textContent.replace(/\/\* 019:[\s\S]*?\}\s*/,'');
for(const s of [...document.querySelectorAll('style')])if(!s.id&&s.textContent.includes('#sc-meet #sc-key[data-engine-active]'))s.remove();
const before=bounds(),oldCenter={x:before.left+before.width/2,y:before.top+before.height/2};fire('pointerdown',oldCenter);key.setAttribute('data-engine-active','');key.style.transition='none';const moved=bounds();fire('pointermove',oldCenter);advance(1100);assert(moved.top-before.top>20&&M.R.ph==='idle','018 production negative control moves key and cancels same stationary finger',{before,moved,phase:M.R.ph});
control.dispose();window.webkit.messageHandlers.result.postMessage({pass:true,metadata:${JSON.stringify(meta)},tests:rows});
}catch(error){window.webkit.messageHandlers.result.postMessage({pass:false,metadata:${JSON.stringify(meta)},error:String(error),tests:rows});}})();`;
const html='<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">'+css.map((x,i)=>'<style'+(i===inline.length+files.indexOf('offline-ui-polish.css')?' id="production-polish"':'')+'>'+x+'</style>').join('')+'<body>'+markup+'<script>'+script.replaceAll('</script','<\\/script')+'</script>';
fs.writeFileSync(out+'/production-css-input.html',html);cp.execFileSync('swiftc',[root+'/scripts/check_key_webkit.swift','-o','/tmp/cat-key-webkit']);cp.execFileSync('/tmp/cat-key-webkit',[out+'/production-css-input.html',out+'/production-css-input.json'],{stdio:'inherit',timeout:45000});console.log(fs.readFileSync(out+'/production-css-input.json','utf8'));
