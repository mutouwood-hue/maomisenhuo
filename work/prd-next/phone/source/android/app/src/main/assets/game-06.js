
/* 10-room.js */
/* ===== v5 房间：照料视角 / 头顶气泡 / 随机怪行为 ===== */
(()=>{
const $=id=>document.getElementById(id);
const mq=matchMedia('(max-width:600px)');
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const track=(n,p)=>{try{window.__petAnalytics?.track(n,p)}catch(e){}};
const R=()=>window.__pgRoom;
const game=()=>window.__petGame;
const ease=t=>{t=t<0?0:t>1?1:t;return t*t*(3-2*t)};
const SC={kitten:.64,baby:.64,young:.82,adult:1};
const L=window.__pgLife=window.__pgLife||{};
const V3=(x,y,z)=>{const C=R().cam.position.constructor;return new C(x,y,z)};
function homeVisible(){const h=$('home-scene');return h&&!h.hidden&&(document.body.dataset.view||'home')==='home'&&!document.hidden}
function overlayOpen(){return !!document.querySelector('#grad-ov.on,#life-ov.on')}
/* 世界坐标 → 屏幕坐标 */
function toScreen(v){const r=R(),p=r.proj(v),b=r.canvas.getBoundingClientRect();return {x:b.left+p.x*b.width,y:b.top+p.y*b.height,b}}
function headTop(){const r=R(),h=r.bones.get('head'),w=h.getWorldPosition(V3());w.y+=4.6*(SC[r.stage]||1);return w}
L.room={toScreen,headTop,homeVisible};

/* ---------------- 1. 照料视角：自动定位到小猫背后 ---------------- */
/* t=镜头看向的点，o=镜头相对偏移（竖屏基准，横屏放大） */
const PRESET={
  drink:{t:[18.8,1.5,-10.5],o:[15,22,6.5]},
  feed:{t:[12.2,1.5,-10.3],o:[15,22,6.5]},
  bath:{t:[-10.8,2.5,-4.5],o:[24,17,-7]},
  climb:{t:[8,6,4],o:[-4,16,-30]},
  tease:{t:[-1,3,-5],o:[7,13,-25]}
};
const CAM={on:null,saved:null,limits:null,anim:null,alt:0};
function relax(){const c=R().ctl;if(!CAM.limits)CAM.limits={minAzimuthAngle:c.minAzimuthAngle,maxAzimuthAngle:c.maxAzimuthAngle,minPolarAngle:c.minPolarAngle,maxPolarAngle:c.maxPolarAngle,minDistance:c.minDistance,maxDistance:c.maxDistance};Object.assign(c,{minAzimuthAngle:-Infinity,maxAzimuthAngle:Infinity,minPolarAngle:.25,maxPolarAngle:1.5,minDistance:6,maxDistance:140})}
function restore(){if(CAM.limits){Object.assign(R().ctl,CAM.limits);CAM.limits=null}}
function fly(p,t,dur,done){const r=R();CAM.anim={p0:r.cam.position.clone(),t0:r.ctl.target.clone(),p1:p,t1:t,s:performance.now(),d:reduce.matches?1:dur,done}}
function presetPose(name,alt){
  const pr=PRESET[name];if(!pr)return null;
  const k=R().cam.aspect<1.12?1:1.75;
  let [ox,oy,oz]=pr.o;
  const rot=a=>{const c=Math.cos(a),s=Math.sin(a);[ox,oz]=[ox*c-oz*s,ox*s+oz*c]};
  if(alt===1)rot(.62);if(alt===2)rot(-.62);
  ox*=k;oy*=k;oz*=k;const t=V3(...pr.t);
  /* 不穿墙：后墙 z=23、左墙 x=-24.5；被墙挡住就收近、抬高 */
  let f=1;if(t.z+oz>20.5)f=Math.min(f,(20.5-t.z)/oz);if(t.x+ox<-22.5)f=Math.min(f,(-22.5-t.x)/ox);
  if(f<1){ox*=f;oz*=f;oy*=1+(1-f)*.9}
  return {t,p:V3(t.x+ox,t.y+oy,t.z+oz)};
}
function camBegin(name){
  if(!PRESET[name])return;
  const r=R();CAM.on=name;CAM.alt=0;
  if(!CAM.saved)CAM.saved={p:r.cam.position.clone(),t:r.ctl.target.clone()};
  relax();const ps=presetPose(name,0);fly(ps.p,ps.t,1300);
  track('care_camera',{action:name});
}
function camCycle(){
  if(!CAM.on)return;CAM.alt=(CAM.alt+1)%4;
  if(CAM.alt===3&&CAM.saved){fly(CAM.saved.p.clone(),CAM.saved.t.clone(),900);return}
  const ps=presetPose(CAM.on,CAM.alt);fly(ps.p,ps.t,900);
}
function camEnd(){
  CAM.on=null;const s=CAM.saved;CAM.saved=null;
  if(!s){restore();return}
  fly(s.p,s.t,1100,restore);
}
/* 照料中：单指留给照料操作，双指拖动转视角 */
let two=null;
function bindTwoFinger(cv){
  cv.addEventListener('touchstart',e=>{if(!CAM.on||e.touches.length!==2)return;const a=e.touches[0],b=e.touches[1];two={x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2};CAM.anim=null},{passive:true});
  cv.addEventListener('touchmove',e=>{
    if(!CAM.on||!two||e.touches.length!==2)return;e.preventDefault();
    const a=e.touches[0],b=e.touches[1],x=(a.clientX+b.clientX)/2,y=(a.clientY+b.clientY)/2;
    const r=R(),t=r.ctl.target,p=r.cam.position,dx=x-two.x,dy=y-two.y;two={x,y};
    const ox=p.x-t.x,oz=p.z-t.z,ang=-dx*.008,c=Math.cos(ang),s=Math.sin(ang);
    p.x=t.x+ox*c-oz*s;p.z=t.z+ox*s+oz*c;p.y=Math.max(t.y+3,Math.min(t.y+40,p.y+dy*.06));
  },{passive:false});
  cv.addEventListener('touchend',e=>{if(e.touches.length<2)two=null},{passive:true});
}

/* ---------------- 2. 头顶冒出的行动气泡（替代底部互动面板） ---------------- */
const ICON={feed:'🍚',drink:'💧',bath:'🫧',climb:'🐾',tease:'🪶',pet:'💗',sleep:'💤',play:'🐟',clinic:'🩺'};
const think=document.createElement('div');
think.id='pg-think';think.hidden=true;think.setAttribute('role','status');think.setAttribute('aria-live','polite');
think.innerHTML='<i class="d1"></i><i class="d2"></i><i class="d3"></i><div class="pg-bub"><div class="pg-ring"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" class="bg"/><circle cx="20" cy="20" r="17" class="fg" pathLength="100"/></svg><span class="pg-ico"></span></div><div class="pg-txt"><b></b><span></span></div><div class="pg-tools"><button type="button" data-a="view" title="换个视角">🎥</button><button type="button" data-a="rest">先休息</button></div></div><div class="pg-tip">双指拖动可以转视角</div>';
document.body.appendChild(think);
think.addEventListener('click',e=>{const b=e.target.closest('button[data-a]');if(!b)return;
  if(b.dataset.a==='rest')$('cancel-interaction')?.click();
  if(b.dataset.a==='view'){camCycle();track('care_camera_cycle',{action:CAM.on,alt:CAM.alt})}});
let lastMsg='',lastAct='',tipShown=0;
function updThink(){
  const panel=$('interaction-panel');const busy=panel&&!panel.hidden;
  if(!busy||!R()||!homeVisible()){if(!think.hidden){think.hidden=true;lastMsg=''}return}
  const act=R().act?.name||lastAct;lastAct=act;
  const msg=$('interaction-message').textContent.trim(),pct=+($('interaction-fill').getAttribute('aria-valuenow')||0);
  think.querySelector('.pg-ico').textContent=ICON[act]||'🐾';
  think.querySelector('.pg-txt b').textContent=$('interaction-title').textContent+' · '+pct+'%';
  if(msg!==lastMsg){lastMsg=msg;think.querySelector('.pg-txt span').textContent=msg;think.classList.remove('pop');void think.offsetWidth;think.classList.add('pop')}
  think.querySelector('.fg').style.strokeDasharray=pct+' 100';
  think.querySelector('[data-a=view]').hidden=!CAM.on;
  if(think.hidden){think.hidden=false;tipShown=performance.now()}
  think.classList.toggle('tip',!!CAM.on&&mq.matches&&performance.now()-tipShown<4500&&!localStorage.getItem('pg-tip2'));
  /* 位置：从猫头顶向上冒，靠右时镜像 */
  const s=toScreen(headTop()),Wd=innerWidth,H=innerHeight,bub=think.querySelector('.pg-bub'),bw=bub.offsetWidth||220,bh=bub.offsetHeight||70;
  const flip=s.x>Wd*.56;
  const minTop=mq.matches?122:64;
  let hx=Math.max(20,Math.min(Wd-20,s.x)),hy=Math.max(minTop+bh+40,Math.min(H-90,s.y));
  let bx=flip?hx-30-bw:hx+30-36;bx=Math.max(10,Math.min(Wd-bw-10,bx));
  let by=Math.max(minTop,hy-46-bh);
  /* 避开要点击的目标（水碗、食盆、平台等） */
  try{const tg=game().state().room?.interaction?.targets||[],cb=R().canvas.getBoundingClientRect();
    tg.forEach(t=>{const tx=cb.left+t.x*cb.width,ty=cb.top+t.y*cb.height;if(tx>bx-30&&tx<bx+bw+30&&ty>by-30&&ty<by+bh+30){by=ty-bh-44<minTop?Math.min(H-bh-100,ty+44):ty-bh-44}})}catch{}
  bub.style.left=bx+'px';bub.style.top=by+'px';
  const ex=Math.max(bx+18,Math.min(bx+bw-18,hx+(flip?-24:24))),ey=by+bh;
  [.2,.48,.76].forEach((f,i)=>{const d=think.querySelector('.d'+(i+1));d.style.left=(hx+(ex-hx)*f)+'px';d.style.top=(hy+(ey-hy)*f)+'px'});
  const tip=think.querySelector('.pg-tip');tip.style.left=(bx+bw/2)+'px';tip.style.top=(by-8)+'px';
}
setTimeout(()=>{},0);

/* ---------------- 3. 随机怪行为：头顶冒图标，然后做出很猫的事 ---------------- */
const emo=document.createElement('button');emo.type='button';emo.id='pg-emote';emo.hidden=true;emo.setAttribute('aria-label','小猫头顶冒出的心情，点一下接住');document.body.appendChild(emo);
const cap=document.createElement('div');cap.id='pg-qcap';cap.hidden=true;document.body.appendChild(cap);
const sunFx=document.createElement('div');sunFx.id='pg-sunfx';sunFx.hidden=true;document.body.appendChild(sunFx);
const QK_KEY='pg-quirks-v1';
const book=(()=>{try{return JSON.parse(localStorage.getItem(QK_KEY))||{}}catch{return{}}})();
const saveBook=()=>{try{localStorage.setItem(QK_KEY,JSON.stringify(book))}catch{}};
const yawTo=(dx,dz)=>Math.atan2(-dx,-dz);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const W=(x,z,sp=5)=>({k:'walk',x,z,sp});
const Pz=(d,fn,o={})=>({k:'pose',d,fn,...o});
const QUIRKS=[
 {id:'zoomies',icon:'❗',name:'暴冲跑酷',cap:'突然像被按了加速键，满屋子狂奔！',log:'毫无征兆地满屋子暴冲了一圈，跑完一脸若无其事。',
  steps:()=>[W(5,-6,13),W(6,5,14),W(-3,9,14),W(-5,-4,14),W(3,-7,13),W(0,-3,9),Pz(1.8,(t,c)=>{c.anim('paw',t);c.yaw(0,t/.4);c.head.rotation.y+=.5;c.head.rotation.x-=.35},{cap:'跑完了，舔舔爪子装没事。'})]},
 {id:'sunbath',icon:'☀️',name:'追着阳光躺',cap:'发现地板上有一块暖暖的阳光。',log:'追着窗边的小太阳躺了好久，眯成了一条缝。',sun:[-1,.3,7.5],
  steps:()=>[W(-1,7,4.5),Pz(7,(t,c)=>{const k=ease(t/.8);c.anim('idle',0);c.yaw(Math.PI*.8,t/.8);c.crouch(.9*k,2.6);c.eyes(.85*k);c.body.rotation.z+=.3*k;c.tail.rotation.z+=Math.sin(t*1.6)*.25;c.hearts('heart',.35,t)},{cap:'晒得眯起眼睛，暖洋洋的。'}),W(0,-3,4)]},
 {id:'stare',icon:'❓',name:'盯着空气',cap:'盯着墙角一动不动……那里有什么？',log:'对着空无一物的墙角盯了很久，然后若有所思地走开了。',
  steps:()=>[Pz(1.2,(t,c)=>{c.anim('idle',0);c.yaw(yawTo(-20,26),t/1.2)}),Pz(4.8,(t,c)=>{c.anim('idle',0);c.yaw(yawTo(-20,26),1);c.head.rotation.x+=.22;c.head.rotation.z+=Math.sin(t*.9)*.25;c.ears(.3)},{cap:'……（盯）'}),Pz(1.2,(t,c)=>{c.anim('idle',0);c.yaw(0,t/1.2)},{cap:'什么都没有。好吧。'})]},
 {id:'chase',icon:'🌀',name:'追自己的尾巴',cap:'尾巴！是谁的尾巴！',log:'和自己的尾巴转圈大战三回合，最后头晕坐下了。',
  steps:()=>[Pz(3.2,(t,c)=>{c.anim('walk',t*2.4);c.V.rotation.y=t*7.5;c.head.rotation.y+=.5;c.tail.rotation.y+=.8}),Pz(1.8,(t,c)=>{c.anim('idle',0);c.yaw(0,t/1.2);c.body.rotation.z+=Math.sin(t*6)*.12*(1.8-t);c.head.rotation.z+=Math.sin(t*5)*.25*(1.8-t)},{cap:'晕乎乎……'})]},
 {id:'hunt',icon:'👀',name:'屁股扭扭准备扑',cap:'压低身子，屁股扭扭，锁定目标！',log:'对着地板上的一粒灰尘扭了半天屁股，然后一个飞扑。',
  steps:()=>[Pz(1,(t,c)=>{c.anim('idle',0);c.yaw(yawTo(4,-4),t)}),Pz(2.6,(t,c)=>{c.anim('idle',0);c.crouch(.55,2.4);c.body.rotation.y+=Math.sin(t*14)*.16;c.tail.rotation.z+=Math.sin(t*14)*.4;c.head.rotation.x+=.1}),
   Pz(.75,(t,c)=>{const k=t/.75;c.anim('walk',t);c.V.position.x=4*ease(k);c.V.position.z=-3-4*ease(k);c.V.position.y=.22+Math.sin(k*Math.PI)*3.2;c.legs(.6)},{cap:'扑！'}),
   Pz(1.4,(t,c)=>{c.anim('idle',0);c.V.position.set(4,.22,-7);c.head.rotation.y+=Math.sin(t*4)*.4},{cap:'……抓到了空气。'}),W(0,-3,4)]},
 {id:'knock',icon:'😼',name:'推落小东西',cap:'看着你，慢慢伸出了爪子……',log:'当着你的面，把一个小积木一点点推远了，眼神毫无愧疚。',prop:true,
  steps:()=>[Pz(1,(t,c)=>{c.anim('idle',0);c.yaw(yawTo(2.6,1.4),t)}),Pz(1.6,(t,c)=>{c.anim('idle',0);c.head.rotation.y-=.7*ease(t/.5)},{cap:'（盯着你）'}),
   Pz(2.4,(t,c)=>{c.anim('paw',t*1.3);c.head.rotation.y-=.7;if(t>1.1)c.push(t-1.1)},{cap:'啪嗒。'}),Pz(1.2,(t,c)=>{c.anim('idle',0);c.yaw(0,t/1.2)})]},
 {id:'groom',icon:'👅',name:'突然开始舔毛',cap:'正陪你玩呢，忽然开始认真舔毛。',log:'玩到一半忽然开始舔毛，仿佛这才是今天最重要的事。',
  steps:()=>[Pz(4.5,(t,c)=>{c.anim('paw',t*1.4);c.crouch(.25,2);c.head.rotation.y+=.85;c.head.rotation.x-=.45+Math.sin(t*9)*.08})]},
 {id:'loaf',icon:'🍞',name:'变成一条面包',cap:'把手手揣起来，变成了一条猫猫面包。',log:'把爪爪揣起来，变成了一条安静的猫猫面包。',
  steps:()=>[Pz(6.5,(t,c)=>{const k=ease(t/.9);c.anim('idle',0);c.crouch(1*k,2.9);c.eyes(.55*k+(t>3?.35:0));c.paws(k)},{cap:'揣手手，眯眯眼。'})]},
 {id:'spook',icon:'💥',name:'被自己吓到',cap:'被自己的影子吓了一大跳！',log:'被自己的影子吓得原地弹起来，然后假装什么都没发生。',
  steps:()=>[Pz(.7,(t,c)=>{const k=t/.7;c.anim('idle',0);c.V.position.z=-3+2.2*ease(k);c.V.position.y=.22+Math.sin(k*Math.PI)*4;c.tail.rotation.x-=1;c.ears(1)}),Pz(1.6,(t,c)=>{c.anim('idle',0);c.V.position.set(0,.22,-.8);c.tail.rotation.x-=.8;c.ears(.6)},{cap:'……我什么都没看到。'}),W(0,-3,3)]}
];
const Q={on:false,cur:null,steps:[],i:0,t:0,anim:0,y0:0,next:performance.now()+20000,prop:null};
window.__pgQuirk=Q;
function ctx(){
  const r=R(),b=r.bones,V=r.cat;
  return {r,V,body:b.get('body'),head:b.get('head'),tail:b.get('tail_base'),
    anim:(n,t)=>r.anim(n,t),crouch:(v,d)=>r.crouch(v,d),eyes:v=>r.eyes(v),hearts:(k,v,t)=>r.hearts(k,v,t),
    yaw:(y,k)=>{V.rotation.y=Q.y0+wrap(y-Q.y0)*ease(k)},
    ears:v=>{['ear_left','ear_right'].forEach((n,i)=>{const e=b.get(n);if(e)e.rotation.z+=(i?-1:1)*.5*v})},
    legs:v=>{['front_left','front_right','back_left','back_right'].forEach((n,i)=>{const e=b.get(n);if(e)e.rotation.x+=(i<2?-1:1)*v})},
    paws:v=>{['front_left','front_right'].forEach(n=>{const e=b.get(n);if(e)e.rotation.x-=1.25*v})},
    push:t=>pushProp(t)};
}
/* 小积木道具（克隆房间已有方块网格的构造器） */
function makeProp(){
  const r=R();let src=null;r.scene.traverse(o=>{if(!src&&o.isMesh&&o.geometry?.type==='BoxGeometry'&&o.material?.color)src=o});
  if(!src)return null;const m=new src.constructor(new src.geometry.constructor(1.1,1.1,1.1),src.material.clone());
  m.material.color.set('#e98a7a');m.castShadow=true;m.position.set(2.6,.75,1.4);r.scene.add(m);return m;
}
function pushProp(t){const p=Q.prop;if(!p)return;const k=Math.min(1,t/1.2);p.position.x=2.6+5*ease(k);p.position.z=1.4+2.6*ease(k);p.rotation.z=-k*5;p.rotation.y=k*2}
function startQuirk(id){
  const r=R();if(!r||r.act||Q.on)return false;
  const q=id?QUIRKS.find(x=>x.id===id):pickQuirk();if(!q)return false;
  Q.cur=q;Q.steps=[{k:'emote',d:1.3},...q.steps()];Q.i=0;Q.t=0;Q.anim=0;Q.y0=0;Q.caught=false;
  if(q.prop)Q.prop=makeProp();
  emo.textContent=q.icon;emo.hidden=false;emo.className='';void emo.offsetWidth;emo.className='pop';
  setCap(q.cap);Q.on=true;
  const amb=$('ambient-status');if(amb)amb.textContent=q.name+'中…';
  const first=!book[q.id],today=new Date().toDateString();
  book[q.id]={...(book[q.id]||{}),n:(book[q.id]?.n||0)+1,first:book[q.id]?.first||Date.now(),last:Date.now()};
  if(book[q.id].logDay!==today){book[q.id].logDay=today;try{game().store.lifeLog?.('quirk',`${game().state().pet.name}${q.log}`)}catch{}}
  saveBook();
  if(first)L.toast?.(`新发现猫猫怪行为：${q.icon} ${q.name}（${Object.keys(book).length}/${QUIRKS.length}）`);
  L.moment?.({type:'quirk',icon:q.icon,label:q.name,heart:2});
  track('quirk_start',{id:q.id,first});
  return true;
}
function pickQuirk(){
  const h=new Date().getHours();let pool=QUIRKS.slice();
  if(h>=7&&h<17)pool.push(QUIRKS[1],QUIRKS[1]);
  if(h>=21||h<6)pool.push(QUIRKS[0],QUIRKS[0],QUIRKS[3]);
  const unseen=pool.filter(q=>!book[q.id]);if(unseen.length&&Math.random()<.5)pool=unseen;
  return pool[Math.floor(Math.random()*pool.length)];
}
function setCap(t){cap.textContent=t||'';cap.hidden=!t}
function endQuirk(cancel){
  const q=Q.cur;Q.on=false;Q.cur=null;emo.hidden=true;setCap('');sunFx.hidden=true;
  if(Q.prop){const p=Q.prop;Q.prop=null;setTimeout(()=>{p.parent?.remove(p);p.geometry.dispose();p.material.dispose()},cancel?0:2500)}
  const r=R();if(r&&!r.act){r.cat.position.copy(r.home);r.cat.rotation.set(0,0,0)}
  Q.next=performance.now()+(35+Math.random()*45)*1000;
  if(q)track('quirk_end',{id:q.id,cancel:!!cancel,caught:!!Q.caught});
}
/* 由游戏渲染循环在“闲时分支”里每帧调用 */
Q.tick=(dt,pt)=>{
  const r=R();if(!r||!Q.cur){Q.on=false;return}
  const c=ctx(),st=Q.steps[Q.i];if(!st){endQuirk();return}
  Q.t+=dt;
  if(st.k==='emote'){c.anim('idle',pt);c.head.rotation.x+=.14*Math.sin(Math.min(1,Q.t/.35)*Math.PI);c.ears(.4)}
  else if(st.k==='walk'){
    const V=r.cat,dx=st.x-V.position.x,dz=st.z-V.position.z,d=Math.hypot(dx,dz);
    const sc=SC[r.stage]||1;Q.anim+=dt*st.sp/(4.7*sc);c.anim('walk',Q.anim);
    V.rotation.y+=wrap(yawTo(dx,dz)-V.rotation.y)*Math.min(1,dt*10);V.position.y=.22;
    const stp=Math.min(d,st.sp*dt);if(d>1e-3){V.position.x+=dx/d*stp;V.position.z+=dz/d*stp}
    if(d<.05){V.position.x=st.x;V.position.z=st.z;nextStep()}
    return;
  }
  else if(st.k==='pose')st.fn(Q.t,c);
  if(Q.t>=st.d)nextStep();
};
function nextStep(){
  const r=R();Q.i++;Q.t=0;Q.y0=r.cat.rotation.y;const st=Q.steps[Q.i];
  if(Q.i===1)emo.classList.add('out');
  if(st?.cap)setCap(st.cap);
  if(Q.cur?.sun)sunFx.hidden=!(st&&st.k==='pose');
  if(!st)endQuirk();
}
emo.addEventListener('click',()=>{
  if(!Q.cur||Q.caught)return;Q.caught=true;
  try{game().store.lifeLog?.('quirk',`你接住了${game().state().pet.name}头顶冒出的${Q.cur.icon}，它愣了一下，蹭了蹭你。`,2)}catch{}
  emo.classList.add('got');
  L.moment?.({type:'catch',icon:Q.cur.icon,label:'接住了「'+Q.cur.name+'」',heart:3});
  track('quirk_catch',{id:Q.cur.id});
});
let lastUser=performance.now();
['pointerdown','keydown'].forEach(e=>addEventListener(e,ev=>{if(ev.target!==emo)lastUser=performance.now()},true));
function updQuirk(now){
  const r=R();if(!r)return;
  if(Q.on&&(r.act||!homeVisible()||overlayOpen())){endQuirk(true);return}
  if(Q.on){
    const s=toScreen(headTop());emo.style.left=s.x+'px';emo.style.top=s.y+'px';
    if(!cap.hidden){cap.style.left=Math.max(100,Math.min(innerWidth-100,s.x))+'px';cap.style.top=Math.max(mq.matches?126:70,s.y-(emo.classList.contains('out')?24:78))+'px'}
    if(!sunFx.hidden&&Q.cur?.sun){const p=toScreen(V3(...Q.cur.sun));sunFx.style.left=p.x+'px';sunFx.style.top=p.y+'px'}
    return;
  }
  if(now<Q.next||r.act||!homeVisible()||overlayOpen()||reduce.matches||r.cat.visible===false)return;
  if(game()?.state().pet?.busy||now-lastUser<9000){Q.next=now+6000;return}
  startQuirk();
}
/* 语音/生活同步触发的小回应（不计入图鉴） */
function react(icon,text){
  const r=R();if(!r||r.act||!homeVisible()||r.cat.visible===false)return false;if(Q.on)endQuirk(true);
  Q.cur={id:'react',icon,name:'回应',cap:text};Q.steps=[{k:'emote',d:.9},Pz(2.6,(t,c)=>{c.anim('idle',0);c.head.rotation.z+=Math.sin(t*3)*.2;c.head.rotation.x+=.12;c.ears(.6);c.tail.rotation.z+=Math.sin(t*8)*.3;c.hearts('heart',.8,t)})];
  Q.i=0;Q.t=0;Q.anim=0;Q.y0=0;Q.caught=true;emo.textContent=icon;emo.hidden=false;emo.className='';void emo.offsetWidth;emo.className='pop';setCap(text);Q.on=true;return true;
}
L.quirk={start:startQuirk,list:QUIRKS,book,end:endQuirk,react};
window.__pgQuirkGo=id=>startQuirk(id);

/* ---------------- 主循环 ---------------- */
let wasAct='';
function loop(now){
  requestAnimationFrame(loop);
  const r=R();if(!r)return;
  if(!r.__pgBound){r.__pgBound=true;bindTwoFinger(r.canvas)}
  const a=r.act,key=a&&a.interactive?a.name:'';
  if(key!==wasAct){if(key)camBegin(key);else if(wasAct)camEnd();wasAct=key}
  if(CAM.anim){const A=CAM.anim,k=ease((now-A.s)/A.d);r.cam.position.lerpVectors(A.p0,A.p1,k);r.ctl.target.lerpVectors(A.t0,A.t1,k);if(k>=1){CAM.anim=null;A.done&&A.done()}}
  updThink();updQuirk(now);
}
requestAnimationFrame(loop);
const qp=new URLSearchParams(location.search).get('quirk');
if(qp)setTimeout(()=>{Q.next=Infinity;startQuirk(qp==='now'?null:qp)},2500);
L.cam={cycle:camCycle,state:()=>({...CAM})};
})();

