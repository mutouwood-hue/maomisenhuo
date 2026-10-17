'use strict';
/* 试养埋点（PRD 第六章）行为回归：直接执行原型的埋点 IIFE，只替换浏览器宿主。
   覆盖 6.1 接入方式（?u= / ?ep= / 本机缓存 / 批量上报 / 导出）与 6.3 指标口径（D1、D7）。 */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../original/game.html'),'utf8');
const START=html.indexOf('(()=>{\n  /* ================= 试养埋点');
assert.ok(START>0,'埋点 IIFE 必须仍在原型内');
const CODE=html.slice(START,html.indexOf('</script>',START));

function harness({search='',stored={},petState=null}={}){
  const store=new Map(Object.entries(stored));
  const listeners={};
  const fetches=[];
  const clock={now:new Date('2026-10-17T02:00:00Z').getTime()};
  class FakeDate extends Date{constructor(...args){super(...(args.length?args:[clock.now]))}static now(){return clock.now}}
  let beaconResult=true;
  const document={
    hidden:false,visibilityState:'visible',
    addEventListener(type,fn){(listeners[type]=listeners[type]||[]).push(fn)},
    getElementById:()=>null,
    createElement:()=>({click(){}}),
    referrer:''
  };
  const navigator={userAgent:'node-test',sendBeacon:(url,blob)=>{fetches.push({url,blob,beacon:true});return beaconResult}};
  const timers={intervals:[]};
  const ctx={
    window:null,document,navigator,
    localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))},
    location:{search},
    URLSearchParams,
    crypto:{randomUUID:()=>'uuid-fixed-0001'},
    matchMedia:()=>({matches:false}),
    setInterval:(fn,ms)=>{timers.intervals.push({fn,ms});return timers.intervals.length},
    setTimeout:(fn,ms)=>1,
    clearTimeout(){},
    fetch:(url,opts)=>{fetches.push({url,opts});return Promise.resolve({ok:true})},
    Blob:function(parts,opts){this.parts=parts;this.opts=opts;},
    URL:{createObjectURL:()=>'blob:x',revokeObjectURL(){}},
    Date:FakeDate,Math,JSON,Object,Array,Map,Set,Number,String,Boolean,Error,Promise,console,structuredClone
  };
  ctx.addEventListener=(type,fn)=>{(listeners[type]=listeners[type]||[]).push(fn)};
  ctx.window=ctx;
  ctx.globalThis=ctx;
  if(petState)ctx.__petGame={state:()=>petState};
  vm.runInNewContext(CODE,ctx,{filename:'game.html#trial-analytics'});
  const fire=(type,event={})=>(listeners[type]||[]).forEach(fn=>fn(event));
  return {ctx,api:ctx.__petAnalytics,store,fetches,clock,document,fire,listeners,beacon:v=>{beaconResult=v},
    timerByInterval:ms=>timers.intervals.find(t=>t.ms===ms)?.fn};
}

test('链接参数记住受试者编号与接收地址，并写入首开事件',()=>{
  const h=harness({search:'?u=T01&ep=https%3A%2F%2Fexample.test%2Fingest'});
  assert.equal(h.store.get('pet-ana-pid'),'T01');
  assert.equal(h.store.get('pet-ana-endpoint'),'https://example.test/ingest');
  const first=h.api.queue[0];
  assert.equal(first.n,'app_open');
  assert.equal(first.p.first,true);
  assert.equal(first.p.entry,'launch');
  assert.equal(h.api.summary().pid,'T01');
});

test('本机队列上限 3000 条，超出只保留最新',()=>{
  const seeded=Array.from({length:3000},(_,i)=>({n:'seeded',t:0,d:0,s:'s',p:{i}}));
  const h=harness({stored:{'pet-ana-queue':JSON.stringify(seeded)}});
  h.api.track('care_done',{action:'feed'});
  const q=h.api.queue;
  assert.equal(q.length,3000);
  assert.equal(q[q.length-1].n,'care_done');
  // 载入时 openSession 先写入 app_open，已挤掉 1 条；再 track 1 条又挤掉 1 条。
  assert.equal(q.filter(e=>e.n==='seeded').length,2998,'最旧的记录应被挤掉');
  assert.equal(h.api.summary().pendingEvents,3000);
});

