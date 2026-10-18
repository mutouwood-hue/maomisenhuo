'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const original = fs.readFileSync(path.join(root, 'original/game.html'), 'utf8');
const build = fs.readFileSync(path.join(root, 'scripts/build_assets.py'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'web/life-navigation.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'web/life-companion.css'), 'utf8');
// 只读提取 Python 的精确字面量补丁；不 import/执行构建脚本，不生成 assets。
function decodeLiteral(literal) {
  return literal.slice(1, -1).replace(/\\([\\'"nrt])/g, (_, char) => ({n:'\n',r:'\r',t:'\t'}[char] ?? char));
}
const ownedNames = new Set([
  'places-demo-only-fictional-data', 'archive-silently-without-daily-review-push',
  'places-heading-matches-actual-source', 'places-real-empty-state-copy',
  'places-render-explicit-empty-state', 'world-places-heading-matches-actual-source',
  'world-places-render-explicit-empty-state', 'places-refresh-on-life-render',
  'world-places-refresh-on-mode-change', 'daily-stage-does-not-borrow-work-location',
  'companion-postcard-does-not-borrow-work-location', 'missing-real-place-neutral-canvas-no-map-request',
  'manual-ring-track-only-hit-layer'
]);
const literal = String.raw`(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")`;
const patchPattern = new RegExp(String.raw`js=once\(js,\s*(${literal}),\s*(${literal}),\s*(${literal})\)`, 'g');
const patches = Array.from(build.matchAll(patchPattern), match => match.slice(1).map(decodeLiteral)).filter(patch => ownedNames.has(patch[2]));
let patched = original;
for (const [oldText, newText, name] of patches) {
  assert.equal(patched.split(oldText).length - 1, 1, `${name}: unique exact anchor`);
  patched = patched.replace(oldText, newText);
}
function section(start, end, source = patched) { return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))); }
function run(code, context) { vm.runInNewContext(code, context); return context; }
function fixture({width=260,height=260}={}) {
  const handlers = {}, selected = [], captures = [], released = [], replayStops = [];
  const element = () => ({dataset:{},setAttribute(){},replaceChildren(){}});
  const parent = {querySelector:()=>note};
  const note = element();
  const cancelledFrames=[],futureCanvas={isConnected:true};
  let held = false;
  const tracks = [[108,16],[86,7]].map(([radius,stroke])=>({getAttribute:key=>String(key==='r'?radius:stroke)}));
  const svg = {
    isConnected:true,viewBox:{baseVal:{width:260,height:260}},parentElement:parent,
    getBoundingClientRect:()=>({left:0,top:0,width,height}),querySelectorAll:()=>tracks,
    closest:selector=>selector.includes('svg.lf-ring')?svg:{querySelector:()=>futureCanvas},
    getAttribute:()=> '600',setAttribute(){},after(){},
    setPointerCapture:id=>{held=true;captures.push(id)},hasPointerCapture:()=>held,
    releasePointerCapture:id=>{held=false;released.push(id)}
  };
  let open=true, observerCallback=null, observerConnected=false;
  const overlay={};
  const document = {hidden:false,addEventListener:(type,fn)=>(handlers[type]??=[]).push(fn),
    querySelector:selector=>selector.includes('svg.lf-ring')?svg:selector==='#life-ov'?overlay:selector==='#life-ov.on'&&open?overlay:null,
    createElement:element};
  const window = {document,addEventListener:(type,fn)=>(handlers[type]??=[]).push(fn),requestAnimationFrame:()=>1,cancelAnimationFrame:id=>cancelledFrames.push(id),
    MutationObserver:class {constructor(fn){observerCallback=fn;}observe(){observerConnected=true;}disconnect(){observerConnected=false;}},
    __pgLife:{hostDayClock:()=>({valid:true,day:'today',minute:600}),fmtT:String,
      hostStopDayReplay:()=>replayStops.push(true),hostSelectDayTime:(minute,_,mode)=>{selected.push({minute,mode});return {minute,future:minute>600,kind:'记录',source:'真实'};}}};
  run(navigation,{window});
  function dispatch(type,x=130,y=130,extra={}) {
    const event={target:svg,clientX:x,clientY:y,pointerId:1,button:0,isPrimary:true,prevented:0,
      preventDefault(){this.prevented++},...extra};
    for(const handler of handlers[type]||[])handler(event);
    return event;
  }
  return {window,svg,dispatch,selected,captures,released,replayStops,cancelledFrames,
    setOpen(value,notify=true){open=value;if(notify&&observerConnected)observerCallback();},
    get observerConnected(){return observerConnected;}};
}
test('all 13 owned once anchors are exact and game script remains valid JavaScript',()=>{
  assert.equal(patches.length,ownedNames.size);
  const scripts=Array.from(patched.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi));
  new vm.Script(scripts[5][1]);
  assert.match(build,/from prd_experience_patches import instrument_experience/);
  assert.match(build,/def instrument\(js\):\s+js = instrument_experience\(js, once, ROOT\)/);
});
test('center-start vertical scroll never captures, prevents or selects, even crossing a track',()=>{
  const f=fixture();
  assert.equal(f.dispatch('pointerdown',130,130).prevented,0);
  assert.equal(f.dispatch('pointermove',130,22).prevented,0);
  f.dispatch('pointerup',130,22);
  assert.deepEqual(f.selected,[]);assert.deepEqual(f.captures,[]);
});
test('inner blank disk, track gap, ticks and exterior do not start selection',()=>{
  for(const radius of [50,81,94,119,130]){
    const f=fixture();f.dispatch('pointerdown',130,130-radius);f.dispatch('pointermove',150,130-radius);f.dispatch('pointerup',150,130-radius);
    assert.deepEqual(f.selected,[],`radius ${radius}`);
  }
});
test('track pointerdown is only a candidate; tangent intent captures after threshold',()=>{
  const f=fixture();assert.equal(f.dispatch('pointerdown',130,22).prevented,0);
  assert.deepEqual(f.captures,[]);assert.deepEqual(f.selected,[]);
  assert.equal(f.dispatch('pointermove',133,22).prevented,0);
  assert.equal(f.dispatch('pointermove',145,23).prevented,1);
  assert.deepEqual(f.captures,[1]);assert.ok(f.selected.length);
  f.dispatch('pointerup',238,130);assert.equal(f.selected.at(-1).minute,360);assert.deepEqual(f.released,[1]);
});
test('both inner track and side vertical tangent rotate, not horizontal-only dragging',()=>{
  const f=fixture();f.dispatch('pointerdown',216,130);f.dispatch('pointermove',216,148);f.dispatch('pointerup',130,216);
  assert.deepEqual(f.captures,[1]);assert.equal(f.selected.at(-1).minute,720);
});
test('radial intent abandons selection without preventDefault or capture',()=>{
  const f=fixture();f.dispatch('pointerdown',130,22);assert.equal(f.dispatch('pointermove',130,40).prevented,0);
  f.dispatch('pointermove',150,22);f.dispatch('pointerup',150,22);
  assert.deepEqual(f.selected,[]);assert.deepEqual(f.captures,[]);
});
test('track tap selects on release, cancel/right-button/nonprimary do not select',()=>{
  const f=fixture();f.dispatch('pointerdown',22,130);f.dispatch('pointerup',22,130);
  assert.equal(f.selected.at(-1).minute,1080);assert.deepEqual(f.captures,[]);
  for(const extra of [{button:2},{isPrimary:false}]){
    const other=fixture();other.dispatch('pointerdown',130,22,extra);other.dispatch('pointerup',130,22);assert.deepEqual(other.selected,[]);
  }
  const cancelled=fixture();cancelled.dispatch('pointerdown',130,22);cancelled.dispatch('pointercancel');cancelled.dispatch('pointerup',130,22);assert.deepEqual(cancelled.selected,[]);
});
test('viewBox-scaled and letterboxed geometry preserve actual track radius',()=>{
  for(const [width,height,x,y] of [[520,520,260,44],[520,260,260,22]]){
    const f=fixture({width,height});f.dispatch('pointerdown',x,y);f.dispatch('pointerup',x,y);assert.equal(f.selected.at(-1).minute,0);
  }
});
test('keyboard, future/past host selection, replay reset and restore remain supported',()=>{
  const f=fixture();f.dispatch('keydown',0,0,{key:'ArrowRight'});assert.equal(f.selected.at(-1).minute,615);
  f.dispatch('keydown',0,0,{key:'ArrowLeft'});assert.equal(f.selected.at(-1).minute,600);
  f.window.CatDayNavigation.restore();assert.equal(f.selected.at(-1).mode,'manual');
  f.dispatch('click',0,0,{target:{closest:selector=>selector.includes('data-act=replay')?{}:null}});
  f.window.CatDayNavigation.restore();assert.equal(f.selected.at(-1).mode,'live');assert.ok(f.replayStops.length);
});
test('capture loss and visibility cleanup cannot continue stale selection',()=>{
  for(const type of ['pointercancel','lostpointercapture','visibilitychange']){
    const f=fixture();f.dispatch('pointerdown',130,22);f.dispatch('pointermove',145,23);
    if(type==='visibilitychange')f.window.document.hidden=true;
    f.dispatch(type);const length=f.selected.length;f.dispatch('pointermove',238,130);assert.equal(f.selected.length,length);
  }
});
test('closing a connected life overlay releases capture and suppresses stale input',()=>{
  const f=fixture();f.dispatch('pointerdown',130,22);f.dispatch('pointermove',145,23);
  const count=f.selected.length;f.setOpen(false);
  assert.deepEqual(f.released,[1]);assert.ok(f.replayStops.length);
  assert.equal(f.dispatch('pointermove',238,130).prevented,0);
  f.dispatch('pointerup',238,130);assert.equal(f.dispatch('keydown',0,0,{key:'ArrowRight'}).prevented,0);
  f.window.CatDayNavigation.restore();assert.equal(f.selected.length,count);
  f.setOpen(true);f.dispatch('pointerdown',22,130);f.dispatch('pointerup',22,130);
  assert.equal(f.selected.at(-1).minute,1080);
});
test('event guards work before the close MutationObserver callback',()=>{
  const f=fixture();f.dispatch('pointerdown',130,22);f.dispatch('pointermove',145,23);
  const count=f.selected.length;f.setOpen(false,false);
  assert.equal(f.dispatch('pointermove',238,130).prevented,0);
  f.dispatch('pointerup',238,130);assert.equal(f.selected.length,count);assert.deepEqual(f.released,[1]);
});
test('pagehide cancels contact and replay; pageshow restores only the observer',()=>{
  const f=fixture();f.dispatch('pointerdown',130,22);f.dispatch('pointermove',145,23);
  const count=f.selected.length;f.dispatch('pagehide');assert.equal(f.observerConnected,false);
  assert.deepEqual(f.released,[1]);assert.ok(f.replayStops.length);
  assert.equal(f.dispatch('pointermove',238,130).prevented,0);f.dispatch('pointerup',238,130);
  assert.equal(f.selected.length,count);f.dispatch('pageshow');assert.equal(f.observerConnected,true);
  f.dispatch('pointerdown',22,130);f.dispatch('pointerup',22,130);assert.equal(f.selected.at(-1).minute,1080);
});
test('future animation is cancelled immediately on close and pagehide',()=>{
  for(const event of ['close','pagehide']){
    const f=fixture();f.dispatch('pointerdown',22,130);f.dispatch('pointerup',22,130);
    assert.equal(f.cancelledFrames.length,0); /* future preview has one pending RAF */
    if(event==='close')f.setOpen(false);else f.dispatch('pagehide');
    assert.deepEqual(f.cancelledFrames,[1]);
    f.dispatch('pageshow');f.setOpen(true);f.dispatch('pointerdown',22,130);f.dispatch('pointerup',22,130);
    f.setOpen(false);assert.deepEqual(f.cancelledFrames,[1,1]);
  }
});
test('CSS allows center page pan-y, only transparent real tracks disable gestures',()=>{
  assert.match(css,/#lf-body \.lf-hero svg\.lf-ring\{touch-action:pan-y;/);
  assert.match(css,/\.day-ring-track\{touch-action:none;pointer-events:stroke;/);
  assert.doesNotMatch(css,/svg\.lf-ring\{touch-action:none/);
  assert.match(patched,/if\(!mini\)s\+=`<circle class="day-ring-track"/);
});
test('non-demo places always use real result, never empty-geo demo fallback',()=>{
  const code=section('L.places=()=>','L.place=id');
  for(const [demo,real] of [[false,[]],[false,[{id:'g1',real:true}]],[true,[]]]){
    const L={},DEMO_PLACES=[{id:'fake',name:'虚构'}];run(code,{L,cfg:{demo},names:{},geo:[],DEMO_PLACES,realPlaces:()=>real});
    assert.deepEqual(JSON.parse(JSON.stringify(L.places())),demo?[{id:'fake',name:'虚构'}]:real);
  }
});
test('both places views render truthful empty state, only real clusters get real-source label',()=>{
  for(const [demo,places,count,expected] of [
    [false,[],0,'还没有真实定位记录'],[false,[],3,'尚未识别出家以外'],
    [false,[{id:'real',name:'真实地点',icon:'📍',catSpot:'附近'}],3,'根据本机定位记录聚类'],
    [true,[{id:'demo',name:'虚构地点',icon:'📍',catSpot:'附近'}],0,'虚构地点 · 未采集真实位置']]){
    const L={cfg:{demo},places:()=>places,geoCount:()=>count,map:()=>({}),place:id=>places.find(p=>p.id===id)};
    const c=run(section('function places(){','function privacy(){')+';result=places();',{L,esc:String,petName:()=> '小猫'});
    assert.ok(c.result.includes(expected));
    const sec={innerHTML:'',querySelectorAll:()=>[]};
    run(section('  const fill=()=>{','  fill();L.on(')+';fill();',{L,sec,esc:String});
    assert.ok(sec.innerHTML.includes(demo?'虚构地点 · 未采集真实位置':places.length?'来自本机定位记录':'暂无可展示的真实地点'));
    if(!places.length){assert.match(c.result,/role="status"/);assert.match(sec.innerHTML,/role="status"/);assert.doesNotMatch(sec.innerHTML,/data-go=/);}
  }
});
test('missing place map is neutral, makes no procedural/decorate/tile call',()=>{
  const draws=[];const canvas={getContext:()=>({fillRect(){},fillText:text=>draws.push(text)}),setAttribute(){}};
  const L={};run(section('L.map=(p,','function decorate('),{L,document:{createElement:()=>canvas},procedural:()=>assert.fail('fake map'),decorate:()=>assert.fail('fake place')});
  assert.equal(L.map(undefined),canvas);assert.deepEqual(draws,['暂无可确认的地点']);
  assert.doesNotMatch(section('function drawStage(','let rep=0;'),/L\.place\('work'\)/);
});
test('archive retains yesterday save, bump and manual-history code but schedules no toast',()=>{
  const yesterday=new Date(Date.now()-864e5);const key=d=>`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  const saved=[],tracked=[];let bumped=0;const L={activeMins:d=>key(d)===key(yesterday)?[1]:[],moments:()=>[],place:()=>null,toast:()=>assert.fail('daily review push')};
  run(section('function archive(){','setTimeout(archive,3000);')+';archive();',{
    cfg:{demo:false,keepDays:7},L,geo:[],HKEY:'history',load:()=>[],save:(_,h)=>saved.push(h),dayKey:key,
    autoDay:()=>({wd:true,segs:[],steps:0}),KN:[],bump:()=>bumped++,gtrack:(...args)=>tracked.push(args),
    setTimeout:()=>assert.fail('automatic toast timer')
  });
  assert.equal(saved[0].length,1);assert.equal(saved[0][0].k,key(yesterday));assert.equal(bumped,1);assert.equal(tracked[0][0],'life_ring_auto');
  assert.match(patched,/L\.histView=k=>/);assert.match(patched,/data-hist="\$\{h\.k\}"/);
});