/* 20-world.js */
/* ===== v5 户外：偶遇事件的画面表现（蝴蝶 / 失物小包 / 小雨） ===== */
(()=>{
const Wd=()=>window.__pgWorld;
const L=window.__pgLife=window.__pgLife||{};
const track=(n,p)=>{try{window.__petAnalytics?.track(n,p)}catch(e){}};
const ease=t=>{t=t<0?0:t>1?1:t;return t*t*(3-2*t)};
const ev={type:null,t0:0,choice:null,tc:0,props:[],saved:null,bfFrom:null};
L.hostWorldEvent=()=>({type:ev.type,choice:ev.choice});
const scene=document.getElementById('world-scene');
/* 2D 叠加层：雨丝 / 闪光 / 头顶图标 */
const cv=document.createElement('canvas');cv.id='pg-wfx';scene.appendChild(cv);
const g=cv.getContext('2d');
const emo=document.createElement('div');emo.id='pg-wemo';emo.hidden=true;scene.appendChild(emo);
function now(){return performance.now()/1000}
function V3(x,y,z){const C=Wd().cat.position.constructor;return new C(x,y,z)}
function fwd(){const y=Wd().cat.rotation.y;return V3(-Math.sin(y),0,-Math.cos(y))}
/* 方块小道具：借用户外场景已有网格的构造器 */
function boxSrc(){let s=null;Wd().scene.traverse(o=>{if(!s&&o.isMesh&&o.geometry?.type==='BoxGeometry'&&o.material?.color)s=o});return s}
function vox(parts){
  const w=Wd(),src=boxSrc();if(!src)return null;
  const grp=new w.cat.constructor();
  parts.forEach(([sx,sy,sz,x,y,z,col])=>{const m=new src.constructor(new src.geometry.constructor(sx,sy,sz),src.material.clone());m.material.color.set(col);m.position.set(x,y,z);m.castShadow=true;grp.add(m)});
  grp.scale.setScalar(2.1);w.scene.add(grp);ev.props.push(grp);return grp;
}
function flower(){return vox([[.28,1.7,.28,0,.85,0,'#6fa66a'],[.7,.22,.7,.55,1.75,0,'#f2a7b5'],[.7,.22,.7,-.55,1.75,0,'#f2a7b5'],[.7,.22,.7,0,1.75,.55,'#f2a7b5'],[.7,.22,.7,0,1.75,-.55,'#f2a7b5'],[.5,.3,.5,0,1.82,0,'#f6d36b'],[.7,.16,.4,.4,.6,0,'#7fb873']])}
function pouch(){return vox([[1.5,1.1,1.1,0,.55,0,'#b9824f'],[1.1,.35,.85,0,1.25,0,'#a06b3d'],[.35,.5,.35,0,1.6,0,'#e3b65a'],[.5,.3,.12,0,.7,.56,'#e8d1a6']])}
function cleanup(){
  ev.props.forEach(p=>{p.parent?.remove(p);p.traverse(o=>{o.geometry?.dispose();o.material?.dispose?.()})});ev.props=[];
  const w=Wd();if(ev.saved&&w){w.hemi.intensity=ev.saved.h;w.sun.intensity=ev.saved.s;w.scene.background.copy(ev.saved.bg);w.scene.fog?.color.copy(ev.saved.fog)}
  ev.saved=null;ev.type=null;ev.choice=null;emo.hidden=true;drops.length=0;g.clearRect(0,0,cv.width,cv.height);
}
/* 事件开始：由游戏偶遇逻辑调用 */
window.__pgWorldEvt=type=>{
  const w=Wd();if(!w)return;cleanup();
  ev.type=type;ev.t0=now();ev.choice=null;
  const c=w.cat.position,f=fwd(),side=V3(-f.z,0,f.x);
  if(type==='butterfly'){ev.flower=flower();ev.flower.position.copy(c).addScaledVector(f,5.5).addScaledVector(side,3);ev.flower.position.y=0;ev.bfFrom=w.bf.position.clone()}
  if(type==='lost-pouch'){ev.pouch=pouch();ev.pouch.position.copy(c).addScaledVector(f,5).addScaledVector(side,-4.5);ev.pouch.position.y=0;ev.pouch.rotation.y=.5}
  if(type==='rain'){ev.saved={h:w.hemi.intensity,s:w.sun.intensity,bg:w.scene.background.clone(),fog:(w.scene.fog?.color||w.scene.background).clone()}}
  emo.textContent={butterfly:'🦋','lost-pouch':'❗',rain:'💧'}[type]||'❗';emo.hidden=false;emo.className='pop';
  L.moment?.({type:'world',icon:{butterfly:'🦋','lost-pouch':'👛',rain:'🌧️'}[type],label:{butterfly:'出门偶遇蝴蝶','lost-pouch':'出门捡到小钱袋',rain:'出门遇到小雨'}[type],heart:2});
  track('world_event_fx',{type});
};
/* 记录玩家选择，播放结果 */
scene.addEventListener('click',e=>{const b=e.target.closest('.world-event-actions button[data-choice]');if(!b||!ev.type)return;ev.choice=b.dataset.choice;ev.tc=now();
  emo.textContent={butterfly:{care:'💗',safe:'🍃',coins:'💨'},'lost-pouch':{care:'💗',safe:'👀',coins:'✨'},rain:{safe:'🌳',care:'🧣',coins:'💦'}}[ev.type]?.[ev.choice]||'💗';emo.className='pop';
  setTimeout(()=>{if(ev.tc&&now()-ev.tc>=4.4)cleanup()},4600)},true);
/* 蝴蝶：飞来 → 停在花上 → 根据选择飞走 */
window.__pgBf=(E,cat,t)=>{
  if(ev.type!=='butterfly'||!ev.flower)return false;
  const top=ev.flower.position.clone();top.y=4.4;
  const T=now()-ev.t0;
  if(!ev.choice){
    const k=ease(T/2.4);E.position.lerpVectors(ev.bfFrom,top,k);E.position.y+=Math.sin(k*Math.PI)*3+(k>=1?Math.abs(Math.sin(t*2))*.25:0);
    return true;
  }
  const C=now()-ev.tc,head=cat.position.clone();head.y=5.5;
  if(ev.choice==='care'){const a=C*2.2,r=2.6;E.position.set(head.x+Math.cos(a)*r,head.y+1+Math.sin(C*3)*.6+C*.4,head.z+Math.sin(a)*r)}
  else if(ev.choice==='coins'){E.position.copy(top).add(V3(C*7,C*C*2.5+C*2,-C*5))}
  else{E.position.copy(top).add(V3(C*2,C*2.2,C*1.2))}
  return C<4.4;
};
/* 户外小猫的反应姿态 */
window.__pgWorldPose=(model,cat,t,walking)=>{
  if(!ev.type||walking)return;const b=model.bones,h=b.get('head');if(!h)return;
  const T=now()-ev.t0,C=ev.choice?now()-ev.tc:0;
  if(ev.type==='butterfly'){
    if(!ev.choice||ev.choice==='safe'){h.rotation.x-=.28*ease(T/1.5);b.get('tail_base')&&(b.get('tail_base').rotation.z+=Math.sin(t*3)*.3)}
    else if(ev.choice==='care'){h.rotation.x+=.25;h.rotation.y+=Math.sin(C*2.2)*.5}
    else{h.rotation.x+=.35;b.get('front_right')&&(b.get('front_right').rotation.x-=Math.max(0,Math.sin(C*9))*1.1)}
  }
  if(ev.type==='lost-pouch'){
    if(!ev.choice){const k=Math.sin(Math.min(1,T/3)*Math.PI);h.rotation.y+=(T<1.5?.6:-.9)*ease((T%1.5)/.5);}
    else{h.rotation.x+=.12}
  }
  if(ev.type==='rain'){
    ['ear_left','ear_right'].forEach((n,i)=>{const e=b.get(n);e&&(e.rotation.z+=(i?1:-1)*.5)});
    if(ev.choice!=='coins')h.rotation.x-=.18;
    if(!ev.choice&&Math.floor(T*1.3)%3===2){const bd=b.get('body');bd&&(bd.rotation.z+=Math.sin(t*40)*.06)}
    if(ev.choice==='care'){const bd=b.get('body');bd&&(bd.rotation.z+=Math.sin(C*30)*.05*Math.max(0,1-C))}
  }
};
/* 每帧：雨/闪光/图标位置/道具动画 */
const drops=[];
function frame(){
  requestAnimationFrame(frame);
  const w=Wd();if(!w||!ev.type)return;
  if(w.canvas.hidden){cleanup();return}
  if(!ev.choice&&ev.manual!==true&&w.ev.hidden&&now()-ev.t0>1.5){ev.choice='safe';ev.tc=now();setTimeout(()=>{if(ev.tc&&now()-ev.tc>=4.4)cleanup()},4600)}
  const r=w.canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);
  if(cv.width!==Math.round(r.width*dpr)){cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr)}
  g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,r.width,r.height);
  const T=now()-ev.t0,C=ev.choice?now()-ev.tc:0,P=v=>{const s=w.proj(v);return{x:s.x*r.width,y:s.y*r.height}};
  const head=w.cat.position.clone();head.y+=12;const hp=P(head);
  emo.style.left=hp.x+'px';emo.style.top=hp.y+'px';
  if(ev.type==='rain'){
    const k=ev.choice==='safe'?Math.max(0,1-C/3):ev.choice?Math.max(.25,1-C/5):Math.min(1,T/1.2);
    if(ev.saved){const s=ev.saved,m=Math.min(1,T/1.2)*(ev.choice?Math.max(0,1-C/4):1);w.hemi.intensity=s.h*(1-.38*m);w.sun.intensity=s.s*(1-.6*m);w.scene.background.copy(s.bg).lerp({r:.6,g:.68,b:.72,isColor:true},.55*m);w.scene.fog?.color.copy(w.scene.background)}
    while(drops.length<140*k)drops.push({x:Math.random()*r.width,y:Math.random()*r.height,v:420+Math.random()*260,l:10+Math.random()*12});
    if(drops.length>140*k)drops.length=Math.floor(140*k);
    g.strokeStyle='rgba(235,245,250,.75)';g.lineWidth=1.3;g.beginPath();
    drops.forEach(d=>{d.y+=d.v/60;d.x-=d.v/600;if(d.y>r.height){d.y=-20;d.x=Math.random()*r.width*1.1}g.moveTo(d.x,d.y);g.lineTo(d.x-1.6,d.y-d.l)});g.stroke();
    /* 地面涟漪 */
    const feet=P(w.cat.position.clone());g.strokeStyle='rgba(255,255,255,.55)';
    for(let i=0;i<6;i++){const ph=(T*1.1+i/6)%1,ang=i*1.7,R=30+i*9;g.globalAlpha=(1-ph)*k;g.beginPath();g.ellipse(feet.x+Math.cos(ang)*R,feet.y+8+Math.sin(ang)*R*.35,4+ph*16,(4+ph*16)*.35,0,0,Math.PI*2);g.stroke()}
    g.globalAlpha=1;
    if(ev.choice==='coins'&&C<3){for(let i=0;i<10;i++){const a=i/10*Math.PI*2,ph=(C*1.6+i*.13)%1;g.fillStyle=`rgba(200,230,240,${1-ph})`;g.beginPath();g.arc(feet.x+Math.cos(a)*ph*40,feet.y-Math.sin(ph*Math.PI)*26+4,2.5,0,Math.PI*2);g.fill()}}
  }
  if(ev.type==='lost-pouch'&&ev.pouch){
    const pp=ev.pouch.position.clone();pp.y=3.2;const s=P(pp);
    ev.pouch.position.y=ev.choice?0:Math.abs(Math.sin(T*2.4))*.18;
    if(ev.choice&&ev.choice!=='safe'){const k=ease(C/1.2);ev.pouch.scale.setScalar(Math.max(.001,1-k))}
    for(let i=0;i<5;i++){const ph=(T*.8+i/5)%1,a=i*1.26;g.fillStyle=`rgba(255,226,140,${(1-ph)*.95})`;star(s.x+Math.cos(a)*(14+ph*16),s.y-8-ph*20+Math.sin(a)*6,3+2*(1-ph))}
  }
  if(ev.type==='butterfly'&&ev.flower){
    const fp=ev.flower.position.clone();fp.y=4.2;const s=P(fp);
    ev.flower.rotation.z=Math.sin(T*1.6)*.05;
    if(!ev.choice&&T>2.4){for(let i=0;i<4;i++){const ph=(T*.6+i/4)%1;g.fillStyle=`rgba(255,240,180,${(1-ph)*.8})`;star(s.x+Math.sin(i*2+T)*14,s.y-ph*22,2.4)}}
    if(ev.choice==='care'&&C<3.5){const ph=C/3.5;g.font='16px system-ui';g.globalAlpha=1-ph;g.fillText('💗',hp.x+10,hp.y-10-ph*30);g.globalAlpha=1}
  }
}
function star(x,y,r){g.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,R=i%2?r*.4:r;g.lineTo(x+Math.cos(a)*R,y+Math.sin(a)*R)}g.closePath();g.fill()}
requestAnimationFrame(frame);
L.worldFx={state:()=>({type:ev.type,choice:ev.choice,props:ev.props.length})};
})();