test('满 20 条按 text/plain 批量上报，成功后出队',async()=>{
  const h=harness({search:'?ep=https://example.test/ingest'});
  // 打开时本来就有 1 条 app_open，再补 18 条到 19 条不发送。
  for(let i=0;i<18;i++)h.api.track('care_done',{action:'feed',i});
  assert.equal(h.api.queue.length,19);
  assert.equal(h.fetches.length,0,'不满 20 条不发送');
  h.api.track('care_done',{action:'feed',last:true});
  await Promise.resolve();
  assert.equal(h.fetches.length,1);
  const sent=h.fetches[0];
  assert.equal(sent.url,'https://example.test/ingest');
  assert.equal(sent.opts.headers['Content-Type'],'text/plain');
  const body=JSON.parse(sent.opts.body);
  assert.equal(body.v,1);
  assert.equal(body.events.length,20);
  await new Promise(r=>setImmediate(r));
  assert.equal(h.api.queue.length,0,'成功上报后队列应被清空');
});

test('离开页面补发用 sendBeacon，会话结束事件随补发一起送出',()=>{
  const h=harness({search:'?ep=https://example.test/ingest'});
  h.api.track('care_done',{action:'feed'});
  h.document.hidden=true;
  h.fire('visibilitychange');
  assert.equal(h.fetches.length,1);
  assert.equal(h.fetches[0].beacon,true);
  const sent=JSON.parse(h.fetches[0].blob.parts[0]);
  assert.ok(sent.events.some(e=>e.n==='session_end'),'补发内容应含 session_end');
  assert.ok(sent.events.some(e=>e.n==='care_done'));
});

test('会话口径：30 分钟内回前台记 app_foreground，超过 30 分钟重开 app_open',()=>{
  const h=harness();
  h.document.hidden=true;h.fire('visibilitychange');
  let names=h.api.queue.map(e=>e.n);
  assert.ok(names.includes('session_end'));
  h.clock.now+=10*60e3;h.document.hidden=false;h.fire('visibilitychange');
  assert.ok(h.api.queue.map(e=>e.n).includes('app_foreground'));
  h.document.hidden=true;h.fire('visibilitychange');
  h.clock.now+=45*60e3;h.document.hidden=false;h.fire('visibilitychange');
  const opens=h.api.queue.filter(e=>e.n==='app_open');
  assert.equal(opens.length,2,'超过 30 分钟算新一次打开');
});

test('D1 / D7 按天序号计算，导出汇总含事件计数',()=>{
  const first=new Date('2026-10-17T00:00:00Z').getTime();
  const h=harness({stored:{'pet-ana-first':String(first),'pet-ana-days':'[0,1,7]','pet-ana-pid':'T07'}});
  h.api.track('care_done',{action:'feed'});
  const s=h.api.summary();
  assert.equal(s.retainedD1,true);
  assert.equal(s.retainedD7,true);
  assert.deepEqual(s.activeDays.slice().sort((a,b)=>a-b),[0,1,7]);
  assert.equal(s.eventCounts.care_done,1);
  assert.equal(s.pid,'T07');
  assert.equal(typeof s.standaloneNow,'boolean');
});

test('业务事件由存档差分识别，不侵入原逻辑',()=>{
  const base={ready:true,pet:{cats:[{id:'c1',counts:{feed:0},stage:'kitten',breed:'orange',outfit:'none',health:100,healthIssue:null}],
    wardrobe:[],world:{completed:{}},journal:[],goals:[],activeCatId:'c1',coins:10,stats:{}},family:{babiesBorn:0}};
  const h=harness({petState:base});
  // 找到原型注册的 2 秒差分周期，用它本身跑两次：第一次建基线，第二次识别变化。
  const tick=h.timerByInterval(2000);
  assert.equal(typeof tick,'function','原型应注册 2 秒存档差分周期');
  tick();
  const before=h.api.queue.length;
  const next=structuredClone(base);
  next.pet.cats[0].counts.feed=2;next.pet.cats[0].stage='teen';next.pet.wardrobe=['bow'];
  h.ctx.__petGame.state=()=>next;
  tick();
  const added=h.api.queue.slice(before).map(e=>e.n);
  assert.equal(added.filter(n=>n==='care_done').length,2,'两次喂食应计两条 care_done');
  assert.ok(added.includes('stage_up'));
  assert.ok(added.includes('outfit_buy'));
});