/* 30-life-data.js */
/* ===== v5 生活同步：数据层（演示一天 / 定位采样 / 常去地点 / 风格化地图 / 像素猫） ===== */
(()=>{
const L=window.__pgLife=window.__pgLife||{};
const KEY={cfg:'pg-life-cfg',geo:'pg-life-geo',mom:'pg-life-moments',names:'pg-life-names',claim:'pg-life-claim'};
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const cfg=Object.assign({sync:false,geo:false,motion:false,voice:false,scene:false,keepDays:7,demo:true},load(KEY.cfg,{}));
L.cfg=cfg;L.saveCfg=()=>save(KEY.cfg,cfg);
L.store={load,save,KEY};
/* 活动类型 */
const KIND={
  sleep:{n:'睡觉',c:'#8f8bc4',i:'🌙'},home:{n:'在家',c:'#f0bf73',i:'🏠'},commute:{n:'通勤',c:'#9bb8cc',i:'🚇'},
  work:{n:'工作',c:'#6fa08b',i:'💼'},out:{n:'外出',c:'#e8907a',i:'📍'},move:{n:'运动',c:'#86c27e',i:'🏃'},none:{n:'未记录',c:'#e3ddd3',i:'·'}
};
L.KIND=KIND;
/* 小猫在同一时段做什么：主人在家它在家，主人出门它也出门 */
const CATDO={
  sleep:p=>({k:'sleep',t:'蜷在你脚边一起睡'}),
  home:p=>({k:'home',t:'在家陪着你'}),
  commute:p=>({k:'home',t:'趴在窗边目送你'}),
  work:p=>({k:'out',t:`跟去了「${p?.catSpot||'公司楼下的小花坛'}」`}),
  out:p=>({k:'out',t:`跟着你去了「${p?.catSpot||p?.name||'附近'}」`}),
  move:p=>({k:'out',t:`跟着你在「${p?.catSpot||p?.name||'步道'}」小跑`}),
  none:()=>({k:'none',t:'不知道它在干嘛'})
};
L.catDo=(seg)=>CATDO[seg.kind]?.(L.place(seg.place))||CATDO.none();
/* 演示地点（坐标为虚构示意） */
const DEMO_PLACES=[
  {id:'home',name:'家',kind:'home',icon:'🏠',lat:31.2252,lon:121.4446,catSpot:'家里的窗台'},
  {id:'work',name:'公司',kind:'work',icon:'💼',lat:31.2335,lon:121.4712,catSpot:'公司楼下的小花坛',base:'garden'},
  {id:'noodle',name:'巷口面馆',kind:'food',icon:'🍜',lat:31.2329,lon:121.4689,catSpot:'面馆门口的台阶',base:'garden'},
  {id:'cafe',name:'街角咖啡',kind:'cafe',icon:'☕',lat:31.2281,lon:121.4521,catSpot:'咖啡店的橱窗边',base:'garden'},
  {id:'river',name:'河边步道',kind:'park',icon:'🌿',lat:31.2219,lon:121.4495,catSpot:'河边步道的长椅下',base:'river'},
  {id:'park',name:'街心公园',kind:'park',icon:'🌳',lat:31.2203,lon:121.4402,catSpot:'公园草坪',base:'park'}
];
const names=load(KEY.names,{});
L.renamePlace=(id,n)=>{names[id]=n;save(KEY.names,names)};
/* 可复现的伪随机 */
function rng(seed){let s=seed>>>0||1;return()=>((s=Math.imul(s^s>>>15,1|s)+0x6D2B79F5|0,((s^s>>>14)>>>0)/4294967296))}
const dayKey=d=>`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
L.dayKey=dayKey;
function demoDay(date=new Date()){
  const r=rng(date.getFullYear()*1000+date.getMonth()*40+date.getDate()),j=n=>Math.round((r()-.5)*2*n);
  const wd=date.getDay()%6!==0,S=[];const add=(a,b,kind,place)=>{if(b>a)S.push({start:a,end:b,kind,place})};
  if(wd){
    const up=435+j(15),go=up+65+j(10),inn=go+38+j(6),lunch=725+j(10),back=lunch+55,off=1115+j(20),home1=off+38+j(6),evening=r()<.55?'cafe':'river',eve=home1+70+j(15),bed=1405+j(20);
    add(0,up,'sleep','home');add(up,go,'home','home');add(go,inn,'commute');add(inn,lunch,'work','work');add(lunch,back,'out','noodle');add(back,off,'work','work');add(off,home1,'commute');
    add(home1,eve,evening==='river'?'move':'out',evening);add(eve,bed,'home','home');add(bed,1440,'sleep','home');
    return {segs:S,steps:7200+Math.round(r()*3200),wd};
  }
  const up=560+j(25),out=850+j(30),back=out+150+j(30),bed=1430;
  add(0,up,'sleep','home');add(up,out,'home','home');add(out,out+40,'move','river');add(out+40,back,'out','park');add(back,bed,'home','home');add(bed,1440,'sleep','home');
  return {segs:S,steps:9000+Math.round(r()*5000),wd};
}
/* ---------- v7 真实定位：页面打开时每 5 分钟低频采样，过滤低精度点，识别停留 / 常去地点 / 家与公司，本机保存 ---------- */
let geo=load(KEY.geo,[]);let watchId=null,pollT=0;L.geoLast=null;
const ACC_MAX=300,POLL=5*60e3;
const gtrack=(n,p)=>{try{window.__petAnalytics?.track(n,p)}catch(e){}};
let memo={},ver=0;const bump=()=>{ver++;memo={}};L.bump=bump;
function pruneGeo(){const lim=Date.now()-cfg.keepDays*864e5;geo=geo.filter(g=>g.t>lim).slice(-4000);save(KEY.geo,geo)}
function addSample(p){const c=p.coords,now=Date.now();L.geoLast={t:now,acc:Math.round(c.accuracy),ok:c.accuracy<=ACC_MAX};
  if(!(c.accuracy<=ACC_MAX)){L.emit?.('geo');return}
  const last=geo[geo.length-1];if(last&&now-last.t<60e3)return;
  const pt={t:now,lat:+c.latitude.toFixed(4),lon:+c.longitude.toFixed(4),acc:Math.round(c.accuracy)};
  geo.push(pt);pruneGeo();bump();L.emit?.('geo');if(geo.length%12===1)gtrack('geo_fix',{acc:pt.acc,n:geo.length})}
function poll(){if(!cfg.geo||document.visibilityState!=='visible'||!navigator.geolocation)return;navigator.geolocation.getCurrentPosition(addSample,()=>{},{enableHighAccuracy:false,timeout:20e3,maximumAge:60e3})}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')poll()});
L.geoStart=()=>new Promise(res=>{
  if(!navigator.geolocation){res({ok:false,msg:'这个浏览器不支持定位'});return}
  navigator.geolocation.getCurrentPosition(p=>{addSample(p);if(watchId==null)watchId=navigator.geolocation.watchPosition(addSample,()=>{},{maximumAge:120e3,timeout:20e3});clearInterval(pollT);pollT=setInterval(poll,POLL);
    res(p.coords.accuracy>ACC_MAX?{ok:true,msg:`定位精度约 ${Math.round(p.coords.accuracy)} 米，太粗的点会被丢弃`}:{ok:true})},
    e=>res({ok:false,msg:e.code===1?'定位权限被拒绝（在嵌入页面里浏览器也可能直接拦截，可以点“在新窗口打开”）':'暂时拿不到定位'}),{enableHighAccuracy:false,timeout:15e3,maximumAge:300e3});
});
L.geoStop=()=>{if(watchId!=null)navigator.geolocation.clearWatch(watchId);watchId=null;clearInterval(pollT);pollT=0};
L.geoClear=()=>{geo=[];save(KEY.geo,geo);bump()};
L.geoCount=()=>geo.length;
L.geoAdd=(lat,lon,t=Date.now(),acc=30)=>{geo.push({t,lat:+(+lat).toFixed(4),lon:+(+lon).toFixed(4),acc});geo.sort((a,b)=>a.t-b.t);pruneGeo();bump();L.emit?.('geo')};
const dist=(a,b)=>{const R=6371e3,toR=Math.PI/180,dl=(b.lat-a.lat)*toR,dn=(b.lon-a.lon)*toR,x=Math.sin(dl/2)**2+Math.cos(a.lat*toR)*Math.cos(b.lat*toR)*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(x))};
L.dist=dist;
/* 停留：相邻采样 150 米内、间隔不超过 45 分钟算同一次停留；单点停留按 5 分钟计 */
function staysOf(list){const out=[];let cur=null;for(const g of list){if(cur&&dist(cur,g)<150&&g.t-cur.t1<45*60e3){cur.t1=g.t;cur.n++}else{if(cur)out.push(cur);cur={lat:g.lat,lon:g.lon,t0:g.t,t1:g.t,n:1}}}if(cur)out.push(cur);out.forEach(s=>s.dwell=(s.t1-s.t0)/6e4+5);return out}
L.staysOf=staysOf;
const pid=c=>'g'+Math.round(c.lat*1e3).toString(36)+'_'+Math.round(c.lon*1e3).toString(36);
/* 常去地点：夜里停留最久 = 家；工作日白天停留最久 = 公司；其余停留 ≥15 分钟或到访 ≥2 次；到访 ≥2 次记为固定点位 */
function realPlaces(){
  if(memo.pl)return memo.pl;
  const C=[];staysOf(geo).forEach(s=>{let c=C.find(c=>dist(c,s)<150);if(!c){c={lat:s.lat,lon:s.lon,visits:0,days:new Set(),dwell:0,night:0,day:0};C.push(c)}
    c.visits++;c.days.add(dayKey(new Date(s.t0)));c.dwell+=s.dwell;
    for(let t=s.t0;t<=s.t1+1;t+=5*60e3){const d=new Date(t),h=d.getHours();if(h>=21||h<7)c.night+=5;else if(d.getDay()%6&&h>=9&&h<18)c.day+=5}});
  const home=C.filter(c=>c.night>0).sort((a,b)=>b.night-a.night)[0];const work=C.filter(c=>c!==home&&c.day>=30).sort((a,b)=>b.day-a.day)[0];
  let i=0;
  return memo.pl=C.filter(c=>c===home||c===work||c.dwell>=15||c.visits>=2).sort((a,b)=>(b===home)-(a===home)||(b===work)-(a===work)||b.visits-a.visits||b.dwell-a.dwell).slice(0,8).map(c=>{
    const isH=c===home,isW=c===work,id=isH?'home':isW?'work':pid(c);
    return {id,name:names[id]||(isH?'家':isW?'公司':`常去地点 ${++i}`),kind:isH?'home':isW?'work':'park',icon:isH?'🏠':isW?'💼':'📍',lat:c.lat,lon:c.lon,real:true,visits:c.visits,days:c.days.size,dwell:Math.round(c.dwell),fixed:c.visits>=2,catSpot:isH?'家里的窗台':isW?'公司楼下':`${names[id]||'那里'}附近`,base:isW?'garden':'park'}});
}
/* ---------- 自动生成生活圆环：定位停留 + 步数走路段 + App 活跃 + 作息习惯，缺口按规则推测（虚线显示） ---------- */
const AKEY='pg-life-act',HKEY='pg-life-hist';let act=load(AKEY,{});
function markActive(){if(document.visibilityState!=='visible')return;const d=new Date(),k=dayKey(d),m=Math.floor((d.getHours()*60+d.getMinutes())/10)*10;const a=act[k]=act[k]||[];if(!a.includes(m)){a.push(m);const keep=new Set([...Array(8)].map((_,i)=>dayKey(new Date(Date.now()-i*864e5))));Object.keys(act).forEach(x=>{if(!keep.has(x))delete act[x]});save(AKEY,act);bump()}}
setInterval(markActive,60e3);setTimeout(markActive,800);
L.activeMins=date=>act[dayKey(date)]||[];
function geoSegs(date){
  const d0=new Date(date);d0.setHours(0,0,0,0);const T0=d0.getTime(),pl=realPlaces();const mm=t=>Math.max(0,Math.min(1440,(t-T0)/6e4));
  const st=staysOf(geo.filter(g=>g.t>=T0&&g.t<T0+864e5)),S=[];
  st.forEach((s,i)=>{const p=pl.find(p=>dist(p,s)<150);const a=Math.round(mm(s.t0)),b=Math.round(Math.min(1440,mm(s.t1)+5));
    S.push({start:a,end:b,kind:p?(p.kind==='home'?'home':p.kind==='work'?'work':'out'):(s.dwell>=15?'out':'commute'),place:p?.id});
    const nx=st[i+1];if(nx){const gb=Math.round(mm(nx.t0));if(gb>b&&gb-b<180&&dist(s,nx)>=150)S.push({start:b,end:gb,kind:'commute'})}});
  return S;
}
function routine(wd){
  const key='rt'+wd;if(memo[key])return memo[key];const H=load(HKEY,[]).filter(h=>!!h.wd===wd&&!h.demo);const R=Array(48).fill(null);
  if(H.length>=2)for(let i=0;i<48;i++){const cnt={};H.forEach(h=>{const sg=h.segs.find(s=>i*30+15>=s[0]&&i*30+15<s[1]&&!s[4]);if(sg){const k=KN[sg[2]];cnt[k]=(cnt[k]||0)+1}});const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];if(top&&top[1]>=2&&top[1]/H.length>=.5)R[i]=top[0]}
  return memo[key]=R;
}
const KN=['sleep','home','commute','work','out','move','none'];
function autoDay(date=new Date()){
  const isT=dayKey(date)===dayKey(new Date()),now=isT?L.nowMin():1440,steps=L.stepsOf?.(date)||0;
  const key=dayKey(date)+'|'+ver+'|'+(isT?Math.floor(now/5):'x')+'|'+Math.floor(steps/50);if(memo[key])return memo[key];
  const T=Array(1440).fill(null),PL=Array(1440).fill(null),G=Array(1440).fill(false);
  geoSegs(date).forEach(s=>{for(let m=s.start;m<s.end&&m<1440;m++){T[m]=s.kind;PL[m]=s.place||null}});
  const hasGeo=T.some(Boolean);
  (L.walkSegs?.(date)||[]).forEach(w=>{for(let m=w[0];m<w[1]&&m<1440;m++)if(T[m]!=='home'&&T[m]!=='work'){T[m]=T[m]==='commute'||!T[m]?'move':T[m]}});
  const A=new Set();L.activeMins(date).forEach(m=>{for(let i=0;i<10;i++)A.add(m+i)});
  try{(window.__petGame.state().pet.journal||[]).forEach(j=>{const d=new Date(j.at);if(dayKey(d)===dayKey(date))A.add(d.getHours()*60+d.getMinutes())})}catch(e){}
  const wd=date.getDay()%6!==0,R=routine(wd);
  /* 插值：前后是同一地点的缺口直接连上 */
  let lastK=null,lastI=-1;for(let m=0;m<1440;m++){if(T[m]){if(lastK&&T[m]===lastK&&m-lastI>1&&m-lastI<240&&PL[m]===PL[lastI])for(let x=lastI+1;x<m;x++){T[x]=lastK;PL[x]=PL[m]}lastK=T[m];lastI=m}}
  /* 在家且夜里长时间不操作 → 睡觉 */
  for(let m=0;m<1440;m++){if(T[m]==='home'&&(m<420||m>=1380)&&!A.has(m))T[m]='sleep'}
  /* 其余缺口：作息习惯 → App 活跃 → 夜间 → 默认在家，全部标为推测 */
  for(let m=0;m<1440;m++){if(T[m])continue;G[m]=true;const r=R[Math.floor(m/30)];
    if(r&&!(A.has(m)&&r==='sleep'))T[m]=r;else if(A.has(m))T[m]='home';else if(m<420||m>=1410)T[m]='sleep';else if(!hasGeo&&!r){T[m]=m<450||m>=1320?'home':'home'}else T[m]='home';
    if(T[m]==='home'||T[m]==='sleep')PL[m]='home'}
  const S=[];for(let m=0;m<1440;m++){const l=S[S.length-1];if(l&&l.kind===T[m]&&l.place==PL[m]&&l.guess===G[m])l.end=m+1;else S.push({start:m,end:m+1,kind:T[m],place:PL[m]||undefined,guess:G[m]})}
  const segs=S.filter(s=>s.end-s.start>=3||!s.guess);
  return memo[key]={segs,steps:steps||null,real:true,auto:true,hasGeo,places:realPlaces(),env:L.env?.forDay?.(date)||[],wd};
}
L.places=()=>cfg.demo?DEMO_PLACES.map(p=>({...p,name:names[p.id]||p.name})):realPlaces();
L.place=id=>L.places().find(p=>p.id===id);
L.day=(date=new Date())=>{if(cfg.demo){const k='d'+dayKey(date);return memo[k]||(memo[k]={...demoDay(date),demo:true,env:L.env?.forDay?.(date)||[]})}return autoDay(date)};
L.autoDay=autoDay;
/* ---------- 每天自动归档前 7 天的生活圆环，供作息学习与回看 ---------- */
function archive(){
  if(cfg.demo)return;let H=load(HKEY,[]);const have=new Set(H.map(h=>h.k));let added=null;
  for(let i=7;i>=1;i--){const d=new Date(Date.now()-i*864e5);d.setHours(12,0,0,0);const k=dayKey(d);if(have.has(k))continue;
    const d0=new Date(d);d0.setHours(0,0,0,0);const any=L.activeMins(d).length||geo.some(g=>g.t>=d0.getTime()&&g.t<d0.getTime()+864e5)||(L.stepsOf?.(d)||0)>0;if(!any)continue;
    const day=autoDay(d);const ms=L.moments(d);
    H.push({k,t:d0.getTime(),wd:day.wd,segs:day.segs.map(s=>[s.start,s.end,KN.indexOf(s.kind),s.place?(L.place(s.place)?.name||''):'',s.guess?1:0]),steps:day.steps||0,env:(day.env||[]).reduce((a,e)=>(a[e.label]=(a[e.label]||0)+1,a),{}),heart:ms.reduce((a,m)=>a+m.heart,0),moms:ms.length});added=k}
  H=H.filter(h=>Date.now()-h.t<(cfg.keepDays+1)*864e5).sort((a,b)=>a.t-b.t).slice(-7);save(HKEY,H);
  if(added){bump();gtrack('life_ring_auto',{days:H.length})}
}
setTimeout(archive,3000);setInterval(archive,10*60e3);
L.hist=()=>{if(cfg.demo)return [...Array(6)].map((_,i)=>{const d=new Date(Date.now()-(6-i)*864e5);d.setHours(12,0,0,0);const dd=demoDay(d);return {k:dayKey(d),t:d.getTime(),wd:dd.wd,demo:true,steps:dd.steps,segs:dd.segs.map(s=>[s.start,s.end,KN.indexOf(s.kind),L.place(s.place)?.name||'',0]),env:{},heart:0,moms:0}});return load(HKEY,[])};
L.histDay=h=>({segs:h.segs.map(s=>({start:s[0],end:s[1],kind:KN[s[2]]||'none',pn:s[3],guess:!!s[4]})),steps:h.steps,real:true});
L.histHtml=()=>{const H=L.hist();const W='日一二三四五六';
  return `<section class="lf-sec"><h4>最近 7 天的生活圆环 <small>${cfg.demo?'演示：虚构的几天':'每天自动生成并归档；虚线 = 推测（缺少定位时按作息补齐）'}</small></h4>${H.length?`<div class="lf-hist">${H.map(h=>{const d=new Date(h.t);return `<button type="button" data-hist="${h.k}"><span class="r">${L.ringSvg(L.histDay(h),{now:1440,center:false,mini:true})}</span><b>${d.getMonth()+1}/${d.getDate()} 周${W[d.getDay()]}</b></button>`}).join('')}</div><div id="lf-histview"></div>`:'<p class="lf-empty">关掉演示数据、打开位置或运动后，每天会自动生成一张生活圆环。</p>'}</section>`};
L.histView=k=>{const h=L.hist().find(x=>x.k===k);if(!h)return '';const day=L.histDay(h);const sum=kk=>day.segs.filter(s=>s.kind===kk).reduce((a,s)=>a+s.end-s.start,0);const pls=[...new Set(day.segs.filter(s=>(s.kind==='out'||s.kind==='move')&&s.pn).map(s=>s.pn))];
  const env=Object.entries(h.env||{}).map(([l,n])=>`${l} ${n} 次`).join('、');const gm=day.segs.filter(s=>s.guess).reduce((a,s)=>a+s.end-s.start,0);
  return `<div class="lf-hv">${L.ringSvg(day,{now:1440,center:false,mini:true})}<div><b>${h.k.replace(/^\d+-/,'').replace('-','月')}日</b><p>睡觉 ${L.fmtDur(sum('sleep'))} · 工作 ${L.fmtDur(sum('work'))} · 通勤 ${L.fmtDur(sum('commute'))}${pls.length?' · 去了 '+pls.map(x=>'「'+x+'」').join(''):''}</p><p>${h.steps?`走了 ${h.steps.toLocaleString()} 步 · `:''}${h.moms?`心动 ${h.heart}（${h.moms} 个时刻）`:'没有心动记录'}${env?' · 环境：'+env:''}</p><p class="lf-note">${h.demo?'演示数据':gm?`其中约 ${L.fmtDur(gm)} 是按作息推测的`:'全部来自真实记录'}</p></div></div>`};
document.addEventListener('click',e=>{const b=e.target.closest('[data-hist]');if(!b)return;const v=document.getElementById('lf-histview');if(v){v.innerHTML=L.histView(b.dataset.hist);document.querySelectorAll('[data-hist]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))}});

const fixNow=+new URLSearchParams(location.search).get('lifeNow')||0;
L.nowMin=()=>{if(fixNow)return fixNow;const d=new Date();return d.getHours()*60+d.getMinutes()};
L.segAt=(day,m)=>day.segs.find(s=>m>=s.start&&m<s.end)||{kind:'none',start:m,end:m};
/* ---------- 心动时刻：手记 + 本次会话里的事件 ---------- */
let moms=load(KEY.mom,[]);
L.moment=m=>{moms.push({...m,t:Date.now()});moms=moms.filter(x=>Date.now()-x.t<cfg.keepDays*864e5).slice(-300);save(KEY.mom,moms);L.emit?.('moment')};
const JW={care:3,feed:3,drink:2,bath:3,pet:3,play:3,sleep:1,quirk:2,growth:5,graduate:6,world:3,visit:3,family:4,clinic:2};
const JI={care:'🍚',feed:'🍚',drink:'💧',bath:'🫧',pet:'💗',play:'🐟',sleep:'💤',quirk:'✨',growth:'🌱',graduate:'🎓',world:'🌿',visit:'🏡',family:'👪',clinic:'🩺'};
L.moments=(date=new Date())=>{
  const k=dayKey(date),out=[];
  try{(window.__petGame.state().pet.journal||[]).forEach(j=>{if(dayKey(new Date(j.at))===k)out.push({t:j.at,icon:JI[j.kind]||'🐾',label:j.message.slice(0,30),heart:JW[j.kind]||2,src:'j'})})}catch{}
  moms.forEach(m=>{if(dayKey(new Date(m.t))===k&&m.type!=='quirk')out.push({t:m.t,icon:m.icon,label:m.label,heart:m.heart||2,src:'m'})});
  out.sort((a,b)=>a.t-b.t);
  /* 演示：数据太少时补上一天里典型的心动时刻 */
  if(cfg.demo&&out.length<4){const d=new Date(date);d.setHours(0,0,0,0);const now=L.nowMin();
    [[452,'💗','早安摸摸，小橘蹭了蹭你',3],[748,'📷','午休打开 App 看了看小橘',2],[1160,'🏃','你到家，小橘冲到门口迎接',6],[1215,'🍚','一起吃晚饭',3],[1290,'🫧','洗香香，泡泡飞了一屋子',3],[1350,'🌙','睡前说了晚安',2]]
      .forEach(([m,i,l,h])=>{if(m<=now)out.push({t:d.getTime()+m*6e4,icon:i,label:l,heart:h,demo:true})});out.sort((a,b)=>a.t-b.t)}
  return out;
};
L.quirksToday=()=>{const k=dayKey(new Date());return moms.filter(m=>m.type==='quirk'&&dayKey(new Date(m.t))===k)};
/* ---------- 今日行动点：把主人的一天换成小猫的特殊行动点 ---------- */
L.points=day=>{
  const sum=k=>day.segs.filter(s=>s.kind===k).reduce((a,s)=>a+Math.min(s.end,L.nowMin())-s.start,0);
  const pts=[];const steps=day.steps?Math.round(day.real?day.steps:day.steps*Math.min(1,L.nowMin()/1260)):0;
  if(steps>=3000)pts.push({id:'walk',icon:'🐾',name:'散步能量',v:Math.min(5,Math.floor(steps/2000)),why:`你走了 ${steps.toLocaleString()} 步`});
  const w=sum('work');if(w>=120)pts.push({id:'wait',icon:'💼',name:'等你下班',v:Math.min(4,Math.floor(w/120)),why:`你工作了 ${fmtDur(w)}`});
  const outs=[...new Set(day.segs.filter(s=>(s.kind==='out'||s.kind==='move')&&s.start<=L.nowMin()).map(s=>s.place))];
  if(outs.length)pts.push({id:'place',icon:'📍',name:'新鲜见闻',v:outs.length*2,why:`去了 ${outs.map(id=>'「'+(L.place(id)?.name||'某处')+'」').join('、')}`});
  const home=sum('home');if(home>=90)pts.push({id:'company',icon:'🏠',name:'陪伴时光',v:Math.min(4,Math.floor(home/90)),why:`在家陪它 ${fmtDur(home)}`});
  return pts;
};
function fmtDur(m){m=Math.max(0,Math.round(m));const h=Math.floor(m/60),n=m%60;return h?(n?`${h} 小时 ${n} 分`:`${h} 小时`):`${n} 分钟`}
L.fmtDur=fmtDur;
L.fmtT=m=>`${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(Math.round(m%60)).padStart(2,'0')}`;
/* ---------- 像素小猫 ---------- */
const CAT=[
"..O.......O..",
".OOO.....OOO.",
".OODOOOOODOO.",
"OOOODDODDOOOO",
"OOKOOOOOOOKOO",
"OOOOOOPOOOOOO",
".OOWWWWWWWOO.",
"..OWWWWWWWO..",
"..OOOWWWOOO.T",
".OODOOOOODOOT",
".OOOOOOOOOOTT",
".OWW.OOO.WWO."];
const PAL={O:'#eb9a5c',D:'#c96d34',K:'#3b2a20',P:'#f2a0a0',W:'#fff3e2',T:'#eb9a5c'};
L.drawCat=(g,x,y,s=3,blink=false)=>{CAT.forEach((row,r)=>[...row].forEach((ch,c)=>{if(ch==='.')return;g.fillStyle=blink&&ch==='K'?PAL.O:PAL[ch];g.fillRect(Math.round(x+c*s),Math.round(y+r*s),s,s)}))};
L.catW=13;L.catH=12;
/* ---------- 风格化地图：真实瓦片调色 + 像素化；没有网络时程序化生成 ---------- */
const MAPPAL=[[[170,211,223],[159,208,214]],[[200,250,204],[167,207,154]],[[173,209,158],[150,196,140]],[[205,235,176],[167,207,154]],[[217,208,201],[233,201,163]],[[255,255,255],[251,241,220]],[[247,250,191],[251,236,200]],[[252,214,164],[247,222,180]],[[242,239,233],[241,223,190]],[[224,223,223],[236,216,184]],[[232,146,162],[236,190,160]]];
function stylize(g,w,h,px=4){
  const im=g.getImageData(0,0,w,h),d=im.data;
  for(let i=0;i<d.length;i+=4){let best=null,bd=1e9;for(const [s,t] of MAPPAL){const e=(d[i]-s[0])**2+(d[i+1]-s[1])**2+(d[i+2]-s[2])**2;if(e<bd){bd=e;best=t}}d[i]=best[0];d[i+1]=best[1];d[i+2]=best[2]}
  g.putImageData(im,0,0);
  const sm=document.createElement('canvas');sm.width=Math.ceil(w/px);sm.height=Math.ceil(h/px);const sg=sm.getContext('2d');sg.imageSmoothingEnabled=false;sg.drawImage(g.canvas,0,0,sm.width,sm.height);
  g.imageSmoothingEnabled=false;g.drawImage(sm,0,0,w,h);
}
function procedural(g,w,h,p){
  const r=rng([...p.id].reduce((a,c)=>a*31+c.charCodeAt(0),7));
  g.fillStyle='#f1dfbe';g.fillRect(0,0,w,h);
  const px=6;const cell=()=>Math.round((26+r()*22)/px)*px;
  if(p.kind==='park'||r()<.3){g.fillStyle='#a7cf9a';g.fillRect(Math.round(w*(.1+r()*.3)),Math.round(h*(.15+r()*.3)),Math.round(w*.45),Math.round(h*.45))}
  if(p.id==='river'||r()<.35){g.fillStyle='#9fd0d6';for(let x=0;x<w;x+=px){const y=h*.72+Math.sin(x/38+r())*14;g.fillRect(x,Math.round(y/px)*px,px,24)}}
  for(let y=0;y<h;y+=cell())for(let x=0;x<w;x+=cell()){const bw=cell()-px*2,bh=cell()-px*2;if(r()<.62){g.fillStyle=r()<.5?'#e9c9a3':'#e4b98f';g.fillRect(x+px,y+px,bw,bh);g.fillStyle='#d6a879';g.fillRect(x+px,y+px+bh-px,bw,px)}}
  g.fillStyle='#fbf1dc';for(let i=0;i<3;i++){g.fillRect(0,Math.round(h*(.25+i*.27)/px)*px,w,px*2);g.fillRect(Math.round(w*(.2+i*.3)/px)*px,0,px*2,h)}
  if(p.kind==='park')for(let i=0;i<14;i++){g.fillStyle='#7fb873';const x=Math.round(r()*w/px)*px,y=Math.round(r()*h/px)*px;g.fillRect(x,y,px*2,px*2)}
}
const mapCache={};
L.map=(p,w=320,h=200,cb)=>{
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
  if(!p){g.fillStyle='#f5eee4';g.fillRect(0,0,w,h);g.fillStyle='#776a5a';g.font='14px system-ui';g.textAlign='center';g.fillText('暂无可确认的地点',w/2,h/2);c.setAttribute('aria-label','暂无可确认的地点；未用虚构地点代替');return c}
  const key=p.id+w+'x'+h;
  procedural(g,w,h,p);decorate(g,w,h,p);
  if(mapCache[key]){g.drawImage(mapCache[key],0,0);return c}
  if(p.real&&navigator.onLine&&L.cfg.tiles!==false){
    const z=16,n=2**z,tx=(p.lon+180)/360*n,ty=(1-Math.log(Math.tan(p.lat*Math.PI/180)+1/Math.cos(p.lat*Math.PI/180))/Math.PI)/2*n;
    const raw=document.createElement('canvas');raw.width=w;raw.height=h;const rg=raw.getContext('2d');let left=0,fail=false;
    const x0=Math.floor(tx-w/512),x1=Math.floor(tx+w/512),y0=Math.floor(ty-h/512),y1=Math.floor(ty+h/512);
    for(let X=x0;X<=x1;X++)for(let Y=y0;Y<=y1;Y++){left++;const im=new Image();im.crossOrigin='anonymous';
      im.onload=()=>{rg.drawImage(im,(X-tx)*256+w/2,(Y-ty)*256+h/2);if(--left===0&&!fail){try{stylize(rg,w,h,4);decorate(rg,w,h,p);mapCache[key]=raw;g.drawImage(raw,0,0);cb&&cb(c)}catch{}}};
      im.onerror=()=>{fail=true};im.src=`https://tile.openstreetmap.org/${z}/${X}/${Y}.png`}
  }
  return c;
};
function decorate(g,w,h,p){
  const x=w/2,y=h/2;g.fillStyle='rgba(91,70,50,.18)';g.beginPath();g.ellipse(x,y+20,22,7,0,0,Math.PI*2);g.fill();
  L.drawCat(g,x-L.catW*1.5,y-L.catH*3+18,3);
  g.font='600 12px system-ui';const t=`${p.icon||'📍'} ${p.name}`,tw=g.measureText(t).width+16;g.fillStyle='rgba(255,253,248,.92)';rr(g,8,8,tw,24,12);g.fill();g.fillStyle='#5b4632';g.fillText(t,16,24);
}
function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
L.rr=rr;
/* 简单事件 */
const subs={};L.on=(n,f)=>(subs[n]=subs[n]||[]).push(f);L.emit=n=>(subs[n]||[]).forEach(f=>{try{f()}catch(e){console.warn(e)}});
L.toast=msg=>{let t=document.getElementById('pg-toast');if(!t){t=document.createElement('div');t.id='pg-toast';document.body.appendChild(t)}t.textContent=msg;t.classList.remove('on');void t.offsetWidth;t.classList.add('on');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),3200)};
})();

/* 31-life-ui.js */
/* ===== v5 生活同步：界面（今日生活 / 心动轨迹 / 常去地点 / 吧唧时间环 / 语音 / 授权） ===== */
(()=>{
const L=window.__pgLife;const $=id=>document.getElementById(id);
const mq=matchMedia('(max-width:600px)');
const track=(n,p)=>{try{window.__petAnalytics?.track(n,p)}catch(e){}};
const game=()=>window.__petGame;const petName=()=>{try{return game().state().pet.name}catch{return '小橘'}};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const K=L.KIND;
/* ---------- 入口 ---------- */
const rail=$('m-rail');
if(rail){const b=document.createElement('button');b.type='button';b.dataset.life='1';b.innerHTML='<span aria-hidden="true">◔</span>生活';rail.prepend(b);b.addEventListener('click',()=>open('today'))}
const nav=document.querySelector('.town-nav');
if(nav){const b=document.createElement('button');b.type='button';b.className='pg-navlife';b.innerHTML='<span class="nav-symbol" aria-hidden="true">◔</span>今日生活';nav.insertBefore(b,nav.querySelector('.town-edition'));b.addEventListener('click',()=>open('today'))}
/* ---------- 浮层 ---------- */
const ov=document.createElement('div');ov.id='life-ov';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','今日生活');
ov.innerHTML=`<div class="lf-box"><header class="lf-head"><div><b>今日生活</b><small id="lf-date"></small></div><span id="lf-mode" class="lf-mode"></span><button type="button" class="lf-x" aria-label="关闭">×</button></header>
<nav class="lf-tabs" role="tablist">${[['today','今天'],['heart','心动轨迹'],['places','常去地点'],['badge','吧唧'],['privacy','授权与隐私']].map(([k,n])=>`<button type="button" role="tab" data-tab="${k}">${n}</button>`).join('')}</nav>
<div class="lf-body" id="lf-body"></div></div>`;
document.body.appendChild(ov);
let tab='today';
ov.querySelector('.lf-x').addEventListener('click',close);
ov.addEventListener('click',e=>{if(e.target===ov)close();const t=e.target.closest('[data-tab]');if(t){tab=t.dataset.tab;render();track('life_tab',{tab})}});
addEventListener('keydown',e=>{if(e.key==='Escape'&&ov.classList.contains('on'))close()});
function open(t='today'){tab=t;ov.classList.add('on');render();track('life_open',{tab:t,demo:L.cfg.demo,sync:L.cfg.sync})}
function close(){ov.classList.remove('on');stopReplay();stopBadge()}
L.open=open;/* Embedded in the original daily-view closure. Presentation only; no life/store writes. */
function hostDayClock(){const date=new Date(),valid=Number.isFinite(date.getTime())&&date.getFullYear()>=2020&&date.getFullYear()<=2100;return{valid,day:valid?L.dayKey(date):null,minute:valid?date.getHours()*60+date.getMinutes()+date.getSeconds()/60:0};}
L.hostDayClock=hostDayClock;
L.hostStopDayReplay=stopReplay;
let hostFutureTile=null;
L.hostDrawDayFuture=(canvas,time=0)=>{
 const g=canvas.getContext('2d'),w=canvas.width,h=canvas.height;if(!g)return;g.imageSmoothingEnabled=false;
 g.fillStyle='#f6eee4';g.fillRect(0,0,w,h);g.fillStyle='#e9dfce';g.fillRect(0,h*.73,w,h*.27);
 // Reuse the original daily cat. Only its head gently looks up/around.
 const tile=hostFutureTile||(hostFutureTile=document.createElement('canvas'));tile.width=L.catW*4;tile.height=L.catH*4;const tg=tile.getContext('2d');L.drawCat(tg,0,0,4,Math.sin(time*.8)> .985);
 const x=w*.5-tile.width*.5,y=h*.72-tile.height;
 g.drawImage(tile,0,28,tile.width,tile.height-28,x,y+28,tile.width,tile.height-28);
 g.save();g.translate(x+tile.width*.5,y+28);g.rotate(Math.sin(time*.7)*.035);g.drawImage(tile,0,0,tile.width,28,-tile.width*.5,-29-Math.sin(time*.5)*1.2,tile.width,28);g.restore();
 const phase=time%7;if(phase>3.8&&phase<5.4){g.save();g.globalAlpha=Math.sin((phase-3.8)/1.6*Math.PI)*.7;g.strokeStyle='#bca3cf';g.lineWidth=2;const sx=w*.69,sy=h*.35;g.beginPath();g.moveTo(sx-4,sy);g.lineTo(sx+4,sy);g.moveTo(sx,sy-4);g.lineTo(sx,sy+4);g.stroke();g.restore();}
};
L.hostSelectDayTime=(minute,svg,mode='manual',frameTime=0)=>{
 if(!svg||!Number.isFinite(minute))return null;
 const selected=Math.max(0,Math.min(1439,Math.floor(minute))),clock=hostDayClock(),future=clock.valid&&selected>clock.minute,day=L.day();
 // Exact containment only. Future never consults segAt/catDo or borrows a past event.
 const sg=!future&&clock.valid?day.segs.find(s=>selected>=s.start&&selected<s.end&&s.kind!=='none'&&K[s.kind]):null;
 const moments=L.moments().filter(m=>{const date=new Date(m.t),value=date.getHours()*60+date.getMinutes();return value<=clock.minute&&(mode!=='replay'||value<=selected);});
 const template=document.createElement('template');template.innerHTML=ringSvg(day,{now:selected,moments,wallNow:clock});const fresh=template.content.firstElementChild;
 svg.replaceChildren(...fresh.childNodes);for(const attr of fresh.attributes)svg.setAttribute(attr.name,attr.value);
 svg.dataset.selectedMinute=String(selected);svg.dataset.timeMode=mode;
 const hero=svg.closest('.lf-hero'),you=hero?.querySelector('.lf-card.you'),cat=hero?.querySelector('.lf-card.cat'),canvas=hero?.querySelector('#lf-stage');
 const text=(node,selector,value)=>{const field=node?.querySelector(selector);if(field)field.textContent=value;};
 let bubble=hero?.querySelector('.day-future-bubble');if(future&&canvas&&!bubble){bubble=document.createElement('p');bubble.className='day-future-bubble';bubble.textContent='不知道接下来会遇见什么，好期待呀～';canvas.before(bubble);}if(bubble)bubble.hidden=!future;
 const source=day.demo||L.cfg.demo?'虚构日程':sg?.guess?'推测时段':sg?'日程记录':'暂无记录';
 text(you,'small',(mode==='live'?'你现在':'选中时刻')+' · '+L.fmtT(selected));
 if(future){
  text(you,'b','还没发生的小美好');text(you,'span','这是未来的时间，故事还没发生');
  text(cat,'small',petName()+'正在期待');text(cat,'b','还没发生的小美好');text(cat,'span','不知道接下来会遇见什么，好期待呀～');
  if(canvas){canvas.setAttribute('aria-label','期待未来的小猫；仅为展示');L.hostDrawDayFuture(canvas,frameTime);}
 }else if(!sg){
  text(you,'b',clock.valid?'这一刻还没有记录':'暂时无法确认当前时间');text(you,'span',clock.valid?'空白的过去，没有补写故事。':'请确认手机时间后再查看。');
  text(cat,'small',petName()+'的这一刻');text(cat,'b','暂无记录');text(cat,'span','没有用相邻记录代替这一刻。');
  if(canvas){const g=canvas.getContext('2d');g.fillStyle='#f5eee4';g.fillRect(0,0,canvas.width,canvas.height);g.fillStyle='#776a5a';g.font='14px system-ui';g.textAlign='center';g.fillText('这一刻还没有记录',canvas.width/2,canvas.height/2);g.textAlign='start';canvas.setAttribute('aria-label','这一刻还没有记录');}
 }else{
  const cd=L.catDo(sg);text(you,'b',K[sg.kind].i+' '+K[sg.kind].n+(sg.place&&L.place(sg.place)?' · '+L.place(sg.place).name:''));text(you,'span',L.fmtT(sg.start)+' 开始 · '+source);
  text(cat,'small',petName()+(mode==='live'?'现在':'在这一刻'));text(cat,'b',cd.k==='out'?'🐾 出门中':cd.k==='sleep'?'💤 睡觉':'🏠 在家');text(cat,'span',cd.t);
  if(canvas){canvas.setAttribute('aria-label',source+' · '+L.fmtT(selected));drawStage(canvas,sg,frameTime);}
 }
 return{minute:selected,kind:future?'还没发生的小美好':sg?K[sg.kind].n:'暂无记录',source,future,clockValid:clock.valid};
};

/* ---------- 24 小时时间环（App 与吧唧共用同一套数据） ---------- */
const P=(cx,cy,r,m)=>{const a=m/1440*Math.PI*2-Math.PI/2;return[cx+Math.cos(a)*r,cy+Math.sin(a)*r]};
function arc(cx,cy,r,a,b){const [x0,y0]=P(cx,cy,r,a),[x1,y1]=P(cx,cy,r,b);return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${b-a>720?1:0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`}
function ringSvg(day,{size=260,now=L.nowMin(),moments=[],center=true,mini=false,wallNow=hostDayClock()}={}){
  const c=size/2,r1=c-22,r2=c-44;let s=`<svg viewBox="0 0 ${size} ${size}" class="lf-ring" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="1439" aria-valuenow="${Math.min(1439,now)}" aria-label="24 小时时间环，拖动或方向键查看">`;
  s+=`<circle cx="${c}" cy="${c}" r="${r1}" fill="none" stroke="#f1e9dc" stroke-width="16"/><circle cx="${c}" cy="${c}" r="${r2}" fill="none" stroke="#f4eee5" stroke-width="7"/>`;
  // Future is an unobserved view, never a planned segment painted as a record.
  const clock=wallNow,observed=mini?1440:clock.valid?clock.minute:0,progress=Math.min(now,observed),isFuture=!mini&&clock.valid&&now>observed;
  const dayPath=(radius,start,end)=>end-start>=1440?arc(c,c,radius,start,start+720)+' '+arc(c,c,radius,start+720,end):arc(c,c,radius,start,end);
  day.segs.forEach(sg=>{
    const a=Math.max(0,sg.start),b=Math.min(sg.end,1440,observed);if(b<=a||!K[sg.kind])return;
    const end=Math.max(a,Math.min(b,progress)),dash=sg.guess?' stroke-dasharray="5 3"':'';
    s+=`<path d="${dayPath(r1,a,b)}" stroke="${K[sg.kind].c}" stroke-width="16" fill="none" opacity=".20"${dash}><title>${L.fmtT(a)}–${L.fmtT(b)} ${K[sg.kind].n}${sg.guess?'（推测）':''}</title></path>`;
    if(end>a)s+=`<path d="${dayPath(r1,a,end)}" stroke="${K[sg.kind].c}" stroke-width="16" fill="none" opacity="${sg.guess?.5:1}"${dash}/>`;
    const cd=L.catDo(sg),color=cd.k==='out'?'#e8907a':cd.k==='sleep'?'#8f8bc4':'#f0bf73';
    s+=`<path d="${dayPath(r2,a,b)}" stroke="${color}" stroke-width="7" fill="none" opacity=".18"/>`;
    if(end>a)s+=`<path d="${dayPath(r2,a,end)}" stroke="${color}" stroke-width="7" fill="none" opacity=".95"/>`;
  });
  if(isFuture){
    s+=`<path d="${dayPath(r1,observed,now)}" stroke="#cbbbdc" stroke-width="13" stroke-dasharray="5 5" fill="none" opacity=".62"/><path d="${dayPath(r2,observed,now)}" stroke="#e0c9a2" stroke-width="6" stroke-dasharray="4 5" fill="none" opacity=".7"/>`;
  }
  for(let h=0;h<24;h++){const [x0,y0]=P(c,c,r1+10,h*60),[x1,y1]=P(c,c,r1+(h%6?13:16),h*60);s+=`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#cdbba5" stroke-width="${h%6?1:1.6}"/>`}
  if(!mini)[0,6,12,18].forEach(h=>{const [x,y]=P(c,c,r2-16,h*60);s+=`<text x="${x}" y="${y+4}" text-anchor="middle" class="lf-hr">${h}</text>`});
  moments.filter(m=>mini||new Date(m.t).getHours()*60+new Date(m.t).getMinutes()<=observed).forEach(m=>{const d=new Date(m.t),mm=d.getHours()*60+d.getMinutes(),[x,y]=P(c,c,r1+1,mm);s+=`<text x="${x}" y="${y+4}" text-anchor="middle" class="lf-mh">♥</text>`});
  (day.env||[]).filter(e=>mini||e.m<=observed).forEach(e=>{const [x,y]=P(c,c,r2-15,e.m);s+=`<text x="${x}" y="${y+4}" text-anchor="middle" class="lf-env"><title>${L.fmtT(e.m)} ${e.label}</title>${e.icon}</text>`});
  const [nx,ny]=P(c,c,r1,now);if(!mini)s+=`<circle cx="${nx}" cy="${ny}" r="7" fill="#fff" stroke="#5b4632" stroke-width="2.5"/>`;
  if(center){
    const sg=!isFuture&&clock.valid?day.segs.find(sg=>now>=sg.start&&now<sg.end&&sg.kind!=='none'&&K[sg.kind]):null;
    const cd=sg?L.catDo(sg):null,title=isFuture?'还没发生的小美好':sg?'你：'+K[sg.kind].i+' '+K[sg.kind].n:'这一刻还没有记录';
    const copy=isFuture?'故事还没发生':cd?petName()+'：'+(cd.t.length>11?cd.t.slice(0,11)+'…':cd.t):'没有补写故事';
    s+=`<text x="${c}" y="${c-14}" text-anchor="middle" class="lf-ct">${L.fmtT(now)}</text><text x="${c}" y="${c+8}" text-anchor="middle" class="lf-cs">${esc(title)}</text><text x="${c}" y="${c+26}" text-anchor="middle" class="lf-cs2">${esc(copy)}</text>`;
  }
  if(!mini)s+=`<circle class="day-ring-track" cx="${c}" cy="${c}" r="${r1}" fill="none" stroke="transparent" stroke-width="16" aria-hidden="true"/><circle class="day-ring-track" cx="${c}" cy="${c}" r="${r2}" fill="none" stroke="transparent" stroke-width="7" aria-hidden="true"/>`;
  return s+'</svg>';
}
L.ringSvg=ringSvg;
/* ---------- 每日总结 ---------- */
/* 仅汇总已记录的生活段；推测与游戏演出不冒充真实共同经历。 */
function summary(day){
  const now=L.nowMin(),visible=day.segs.filter(s=>s.start<now),confirmed=visible.filter(s=>!s.guess&&!L.cfg.demo&&!day.demo);
  const sum=k=>confirmed.filter(s=>s.kind===k).reduce((a,s)=>a+Math.max(0,Math.min(s.end,now)-s.start),0);
  const sleep=sum('sleep'),work=sum('work'),com=sum('commute'),home=sum('home');
  const guessed=visible.some(s=>s.guess),fictional=Boolean(L.cfg.demo||day.demo);
  const labels={sleep:'睡觉',work:'工作',commute:'通勤',home:'在家',out:'外出',move:'运动'};
  const totals=Object.entries(labels).map(([kind,label])=>{const minutes=sum(kind);return minutes?`记录为${label} <b>${L.fmtDur(minutes)}</b>`:null;}).filter(Boolean);
  const life=fictional?'当前为虚构日程，不作为真实生活或共同回忆。':totals.length?totals.join('，')+'。'+(guessed?'其余缺口按作息推测，不计入这份摘要。':''):'暂无可确认的生活记录。'+(guessed?'圆环中的虚线时段按作息推测，不代表实际发生。':'');
  const workTxt=fictional?'虚构工作时段，非实际工作记录。':work?`已记录工作时段 <b>${L.fmtDur(work)}</b>。`:'暂无已记录的工作时段，不据此判断是否工作。';
  const q=L.quirksToday();
  const catTxt=q.length?`已记录 ${q.length} 次小猫怪行为：${[...new Set(q.map(x=>x.icon))].join('')}。`:'暂无已记录的小猫怪行为。生活场景中的陪伴画面不作为实际动作记录。';
  return {life,work:workTxt,cat:catTxt,nums:{sleep,work,com,home}};
}
/* ---------- 心动轨迹 ---------- */
function heartChart(ms,w=340,h=150){
  const xs=m=>{const d=new Date(m.t);return (d.getHours()*60+d.getMinutes())/1440*w};
  const pts=[];for(let x=0;x<=w;x+=3){let v=0;ms.forEach(m=>{const dx=(x-xs(m))/7;v+=m.heart*Math.exp(-dx*dx)});pts.push([x,v])}
  const max=Math.max(6,...pts.map(p=>p[1]));const Y=v=>h-18-(v/max)*(h-44);
  let d=pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('');
  let s=`<svg viewBox="0 0 ${w} ${h}" class="lf-hc" role="img" aria-label="心动轨迹">`;
  [0,6,12,18,24].forEach(hh=>{const x=hh/24*w;s+=`<line x1="${x}" y1="10" x2="${x}" y2="${h-18}" stroke="#f0e6d8"/><text x="${Math.min(w-8,Math.max(6,x))}" y="${h-4}" text-anchor="middle" class="lf-hr">${hh}:00</text>`});
  s+=`<path d="${d}L${w} ${h-18}L0 ${h-18}Z" fill="url(#lfg)"/><defs><linearGradient id="lfg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f29a9a" stop-opacity=".45"/><stop offset="1" stop-color="#f29a9a" stop-opacity="0"/></linearGradient></defs>`;
  s+=`<path d="${d}" fill="none" stroke="#e07a7a" stroke-width="2"/>`;
  let peak=null;ms.forEach(m=>{const x=xs(m);let v=0;ms.forEach(n=>{const dx=(x-xs(n))/7;v+=n.heart*Math.exp(-dx*dx)});if(!peak||v>peak.v)peak={v,m,x};s+=`<text x="${x}" y="${Y(v)-6}" text-anchor="middle" class="lf-mi">${m.icon}</text>`});
  if(peak)s+=`<text x="${Math.min(w-60,Math.max(60,peak.x))}" y="14" text-anchor="middle" class="lf-pk">心动高峰 ${L.fmtT(new Date(peak.m.t).getHours()*60+new Date(peak.m.t).getMinutes())}</text>`;
  return s+'</svg>';
}
/* ---------- 渲染各页 ---------- */
function render(){
  const day=L.day(),body=$('lf-body');stopReplay();stopBadge();L.emit('places');
  $('lf-date').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'short'});
  $('lf-mode').textContent=L.cfg.demo?'演示数据':L.cfg.geo?'定位采样中 · 自动生成':'自动生成';$('lf-mode').className='lf-mode'+(L.cfg.demo?' demo':'');
  ov.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===tab)));
  if(tab==='today')body.innerHTML=today(day);
  if(tab==='heart')body.innerHTML=heart();
  if(tab==='places')body.innerHTML=places();
  if(tab==='badge')body.innerHTML=badge();
  if(tab==='privacy')body.innerHTML=privacy();
  if(tab==='places')body.querySelectorAll('[data-map]').forEach(el=>{const p=L.place(el.dataset.map);el.replaceChildren(L.map(p,300,170,c=>el.replaceChildren(c)))});
  if(tab==='badge')startBadge();
  if(tab==='today'){const st=body.querySelector('#lf-stage');if(st)drawStage(st,L.segAt(day,L.nowMin()));window.CatDayNavigation?.restore()}
}
function today(day){
  const now=L.nowMin(),sg=L.segAt(day,now),cd=L.catDo(sg),sm=summary(day),pts=L.points(day),claimed=L.store.load(L.store.KEY.claim,'')===L.dayKey(new Date());
  const legend=['sleep','home','commute','work','out','move'].map(k=>`<span><i style="background:${K[k].c}"></i>${K[k].n}</span>`).join('');
  return `<section class="lf-hero"><div class="lf-ringwrap">${ringSvg(day,{moments:L.moments()})}<div class="lf-legend">${legend}<span class="lf-inner"><i></i>内圈＝${esc(petName())}</span></div></div>
  <div class="lf-now"><div class="lf-card you"><small>你现在</small><b>${K[sg.kind].i} ${K[sg.kind].n}${sg.place&&L.place(sg.place)?' · '+esc(L.place(sg.place).name):''}</b><span>${L.fmtT(sg.start)} 开始</span></div>
  <div class="lf-card cat"><small>${esc(petName())}现在</small><b>${cd.k==='out'?'🐾 出门中':cd.k==='sleep'?'💤 睡觉':'🏠 在家'}</b><span>${esc(cd.t)}</span></div>
  <canvas id="lf-stage" width="300" height="150" aria-label="今日回放画面"></canvas>
  <div class="lf-row"><button type="button" class="g-btn" data-act="replay">▶ 回放今天</button><button type="button" class="g-btn ghost" data-act="sync">${L.cfg.sync?'生活同步：开':'开启生活同步'}</button></div></div></section>
  <section class="lf-sec"><h4>今日行动点 <small>主人的一天，换成${esc(petName())}的特殊行动点</small></h4><div class="lf-pts">${pts.map(p=>`<div class="lf-pt"><b>${p.icon} ${p.name} +${p.v}</b><span>${esc(p.why)}</span></div>`).join('')||'<p class="lf-empty">今天的数据还不够，晚点再来看看。</p>'}</div>
  ${pts.length?`<button type="button" class="g-btn" data-act="claim" ${claimed?'disabled':''}>${claimed?'今天已领取':'领取：心情 +'+Math.min(12,pts.reduce((a,p)=>a+p.v,0))+' · 喵币 +'+Math.min(20,pts.reduce((a,p)=>a+p.v,0)*2)}</button>`:''}</section>
  <section class="lf-sec"><h4>今日记录摘要 <small>截至此刻 · 仅供主动查看</small></h4><div class="lf-sum"><p><b class="tag life">生活</b>${sm.life}</p><p><b class="tag work">工作</b>${sm.work}</p><p><b class="tag cat">${esc(petName())}</b>${esc(sm.cat).replace(/「(.*?)」/g,'<b>「$1」</b>')}</p></div></section>${L.histHtml?.()||''}`;
}
function heart(){
  const ms=L.moments();const total=ms.reduce((a,m)=>a+m.heart,0);
  return `<section class="lf-sec"><h4>今天的心动轨迹 <small>和${esc(petName())}的每一次互动都会留下心跳</small></h4><div class="lf-hcw">${heartChart(ms,mq.matches?340:680,mq.matches?150:190)}</div>
  <div class="lf-stat"><div><b>${total}</b><small>今日心动值</small></div><div><b>${ms.length}</b><small>心动时刻</small></div><div><b>${L.quirksToday().length}</b><small>怪行为</small></div></div>
  <ol class="lf-list">${ms.slice().reverse().map(m=>{const d=new Date(m.t);return `<li><time>${L.fmtT(d.getHours()*60+d.getMinutes())}</time><span>${m.icon}</span><p>${esc(m.label)}${m.demo?' <em>演示</em>':''}</p><b>+${m.heart}</b></li>`}).join('')||'<li class="lf-empty">还没有心动时刻，去摸摸它吧。</li>'}</ol></section>
  <section class="lf-sec"><h4>猫猫怪行为图鉴 <small>${Object.keys(L.quirk?.book||{}).length} / ${L.quirk?.list.length||0}</small></h4><div class="lf-qb">${(L.quirk?.list||[]).map(q=>{const b=L.quirk.book[q.id];return `<div class="${b?'':'lock'}"><span>${b?q.icon:'？'}</span><b>${b?q.name:'未发现'}</b><small>${b?'见过 '+b.n+' 次':'在家闲着时会随机出现'}</small></div>`}).join('')}</div></section>`;
}
function places(){
  const pl=L.places().filter(p=>p.id!=='home');
  const empty=L.geoCount()?'已有本机定位记录，尚未识别出家以外的常去地点。':'还没有真实定位记录；不会用虚构地点填充。是否开启位置由你决定。';
  return `<section class="lf-sec"><h4>常去地点 <small>${L.cfg.demo?'虚构地点 · 未采集真实位置':pl.length?'根据本机定位记录聚类':'暂无可展示的真实地点'}</small></h4>
  <p class="lf-note">夜里最常待的地方识别为「家」，工作日白天最常待的识别为「公司」，其余按到访次数排序。地点会解锁成${esc(petName())}的出门地点；地图先按游戏调色板像素化，正式版再用 AI 生成同风格场景。</p>
  <div class="lf-places">${pl.map(p=>`<article class="lf-place"><div class="lf-map" data-map="${p.id}"></div><div class="lf-pmeta"><b>${p.icon} ${esc(p.name)}</b><span>${esc(petName())}会去：${esc(p.catSpot)}</span><div class="lf-row"><button type="button" class="g-btn" data-go="${p.id}">带${esc(petName())}去这里</button><button type="button" class="g-btn ghost" data-rename="${p.id}">改名</button></div></div></article>`).join('')||`<p class="lf-empty" role="status">${empty}</p>`}</div></section>`;
}
function privacy(){
  const row=(k,t,d,dis)=>`<label class="lf-tg ${dis?'dis':''}"><input type="checkbox" data-cfg="${k}" ${L.cfg[k]?'checked':''} ${dis?'disabled':''}><span class="sw"></span><div><b>${t}</b><small>${d}</small></div></label>`;
  return `<section class="lf-sec"><h4>授权与隐私 <small>全部默认关闭，随时可以关掉</small></h4>
  ${row('demo','演示数据','用一组虚构的一天演示生活同步；关闭后改用你自己的定位采样')}
  ${row('sync','生活同步','你出门时小猫也“出门”，到家时它带回明信片；进行照料时会自动叫它回家')}
  ${row('geo','位置（仅打开页面时）',`网页版只在页面打开时取大致位置，保存在本机 ${L.cfg.keepDays} 天，不上传。已采样 ${L.geoCount()} 个点`)}
  ${row('motion','运动与步数',`页面打开时用手机加速度计数步，只存每天的步数和走路时段；电脑通常没有该传感器。今日 ${(L.motion?.today?.()||0).toLocaleString()} 步`)}
  ${row('voice','麦克风 · 按住说话','只在你按住按钮时听，识别完立即丢弃音频')}
  ${row('scene','吧唧环境感知','当前固件未提供传感能力，暂不可用；手机不采集环境录音。',true)}
  ${row('minor','我未满 14 周岁','开启后位置、环境感知与联系方式交换默认关闭，需要监护人同意')}
  ${L.privacyExtra?.()||''}
  <div class="lf-row"><button type="button" class="g-btn ghost" data-act="wipe">清除全部生活数据</button></div>
  <p class="lf-note">定位和录音都属于敏感个人信息：需要单独授权、说明用途、可随时撤回；可能录到他人声音时，要避免保存和识别他人。详见企划文档「生活同步与隐私」。</p></section>`;
}
/* ---------- 回放画面：地点地图 / 小屋 + 像素猫 ---------- */
function drawStage(cv,sg,t=0){
  const g=cv.getContext('2d'),w=cv.width,h=cv.height,cd=L.catDo(sg);g.imageSmoothingEnabled=false;
  if(cd.k==='out'){const p=L.place(sg.place);const m=L.map(p,w,h);g.drawImage(m,0,0);}
  else{g.fillStyle=cd.k==='sleep'?'#3d3656':'#f6e3c4';g.fillRect(0,0,w,h);g.fillStyle=cd.k==='sleep'?'#4b4368':'#e9cfa6';g.fillRect(0,h*.62,w,h*.38);
    g.fillStyle=cd.k==='sleep'?'#6d78a8':'#a9d4e0';g.fillRect(w*.62,h*.14,w*.24,h*.3);g.fillStyle='#fff8';g.fillRect(w*.74-1,h*.14,2,h*.3);
    if(cd.k==='sleep'){g.fillStyle='#f6e7a8';g.beginPath();g.arc(w*.7,h*.24,7,0,7);g.fill();g.fillStyle='#d8c6ef';g.fillRect(w*.18,h*.55,w*.34,h*.16)}
    const bob=Math.round(Math.sin(t*3)*1.5);L.drawCat(g,w*.32-20,h*.62-34+bob,3,cd.k==='sleep');
    g.font='600 12px system-ui';const tx=cd.k==='sleep'?'💤 '+cd.t:(sg.kind==='commute'?'🪟 ':'🏠 ')+cd.t,tw=g.measureText(tx).width+16;g.fillStyle='rgba(255,253,248,.92)';L.rr(g,8,8,tw,24,12);g.fill();g.fillStyle='#5b4632';g.fillText(tx,16,24)}
}
let rep=0;
function stopReplay(){cancelAnimationFrame(rep);rep=0}
function replay(){
  const day=L.day(),now=L.nowMin(),st=$('lf-stage'),ring=ov.querySelector('.lf-ringwrap');if(!st)return;stopReplay();
  const T0=performance.now(),D=14000,start=day.segs[0]?.start||0;let lastSeg=null;
  const ms=L.moments();
  const f=t=>{const k=Math.min(1,(t-T0)/D),m=Math.round(start+(now-start)*k);const sg=L.segAt(day,m);
    L.hostSelectDayTime(m,ring.querySelector('svg'),'replay',t/1000);if(sg!==lastSeg){lastSeg=sg}
    if(k<1)rep=requestAnimationFrame(f);else{rep=0;track('life_replay_done',{})}};
  rep=requestAnimationFrame(f);track('life_replay',{demo:L.cfg.demo});
}
/* ---------- 吧唧：240×240 圆屏 ---------- */
let bf='ring',braf=0,said={t:0,txt:'',icon:''};
function stopBadge(){cancelAnimationFrame(braf);braf=0}
function badge(){
  return `<section class="lf-sec lf-badge"><div class="lf-bz"><canvas id="lf-bcv" width="240" height="240" aria-label="吧唧圆屏预览"></canvas></div>
  <div class="lf-seg" role="group">${[['ring','时间环'],['heart','心动'],['cat','小猫']].map(([k,n])=>`<button type="button" data-face="${k}" aria-pressed="${bf===k}">${n}</button>`).join('')}</div>
  <p class="lf-note">吧唧端只显示今天：外圈是你的 24 小时，内圈是${esc(petName())}跟着你的行程；白点是现在，小红点是心动时刻。数据来自手机 App，通过蓝牙同步。</p></section>
  <section class="lf-sec"><h4>和${esc(petName())}说说话 <small>按住说话，只在按住时听</small></h4>
  <div class="lf-voice"><button type="button" id="lf-talk" class="lf-talk">🎙️ 按住说话</button><div id="lf-heard" class="lf-heard">试试说：“我回来了”“饿不饿”“今天好累”“晚安”</div></div>
  <div class="lf-chips">${['我回来了','饿不饿呀','今天好累','你好可爱','我出门啦','晚安'].map(t=>`<button type="button" data-say="${t}">${t}</button>`).join('')}</div></section>
  ${L.env?.badgeHtml?.()||''}`;
}
function startBadge(){
  const cv=$('lf-bcv');if(!cv)return;const g=cv.getContext('2d');g.imageSmoothingEnabled=false;
  const f=t=>{braf=requestAnimationFrame(f);drawBadge(g,t/1000)};braf=requestAnimationFrame(f);
}
function drawBadge(g,t){
  const day=L.day(),now=L.nowMin(),c=120;g.clearRect(0,0,240,240);
  g.save();g.beginPath();g.arc(c,c,120,0,7);g.clip();g.fillStyle='#2b2238';g.fillRect(0,0,240,240);
  const seg=(r,lw,a,b,col,al=1)=>{g.globalAlpha=al;g.strokeStyle=col;g.lineWidth=lw;g.beginPath();g.arc(c,c,r,a/1440*Math.PI*2-Math.PI/2,b/1440*Math.PI*2-Math.PI/2);g.stroke();g.globalAlpha=1};
  const ms=L.moments();
  if(bf==='ring'||bf==='heart'){
    seg(106,12,0,1440,'#3b3150');
    day.segs.forEach(s=>{const b=Math.min(s.end,1440);if(s.start<now)seg(106,12,s.start,Math.min(b,now),K[s.kind].c);if(b>now)seg(106,12,Math.max(s.start,now),b,K[s.kind].c,.25);
      const cd=L.catDo(s);seg(92,5,s.start,Math.min(b,now),cd.k==='out'?'#e8907a':cd.k==='sleep'?'#8f8bc4':'#f0bf73',s.start<now?1:0)});
    for(let h=0;h<24;h+=6){const a=h/24*Math.PI*2-Math.PI/2;g.fillStyle='#8e83a6';g.fillRect(c+Math.cos(a)*84-1,c+Math.sin(a)*84-1,3,3)}
    ms.forEach(m=>{const d=new Date(m.t),a=(d.getHours()*60+d.getMinutes())/1440*Math.PI*2-Math.PI/2;g.fillStyle='#ff8a8a';g.beginPath();g.arc(c+Math.cos(a)*116,c+Math.sin(a)*116,2.6,0,7);g.fill()});
    const a=now/1440*Math.PI*2-Math.PI/2;g.fillStyle='#fff';g.beginPath();g.arc(c+Math.cos(a)*106,c+Math.sin(a)*106,5+Math.sin(t*4)*.8,0,7);g.fill();
  }
  const sg=L.segAt(day,now),cd=L.catDo(sg);
  if(bf==='ring'){
    if(cd.k==='out'){g.fillStyle='#3d4a3a';g.beginPath();g.arc(c,c,62,0,7);g.fill()}
    L.drawCat(g,c-19.5,c-38+Math.round(Math.sin(t*2.5)),3,cd.k==='sleep'||(t%4)>3.85);
    g.fillStyle='#fff4e0';g.font='700 22px system-ui';g.textAlign='center';g.fillText(L.fmtT(now),c,c+20);
    g.font='11px system-ui';g.fillStyle='#cfc4e0';g.fillText(cd.k==='out'?'🐾 跟你出门中':cd.k==='sleep'?'💤 睡觉中':'🏠 在家等你',c,c+38);
  }
  if(bf==='heart'){const tot=ms.reduce((a,m)=>a+m.heart,0);const s=1+Math.max(0,Math.sin(t*6))*.08;g.save();g.translate(c,c-12);g.scale(s,s);g.fillStyle='#ff8a8a';g.font='44px system-ui';g.textAlign='center';g.fillText('♥',0,10);g.restore();
    g.fillStyle='#fff4e0';g.font='700 26px system-ui';g.textAlign='center';g.fillText(tot,c,c+36);g.font='11px system-ui';g.fillStyle='#cfc4e0';g.fillText(`今日心动 · ${ms.length} 个时刻`,c,c+54)}
  if(bf==='cat'){
    g.fillStyle='#3b3150';g.fillRect(0,170,240,70);L.drawCat(g,c-32.5,c-30+Math.round(Math.sin(t*2.5)*1.5),5,(t%4)>3.85);
    const fresh=performance.now()-said.t<6000;const txt=fresh?said.txt:(cd.k==='out'?'我在外面等你！':cd.k==='sleep'?'呼……呼……':'今天也想你～');
    g.font='12px system-ui';const tw=Math.min(190,g.measureText(txt).width+20);g.fillStyle='#fff4e0';L.rr(g,c-tw/2,36,tw,26,13);g.fill();g.fillStyle='#3b2f45';g.textAlign='center';g.fillText(txt.length>15?txt.slice(0,15)+'…':txt,c,53);
  }
  g.restore();g.strokeStyle='#d8c7b0';g.lineWidth=6;g.beginPath();g.arc(c,c,117,0,7);g.stroke();
  if(L.env?.listening){g.fillStyle=(t*4|0)%2?'#ff5a5a':'#ff9a9a';g.beginPath();g.arc(c,13,4.5,0,7);g.fill()}
}
/* ---------- 语音：按住说话（Web Speech / 音量兜底 / 快捷短句） ---------- */
const INTENT=[[/回来|到家|我回/,'🏃','喵～你回来啦！今天在外面累不累？',4],[/饿|吃饭|饭|零食/,'🍚','肚子咕咕叫了！一起去吃饭吧～',2],[/晚安|睡觉|困/,'🌙','晚安，我在你脚边守着你。',2],[/累|烦|难过|不开心|加班/,'💗','我把肚皮借给你摸一下吧。',4],[/可爱|乖|喜欢|爱你/,'💕','呼噜呼噜……（尾巴竖得高高的）',3],[/出门|上班|走了|拜拜/,'👋','等你回来！我会在窗边看着你。',2]];
let lastVoiceLog=0;
function respond(text,src){
  const it=INTENT.find(([re])=>re.test(text));const [,icon,reply,h]=it||[0,'❓','喵？（歪头）我听到你啦。',1];
  said={t:performance.now(),txt:reply,icon};const el=$('lf-heard');if(el)el.innerHTML=`<span>你：“${esc(text)}”</span><b>${icon} ${esc(petName())}：${esc(reply)}</b>`;
  L.moment({type:'voice',icon,label:`对它说“${text.slice(0,10)}”`,heart:h});
  L.quirk?.react(icon,reply);
  if(Date.now()-lastVoiceLog>10*60e3){lastVoiceLog=Date.now();try{game().store.lifeLog('voice',`你对${petName()}说“${text.slice(0,12)}”，它${reply.replace(/[。！～]$/,'')}`,1)}catch{}}
  bf='cat';ov.querySelectorAll('[data-face]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.face===bf)));
  track('voice_say',{src,intent:it?INTENT.indexOf(it):-1});
}
let rec=null,media=null;
async function talkStart(btn){
  if(!L.cfg.voice){L.cfg.voice=true;L.saveCfg()}
  btn.classList.add('on');btn.textContent='🎙️ 在听…松开结束';
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(SR){try{rec=new SR();rec.lang='zh-CN';rec.interimResults=false;rec.maxAlternatives=1;let got=false;
    rec.onresult=e=>{got=true;respond(e.results[0][0].transcript,'speech')};rec.onerror=e=>{$('lf-heard').textContent=e.error==='not-allowed'?'麦克风权限被拒绝或当前页面不允许，可以点下面的短句试试。':'没听清，再试一次或点短句。'};
    rec.onend=()=>{if(!got&&$('lf-heard')&&!/权限|没听清/.test($('lf-heard').textContent))$('lf-heard').textContent='没听清，再试一次或点短句。'};rec.start();return}catch{}}
  try{media=await navigator.mediaDevices.getUserMedia({audio:true});const ac=new AudioContext(),an=ac.createAnalyser();ac.createMediaStreamSource(media).connect(an);const buf=new Uint8Array(an.fftSize);let peak=0;
    media._tick=setInterval(()=>{an.getByteTimeDomainData(buf);let s=0;buf.forEach(v=>s=Math.max(s,Math.abs(v-128)));peak=Math.max(peak,s)},60);media._peak=()=>peak;media._ac=ac}
  catch{$('lf-heard').textContent='这个环境不能使用麦克风（嵌入页面常会拦截），可以点下面的短句试试。';media=null}
}
L.hostStopCapture=()=>{if(rec){try{rec.abort()}catch{}rec=null}if(media){clearInterval(media._tick);media.getTracks().forEach(t=>t.stop());media._ac?.close();media=null}const b=document.getElementById('lf-talk');if(b){b.classList.remove('on');b.textContent='🎙️ 按住说话'}};
function talkEnd(btn){
  btn.classList.remove('on');btn.textContent='🎙️ 按住说话';
  if(rec){try{rec.stop()}catch{}rec=null}
  if(media){clearInterval(media._tick);const pk=media._peak();media.getTracks().forEach(t=>t.stop());media._ac.close();media=null;if(pk>18)respond('（听到了你的声音）','volume');else $('lf-heard').textContent='好像没听到声音，再靠近一点？'}
}
/* ---------- 事件委托 ---------- */
ov.addEventListener('click',async e=>{
  const a=e.target.closest('[data-act]')?.dataset.act;
  if(a==='replay')replay();
  if(a==='sync'){L.cfg.sync=!L.cfg.sync;L.saveCfg();render();syncNow(true);track('life_sync',{on:L.cfg.sync})}
  if(a==='claim'){const pts=L.points(L.day()),v=pts.reduce((s,p)=>s+p.v,0);L.store.save(L.store.KEY.claim,L.dayKey(new Date()));
    try{game().store.lifeLog('life',`${petName()}把你今天的经历换成了行动点：${pts.map(p=>p.icon+p.name).join('、')}。`,Math.min(12,v),Math.min(20,v*2))}catch{}
    L.toast(`领取成功：心情 +${Math.min(12,v)} · 喵币 +${Math.min(20,v*2)}`);render();track('life_claim',{v})}
  if(a==='wipe'){if(!confirm('清除定位采样、心动时刻和生活设置？游戏存档不受影响。'))return;L.geoStop();L.geoClear();['mom','names','claim','cfg'].forEach(k=>localStorage.removeItem(L.store.KEY[k]));Object.assign(L.cfg,{sync:false,geo:false,voice:false,demo:true});L.saveCfg();L.toast('生活数据已清除');render();syncNow(true)}
  const f=e.target.closest('[data-face]');if(f){bf=f.dataset.face;ov.querySelectorAll('[data-face]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.face===bf)))}
  const s=e.target.closest('[data-say]');if(s)respond(s.dataset.say,'chip');
  const go=e.target.closest('[data-go]');if(go)goPlace(go.dataset.go);
  const rn=e.target.closest('[data-rename]');if(rn){const p=L.place(rn.dataset.rename);const n=prompt('给这个地点起个名字',p.name);if(n&&n.trim()){L.renamePlace(p.id,n.trim().slice(0,10));render()}}
});
ov.addEventListener('change',async e=>{const k=e.target.dataset.cfg;if(!k)return;L.cfg[k]=e.target.checked;
  if(L.sensorToggle){const r=await L.sensorToggle(k,e.target.checked);if(r&&!r.ok){L.cfg[k]=false;L.saveCfg();L.toast(r.msg);render();return}}
  if(k==='geo'){if(e.target.checked){const r=await L.geoStart();if(!r.ok){L.cfg.geo=false;L.toast(r.msg)}else{L.cfg.demo=false;L.toast('已开始在本机记录大致位置')}}else L.geoStop()}
  if(k==='demo'&&!e.target.checked&&!L.geoCount())L.toast('还没有定位数据，先打开“位置”或继续用演示数据');
  L.saveCfg();render();syncNow(true);track('life_cfg',{k,v:L.cfg[k]})});
ov.addEventListener('pointerdown',e=>{const b=e.target.closest('#lf-talk');if(b){e.preventDefault();b.setPointerCapture?.(e.pointerId);talkStart(b)}});
ov.addEventListener('pointerup',e=>{const b=e.target.closest('#lf-talk');if(b)talkEnd(b)});
ov.addEventListener('pointercancel',e=>{const b=e.target.closest('#lf-talk');if(b)talkEnd(b)});
if(L.cfg.geo)L.geoStart();
/* ---------- 生活同步：主人出门，小猫也出门 ---------- */
const pill=document.createElement('button');pill.type='button';pill.id='pg-sync';pill.hidden=true;$('home-scene').appendChild(pill);
pill.addEventListener('click',()=>open('today'));
const away=document.createElement('div');away.id='pg-away';away.hidden=true;$('home-scene').appendChild(away);
let callBack=0,lastKind=null,lastPlace=null;
let hostAppliedCompanion=null;
L.hostCompanionState=()=>document.hidden||!hostAppliedCompanion?null:{...hostAppliedCompanion};
function catOut(){return L.cfg.sync&&Date.now()>callBack&&L.catDo(L.segAt(L.day(),L.nowMin())).k==='out'}
function syncNow(force){
  hostAppliedCompanion=null;
  const r=window.__pgRoom;const on=L.cfg.sync;pill.hidden=!on;
  const day=L.day(),sg=L.segAt(day,L.nowMin()),cd=L.catDo(sg);
  if(on)pill.innerHTML=`<span>${K[sg.kind].i} 你${K[sg.kind].n}${sg.place&&L.place(sg.place)&&sg.kind!=='home'&&sg.kind!=='sleep'?'「'+esc(L.place(sg.place).name)+'」':''}</span><b>${esc(petName())}${esc(cd.t)}</b>`;
  const out=catOut();if(r&&!r.act)r.cat.visible=!out;
  away.hidden=!out||!r;
  if(out){const p=L.place(sg.place);away.innerHTML=`<div class="lf-postcard"></div><p><b>${esc(petName())}出门啦</b><span>${esc(cd.t)}，回来会带明信片给你。</span></p><div class="lf-row"><button type="button" class="g-btn" data-back>叫它回家</button><button type="button" class="g-btn ghost" data-see>看看它</button></div>`;
    away.querySelector('.lf-postcard').appendChild(L.map(p,220,120))}
  if(lastKind&&lastKind!==cd.k&&cd.k==='home'&&lastPlace&&on){L.toast(`${petName()}回来啦，带回了「${L.place(lastPlace)?.name||'外面'}」的明信片`);L.moment({type:'home',icon:'🏠',label:`${petName()}从「${L.place(lastPlace)?.name||'外面'}」回家`,heart:3})}
  if(cd.k==='out')lastPlace=sg.place;lastKind=cd.k;
  hostAppliedCompanion=r?Object.freeze({schema:1,source:'life-v5-applied',out:Boolean(out),mode:L.cfg.demo?'demo':'automatic'}):null;
}
away.addEventListener('click',e=>{if(e.target.closest('[data-back]')){callBack=Date.now()+30*60e3;L.toast(`${petName()}听到你叫它，一路小跑回家啦`);syncNow(true);track('life_callback',{})}if(e.target.closest('[data-see]'))open('today')});
/* 照料时自动叫它回家 */
document.addEventListener('click',e=>{if(e.target.closest('.care-action,#m-dock button')&&catOut()){callBack=Date.now()+30*60e3;syncNow(true);L.toast(`${petName()}听到你叫它，一路小跑回家啦`)}},true);
setInterval(()=>syncNow(),5000);setTimeout(()=>syncNow(true),1500);
/* ---------- 出门面板：你常去的地方 ---------- */
const wp=$('world-panel');
if(wp){const sec=document.createElement('div');sec.id='pg-wplaces';wp.querySelector('.location-tabs')?.after(sec);
  const fill=()=>{const pl=L.places().filter(p=>p.id!=='home').slice(0,5);sec.innerHTML=`<div class="life-section-label">你常去的地方 <span>${L.cfg.demo?'虚构地点 · 未采集真实位置':pl.length?'来自本机定位记录':'暂无可展示的真实地点'}</span></div><div class="pg-wpl">${pl.map(p=>`<button type="button" data-go="${p.id}"><span class="th"></span><b>${p.icon} ${esc(p.name)}</b></button>`).join('')||`<p class="lf-empty" role="status">${L.geoCount()?'已有本机定位记录，尚未识别出家以外的常去地点。':'还没有真实定位记录；不会用虚构地点填充。是否开启位置由你决定。'}</p>`}</div>`;
    sec.querySelectorAll('[data-go]').forEach(b=>b.querySelector('.th').appendChild(L.map(L.place(b.dataset.go),120,64)))};
  fill();L.on('geo',fill);L.on('places',fill);
  sec.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)goPlace(b.dataset.go)});
  wp.addEventListener('click',e=>{const b=e.target.closest('[data-location]');if(b&&e.isTrusted)clearPlace()},true);
}
const wmap=document.createElement('div');wmap.id='pg-wmap';wmap.hidden=true;$('world-scene')?.appendChild(wmap);
function goPlace(id){
  const p=L.place(id);if(!p)return;close();window.__pgPlace={id:p.id,name:`${p.name}附近`};
  wmap.replaceChildren(L.map(p,180,110,c=>wmap.replaceChildren(c)));wmap.hidden=false;
  const base=p.base||'park';
  const go=()=>{document.querySelector(`[data-location="${base}"]`)?.click();setTimeout(()=>{const lb=$('world-label');if(lb&&window.__pgPlace)lb.textContent=window.__pgPlace.name},400)};
  if(document.body.dataset.view!=='world'){document.querySelector('.town-nav button[data-view="world"]')?.click();setTimeout(go,500)}else go();
  L.moment({type:'place',icon:p.icon,label:`带${petName()}去「${p.name}」`,heart:2});track('life_place_go',{id:p.id,real:!!p.real});
}
function clearPlace(){window.__pgPlace=null;wmap.hidden=true}
new MutationObserver(()=>{if(document.body.dataset.view!=='world'&&window.__pgPlace)clearPlace()}).observe(document.body,{attributes:true,attributeFilter:['data-view']});
L.on('moment',()=>{if(ov.classList.contains('on')&&tab==='heart')render()});
})();
