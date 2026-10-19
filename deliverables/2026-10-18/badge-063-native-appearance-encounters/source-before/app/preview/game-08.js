/* ===== v7 感知：运动计步（DeviceMotion）+ 吧唧麦克风环境感知（只出场景标签） + 授权钩子 ===== */
(()=>{
const L=window.__pgLife;if(!L)return;
const load=L.store.load,save=L.store.save,dk=L.dayKey;
const track=(n,p)=>{try{window.__petAnalytics?.track(n,p)}catch(e){}};
const petName=()=>{try{return window.__petGame.state().pet.name}catch(e){return '小橘'}};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* ---------- 运动与步数：加速度峰值计步，连续 4 步以上才计入；每分钟 ≥40 步算走路 ---------- */
const SK='pg-life-steps',WK='pg-life-walk';let steps=load(SK,{}),walk=load(WK,{});
let mOn=false,lp=9.8,armed=true,lastStep=0,streak=0,pend=0,minute=-1,minN=0,got=false,dirty=false;
function nowMin(){const d=new Date();return d.getHours()*60+d.getMinutes()}
function addSteps(n){const k=dk(new Date());steps[k]=(steps[k]||0)+n;dirty=true;
  const m=nowMin();if(m!==minute){if(minN>=40)markWalk(minute);minute=m;minN=0}minN+=n}
function markWalk(m){const k=dk(new Date()),w=walk[k]=walk[k]||[];const l=w[w.length-1];if(l&&m-l[1]<=3)l[1]=m+1;else w.push([m,m+1]);dirty=true}
function onMotion(e){const a=e.accelerationIncludingGravity;if(!a||a.x==null)return;got=true;const mag=Math.hypot(a.x,a.y,a.z);lp=lp*.75+mag*.25;const t=performance.now();
  if(armed&&lp>10.9){armed=false;const dt=t-lastStep;if(dt>280&&dt<2000){streak++;pend++;if(streak===4){addSteps(pend);pend=0}else if(streak>4){addSteps(1);pend=0}}else{streak=1;pend=1}lastStep=t}
  else if(!armed&&lp<9.9)armed=true;
  if(t-lastStep>2000){streak=0;pend=0}}
setInterval(()=>{if(!dirty)return;dirty=false;const keep=new Set([...Array(8)].map((_,i)=>dk(new Date(Date.now()-i*864e5))));[steps,walk].forEach(o=>Object.keys(o).forEach(x=>{if(!keep.has(x))delete o[x]}));save(SK,steps);save(WK,walk);L.bump?.()},10e3);
L.motion={
  async start(){if(typeof DeviceMotionEvent==='undefined')return {ok:false,msg:'这个设备没有运动传感器（电脑上通常不可用），可以在手机上打开试试'};
    try{if(typeof DeviceMotionEvent.requestPermission==='function'){const r=await DeviceMotionEvent.requestPermission();if(r!=='granted')return {ok:false,msg:'运动与方向权限被拒绝'}}}catch(e){return {ok:false,msg:'需要在点击时授权运动权限，再试一次'}}
    if(!mOn){addEventListener('devicemotion',onMotion);mOn=true}got=false;setTimeout(()=>{if(mOn&&!got)L.toast('没有收到运动数据：这台设备可能没有加速度计，或嵌入页面拦截了传感器')},4000);track('motion_on',{});return {ok:true}},
  stop(){removeEventListener('devicemotion',onMotion);mOn=false},
  today(){return steps[dk(new Date())]||0},
  get on(){return mOn}
};
L.stepsOf=d=>steps[dk(d)]||0;
L.walkSegs=d=>walk[dk(d)]||[];
L.simSteps=(n,walkMin)=>{addSteps(n);if(walkMin){const m=nowMin();for(let i=walkMin;i>0;i--)markWalk(m-i)}dirty=true};
if(L.cfg.motion)setTimeout(()=>{L.motion.start().then(r=>{if(!r.ok){L.cfg.motion=false;L.saveCfg()}})},1200);
/* ---------- 环境感知：间歇听 3 秒，端侧算特征 → 安静 / 交谈 / 嘈杂 / 音乐；不存音频 ---------- */
const EK='pg-life-env';let elog=load(EK,[]);
const ENV={quiet:{n:'安静',i:'🤫'},talk:{n:'交谈',i:'💬'},noisy:{n:'嘈杂',i:'🔊'},music:{n:'音乐',i:'🎵'}};
let listening=false,lastAt=load('pg-life-env-last',0),chip=null;
function showChip(txt,on){if(!chip){chip=document.createElement('div');chip.id='pg-envchip';chip.setAttribute('role','status');document.body.appendChild(chip)}chip.innerHTML=txt;chip.classList.toggle('rec',!!on);chip.hidden=!txt}
async function listen(src='auto'){return {ok:false,msg:'环境感知仅由已连接且具备该能力的吧唧提供；手机不采集环境录音。'}}
function classify(fr){
  const avg=k=>fr.reduce((a,f)=>a+f[k],0)/fr.length;const rms=avg('rms'),dbfs=20*Math.log10(rms+1e-9),db=Math.max(20,Math.round(dbfs+94));
  const env=fr.map(f=>f.rms),m=rms+1e-9,mod=Math.sqrt(env.reduce((a,v)=>a+(v-m)**2,0)/env.length)/m;
  const voice=avg('voice'),flat=avg('flat'),sim=avg('sim');
  let label;
  if(dbfs<-52)label='quiet';
  else if(flat<.12&&sim>.82&&mod<.6)label='music';
  else if(voice>.5&&mod>.35&&dbfs<-22)label='talk';
  else if(dbfs>-34)label='noisy';
  else label=voice>.45?'talk':'quiet';
  return {label,db,feat:{dbfs:+dbfs.toFixed(1),mod:+mod.toFixed(2),voice:+voice.toFixed(2),flat:+flat.toFixed(3),sim:+sim.toFixed(2)}};
}
L.envClassify=classify;
const LINES={
  talk:{work:['今天好像开了好多会，辛苦啦','听起来大家在讨论什么，你也说了好多话吧'],out:['你在和朋友聚会吗？替我打个招呼','好热闹，是在聚餐吗'],home:['家里有人在聊天，好温馨'],_:['听到你在和别人说话，我乖乖等着']},
  noisy:{work:['周围有点吵，戴上耳机专心一下？'],out:['外面好吵呀，注意安全'],home:['家里好热闹'],_:['好吵好吵，我把耳朵折起来了']},
  music:{_:['在听歌吗？我也想摇摇尾巴','这首歌好听，我在打拍子']},
  quiet:{work:['好安静，你在专心工作吧'],home:['安安静静的，适合一起发呆'],_:['静悄悄的，我陪着你']}};
function react(label){const sg=L.segAt(L.day(),L.nowMin());const k=sg.kind==='work'?'work':sg.kind==='out'||sg.kind==='move'?'out':sg.kind==='home'?'home':'_';const set=LINES[label][k]||LINES[label]._;const t=set[Math.floor(Math.random()*set.length)];
  try{L.quirk?.react(ENV[label].i,t)}catch(e){}if(label!=='quiet')L.moment({type:'env',icon:ENV[label].i,label:`${petName()}：${t}`,heart:1})}
function statusTxt(){return '环境感知仅支持吧唧传感器；本固件尚未提供，手机不录音。'}
setInterval(()=>{if(!L.cfg.scene||listening||document.visibilityState!=='visible')return;if(Date.now()-lastAt>=(L.cfg.envEvery||15)*60e3)listen('auto');else if(chip&&!chip.classList.contains('rec'))showChip(statusTxt())},30e3);
L.env={
  get listening(){return listening},listen,ENV,
  log:()=>elog,
  stop(){showChip('')},
  forDay(date){const k=dk(date);return elog.filter(e=>dk(new Date(e.t))===k&&e.label!=='quiet').map(e=>{const d=new Date(e.t);return {m:d.getHours()*60+d.getMinutes(),label:ENV[e.label].n,icon:ENV[e.label].i}})},
  summaryText(){const k=dk(new Date());const t=elog.filter(e=>dk(new Date(e.t))===k);if(!t.length)return '';const c={};t.forEach(e=>c[e.label]=(c[e.label]||0)+1);const top=Object.entries(c).sort((a,b)=>b[1]-a[1]);
    return ` 环境感知听了 <b>${t.length}</b> 次：${top.map(([l,n])=>`${ENV[l].n} ${n} 次`).join('、')}${c.talk>=3?'，今天说了好多话':''}。`},
  badgeHtml(){return '<section class="lf-sec"><h4>吧唧环境感知 <small>当前不可用</small></h4><p class="lf-note">仅接收具备明确传感能力的吧唧数据。当前固件没有此能力；手机不采集或定时录音。原历史保留，未作为新吧唧观测。</p></section>'}
};
document.addEventListener('click',async e=>{const b=e.target.closest('[data-env="now"]');if(!b)return;if(L.cfg.minor){L.toast('未满 14 周岁需监护人同意');return}
  if(!L.cfg.scene&&!confirm('环境感知会打开麦克风听 3 秒，可能听到身边其他人的声音。只在本机判断场景标签，不保存音频、不转文字。继续吗？'))return;
  b.disabled=true;b.textContent='👂 正在听…';const r=await L.env.listen('manual');if(!r.ok)L.toast(r.msg);else L.toast(`听到：${ENV[r.label].n}（约 ${r.db} dB）`);if(document.getElementById('life-ov')?.classList.contains('on'))document.querySelector('#life-ov [data-tab="badge"]')?.click()});
/* ---------- 授权钩子：未成年保护 / 环境感知单独同意 / 运动权限 ---------- */
L.sensorToggle=async(k,on)=>{if(k==='scene')return {ok:false,msg:'当前吧唧未提供环境感知，手机采集保持禁用。'};
  if(k==='minor'){if(on){Object.assign(L.cfg,{geo:false,scene:false});L.geoStop();L.env.stop();window.__pgSocial?.onMinor?.(true)}L.saveCfg();track('privacy_minor',{on});return {ok:true}}
  if(on&&L.cfg.minor&&(k==='geo'||k==='scene'))return {ok:false,msg:'未满 14 周岁需监护人同意，位置与环境感知保持关闭'};
  if(k==='motion')return on?await L.motion.start():(L.motion.stop(),{ok:true});
  if(k==='scene'){if(!on){L.env.stop();track('env_cfg',{on:false});return {ok:true}}
    if(!confirm('开启环境感知：\n· 每隔一段时间打开麦克风听 3 秒\n· 只在本机判断“安静 / 交谈 / 嘈杂 / 音乐”，不保存音频、不转文字、不识别是谁\n· 可能听到身边其他人的声音，请在合适的场合使用\n· 收音时页面顶部会亮红点，可随时关闭'))return {ok:false,msg:'已取消，环境感知保持关闭'};
    const r=await listen('first');if(!r.ok)return r;track('env_cfg',{on:true,every:L.cfg.envEvery||15});return {ok:true}}
  return {ok:true};
};
L.privacyExtra=()=>{const inFrame=(()=>{try{return window.top!==window}catch(e){return true}})();
  return `<label class="lf-sel">环境感知间隔 <select data-envevery>${[5,15,30,60].map(n=>`<option value="${n}" ${(L.cfg.envEvery||15)===n?'selected':''}>每 ${n} 分钟</option>`).join('')}</select></label>
  <p class="lf-note">定位：精度差于 300 米的点直接丢弃；页面打开时每 5 分钟取一次，切到后台即停。${L.geoLast?`最近一次定位精度约 ${L.geoLast.acc} 米${L.geoLast.ok?'':'（已丢弃）'}。`:''}</p>
  ${inFrame?`<p class="lf-warn">当前页面嵌在其他网页里，浏览器可能拦截定位、麦克风和运动传感器。<button type="button" class="g-btn ghost" data-popout>在新窗口打开</button></p>`:''}`};
document.addEventListener('change',e=>{const s=e.target.closest('[data-envevery]');if(s){L.cfg.envEvery=+s.value;L.saveCfg();track('env_cfg',{every:L.cfg.envEvery});showChip(statusTxt())}});
document.addEventListener('click',e=>{if(e.target.closest('[data-popout]')){try{window.open(location.href,'_blank','noopener')}catch(err){}}});
if(L.cfg.scene)setTimeout(()=>showChip(statusTxt()),2000);
})();

/* ===== v7 遇见码二维码：精简 QR 编码器（字节模式 · 纠错 M · 版本 1–15） ===== */
window.__pgQR=(()=>{
const ECC=[-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24],NB=[-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10];
const raw=v=>{let r=(16*v+128)*v+64;if(v>=2){const n=Math.floor(v/7)+2;r-=(25*n-10)*n-55;if(v>=7)r-=36}return r};
const dataCw=v=>Math.floor(raw(v)/8)-ECC[v]*NB[v];
const mul=(x,y)=>{let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11D);z^=((y>>>i)&1)*x}return z&255};
function div(d){const r=Array(d).fill(0);r[d-1]=1;let root=1;for(let i=0;i<d;i++){for(let j=0;j<d;j++){r[j]=mul(r[j],root);if(j+1<d)r[j]^=r[j+1]}root=mul(root,2)}return r}
function rem(data,dv){const r=dv.map(()=>0);for(const b of data){const f=b^r.shift();r.push(0);dv.forEach((c,i)=>r[i]^=mul(c,f))}return r}
function align(v){if(v===1)return [];const n=Math.floor(v/7)+2,step=Math.ceil((v*4+4)/(n*2-2))*2,r=[6];for(let p=v*4+10;r.length<n;p-=step)r.splice(1,0,p);return r}
function encode(text){
  const bytes=[...new TextEncoder().encode(text)];let v=1;
  for(;v<=15;v++){const cap=dataCw(v)*8,need=4+(v<10?8:16)+bytes.length*8;if(need<=cap)break}
  if(v>15)throw new Error('内容太长');
  const bits=[];const put=(val,n)=>{for(let i=n-1;i>=0;i--)bits.push((val>>>i)&1)};
  put(4,4);put(bytes.length,v<10?8:16);bytes.forEach(b=>put(b,8));
  const cap=dataCw(v)*8;put(0,Math.min(4,cap-bits.length));put(0,(8-bits.length%8)%8);for(let p=0xEC;bits.length<cap;p^=0xEC^0x11)put(p,8);
  const data=[];for(let i=0;i<bits.length;i+=8)data.push(bits.slice(i,i+8).reduce((a,b)=>a<<1|b,0));
  const nb=NB[v],el=ECC[v],rc=Math.floor(raw(v)/8),ns=nb-rc%nb,sl=Math.floor(rc/nb),dv=div(el),blocks=[];
  for(let i=0,k=0;i<nb;i++){const dat=data.slice(k,k+sl-el+(i<ns?0:1));k+=dat.length;const e=rem(dat,dv);if(i<ns)dat.push(0);blocks.push(dat.concat(e))}
  const cw=[];for(let i=0;i<blocks[0].length;i++)blocks.forEach((b,j)=>{if(i!==sl-el||j>=ns)cw.push(b[i])});
  const N=v*4+17,M=[...Array(N)].map(()=>Array(N).fill(false)),F=[...Array(N)].map(()=>Array(N).fill(false));
  const set=(x,y,d)=>{M[y][x]=d;F[y][x]=true};
  for(let i=0;i<N;i++){set(6,i,i%2===0);set(i,6,i%2===0)}
  [[3,3],[N-4,3],[3,N-4]].forEach(([x,y])=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const xx=x+dx,yy=y+dy,d=Math.max(Math.abs(dx),Math.abs(dy));if(xx>=0&&xx<N&&yy>=0&&yy<N)set(xx,yy,d!==2&&d!==4)}});
  const ap=align(v),la=ap.length-1;ap.forEach((a,i)=>ap.forEach((b,j)=>{if((i===0&&j===0)||(i===0&&j===la)||(i===la&&j===0))return;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(a+dx,b+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1)}));
  const fmt=mask=>{const d=0<<3|mask;let r=d;for(let i=0;i<10;i++)r=(r<<1)^((r>>>9)*0x537);const b=(d<<10|r)^0x5412,g=i=>((b>>>i)&1)===1;
    for(let i=0;i<=5;i++)set(8,i,g(i));set(8,7,g(6));set(8,8,g(7));set(7,8,g(8));for(let i=9;i<15;i++)set(14-i,8,g(i));
    for(let i=0;i<8;i++)set(N-1-i,8,g(i));for(let i=8;i<15;i++)set(8,N-15+i,g(i));set(8,N-8,true)};
  fmt(0);
  if(v>=7){let r=v;for(let i=0;i<12;i++)r=(r<<1)^((r>>>11)*0x1F25);const b=v<<12|r;for(let i=0;i<18;i++){const d=((b>>>i)&1)===1,a=N-11+i%3,c=Math.floor(i/3);set(a,c,d);set(c,a,d)}}
  let i=0;for(let right=N-1;right>=1;right-=2){if(right===6)right=5;for(let vert=0;vert<N;vert++)for(let j=0;j<2;j++){const x=right-j,up=((right+1)&2)===0,y=up?N-1-vert:vert;if(!F[y][x]&&i<cw.length*8){M[y][x]=((cw[i>>>3]>>>(7-(i&7)))&1)===1;i++}}}
  const MK=[(x,y)=>(x+y)%2===0,(x,y)=>y%2===0,(x,y)=>x%3===0,(x,y)=>(x+y)%3===0,(x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2===0,(x,y)=>x*y%2+x*y%3===0,(x,y)=>(x*y%2+x*y%3)%2===0,(x,y)=>((x+y)%2+x*y%3)%2===0];
  const apply=k=>{for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(!F[y][x]&&MK[k](x,y))M[y][x]=!M[y][x]};
  const pen=()=>{let p=0;const line=get=>{let run=1,s='';for(let k=0;k<N;k++){s+=get(k)?'1':'0';if(k&&get(k)===get(k-1)){run++;if(run===5)p+=3;else if(run>5)p++}else run=1}p+=((s.match(/(?=10111010000|00001011101)/g)||[]).length)*40};
    for(let y=0;y<N;y++)line(x=>M[y][x]);for(let x=0;x<N;x++)line(y=>M[y][x]);
    for(let y=0;y<N-1;y++)for(let x=0;x<N-1;x++){const c=M[y][x];if(c===M[y][x+1]&&c===M[y+1][x]&&c===M[y+1][x+1])p+=3}
    let dark=0;M.forEach(r=>r.forEach(c=>dark+=c));p+=Math.floor(Math.abs(dark*20-N*N*10)/(N*N))*10;return p};
  let best=0,bp=1e9;for(let k=0;k<8;k++){apply(k);fmt(k);const p=pen();if(p<bp){bp=p;best=k}apply(k)}
  apply(best);fmt(best);
  return {size:N,get:(x,y)=>M[y][x],version:v};
}
function canvas(text,scale=4,border=4,dark='#2b2238',light='#fff'){const q=encode(text),n=q.size+border*2,c=document.createElement('canvas');c.width=c.height=n*scale;const g=c.getContext('2d');g.fillStyle=light;g.fillRect(0,0,c.width,c.height);g.fillStyle=dark;for(let y=0;y<q.size;y++)for(let x=0;x<q.size;x++)if(q.get(x,y))g.fillRect((x+border)*scale,(y+border)*scale,scale,scale);return c}
return {encode,canvas};
})();

/* ===== v7 近场社交：遇见确认（敲暗号 / 连点暗号 / 扫码 / 缘分擦肩）· 礼物 · 联机生蛋 · 图鉴 · 性格 ===== */
(()=>{
const L=window.__pgLife;if(!L||!window.__petGame)return;
const $=id=>document.getElementById(id);
const G=()=>window.__petGame;const P=()=>{try{return G().state().pet}catch(e){return null}};
const ST=()=>G().store;
const track=(n,p={})=>{try{window.__petAnalytics?.track(n,p)}catch(e){}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=m=>L.toast(m);
const load=L.store.load,save=L.store.save,dk=L.dayKey;
const pick=a=>a[Math.floor(Math.random()*a.length)];
const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0};
const uid=()=>Math.random().toString(36).slice(2,10);
const H=36e5,DAY=864e5;
const KEY='pg-social-v1';
const DEF={v:1,me:{id:'u'+uid(),secret:uid()+uid()},cfg:{discover:true,scope:'any',alertCap:6,fate:false,tol:15,dur:30,voice:1,tone:true,vib:true,club:'',contact:''},
  friends:{},seen:{},dex:{cards:{},locked:{},seals:[],rhythms:[],fate:[],regions:{},firsts:{}},gifts:{inbox:[],prepared:[],given:0,gen:0,crit:0,log:[]},
  furn:{owned:{},placed:{}},skills:{},persona:{},log:[],daily:{},nonces:[],blocked:{},reports:[],hv:{},alerted:{},lastShop:0,hatched:[],world:{log:[],unseen:0}};
const D=Object.assign(JSON.parse(JSON.stringify(DEF)),load(KEY,{}));
for(const k of Object.keys(DEF))if(DEF[k]&&typeof DEF[k]==='object'&&!Array.isArray(DEF[k]))D[k]=Object.assign(JSON.parse(JSON.stringify(DEF[k])),D[k]||{});
const saveD=()=>save(KEY,D);saveD();
const today=()=>{const k=dk(new Date());if(D.daily.k!==k)D.daily={k,alerts:0,fate:0,gifts:0,eggs:0,envy:0,meets:0,coins:0,world:0};return D.daily};
const weekKey=(t=Date.now())=>{const d=new Date(t);d.setHours(0,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7);return dk(d)};
function slog(icon,msg){D.log.unshift({t:Date.now(),icon,msg});D.log=D.log.slice(0,60);saveD()}
const petName=()=>P()?.name||'小橘';
const ago=t=>{const m=Math.round((Date.now()-t)/6e4);return m<1?'刚刚':m<60?`${m} 分钟前`:m<1440?`${Math.round(m/60)} 小时前`:`${Math.round(m/1440)} 天前`};
/* ---------- 目录 ---------- */
const BREEDS=()=>P()?.catalog?.breeds||[];
const BN=id=>BREEDS().find(b=>b.id===id)?.name||'小猫';
const OUTS=()=>P()?.catalog?.outfits||[];
const ON=id=>OUTS().find(o=>o.id===id)?.name||'';
const GIFT_OUT=['sakura','bell','crown','cape'];
const ITEMS={fish:{n:'小鱼',i:'🐟'},flower:{n:'野花',i:'🌼'},shell:{n:'贝壳',i:'🐚'},star:{n:'星星石',i:'✨'}};
const FURN={lamp:{n:'星星夜灯',i:'🌟',d:'晚上会亮起暖黄色的光'},plant:{n:'小盆栽',i:'🪴',d:'窗边的一小盆绿意'},scratch:{n:'猫抓板',i:'🪵',d:'小猫最爱的磨爪角落'},yarn:{n:'毛线球篮',i:'🧶',d:'一篮彩色毛线球'}};
const SKILLS={cook:{n:'烹饪',i:'🍳',d:'喂饭 + 喝水累计 12 次'},show:{n:'表演',i:'🎭',d:'摸摸 + 逗猫 + 接鱼累计 12 次'},explore:{n:'探险',i:'🧭',d:'爬高 3 次 + 户外活动 3 次'},tidy:{n:'整洁',i:'🫧',d:'洗澡累计 6 次'}};
const DIMS=[['ext','外向','内向'],['clingy','粘人','独立'],['show','爱炫','务实'],['curious','好奇','稳重'],['greedy','贪吃','挑食']];
const REGIONS={'r-sakura':{n:'樱花社团据点',sp:'樱花书签',i:'🌸'},'r-river':{n:'河边步道',sp:'河岸鹅卵石',i:'🪨'},'r-campus':{n:'校园动漫社',sp:'社团纪念徽章',i:'🎓'},'r-expo':{n:'漫展会场',sp:'限定场贩贴纸',i:'🎪'}};
function myRegion(){const c=(D.cfg.club||'').trim();if(c)return {id:'c-'+hash(c).toString(36),n:c,sp:`${c}特产小饼干`,i:'🏷️'};return {id:'r-local-'+D.me.id.slice(1,5),n:'我的街区',sp:`${petName()}家门口的小石子`,i:'🏘️'}}
const regionOf=id=>REGIONS[id]||D.dex.regions[id]||null;
/* 官方 NPC 小猫：空场景兜底（8.8），带据点与特产 */
const NPCS=[
 {fid:'npc-mochi',owner:'官方小猫',petName:'麻薯',breed:'ragdoll',sex:'female',outfit:'bow',stage:'adult',region:'r-sakura',skills:['show'],persona:{ext:80,clingy:62,show:70,curious:48,greedy:40},rhythm:[0,.18,.36,.68,1]},
 {fid:'npc-pudding',owner:'官方小猫',petName:'布丁',breed:'siamese',sex:'male',outfit:'scarf',stage:'adult',region:'r-river',skills:['cook','explore'],persona:{ext:45,clingy:35,show:30,curious:82,greedy:76},rhythm:[0,.3,.45,.6,1]},
 {fid:'npc-soda',owner:'官方小猫',petName:'汽水',breed:'blue',sex:'male',outfit:'cap',stage:'adult',region:'r-campus',skills:['tidy'],persona:{ext:60,clingy:50,show:55,curious:60,greedy:50},rhythm:[0,.25,.5,.75,1]},
 {fid:'npc-lemon',owner:'官方小猫',petName:'柠檬',breed:'tuxedo',sex:'female',outfit:'backpack',stage:'adult',region:'r-expo',skills:['explore','show'],persona:{ext:72,clingy:30,show:64,curious:76,greedy:35},rhythm:[0,.15,.3,.65,.82,1]}];
/* ---------- 性格：5 维，按猫咪 id 播种，事件中漂移，后代取父母平均 ---------- */
function persona(cat){cat=cat||P();if(!cat)return {ext:50,clingy:50,show:50,curious:50,greedy:50};const id=cat.id||'cat-1';
  if(!D.persona[id]){const h=hash(id+(cat.joinedAt||''));D.persona[id]=Object.fromEntries(DIMS.map(([k],i)=>[k,25+((h>>>(i*5))%51)]));saveD()}return D.persona[id]}
function drift(ch,why){const p=persona();Object.entries(ch).forEach(([k,v])=>{p[k]=Math.max(0,Math.min(100,p[k]+v))});saveD()}
function ptag(p){return DIMS.map(([k,a,b])=>p[k]>=60?a:p[k]<=40?b:null).filter(Boolean).slice(0,3).join(' · ')||'性格温和'}
/* ---------- 技能：由主人的养成路线决定，可在相处时互学 ---------- */
function ownSkills(cat){cat=cat||P();if(!cat)return [];const c=cat.counts||{},w=P()?.world?.completed||{};const s=[];
  if((c.feed||0)+(c.drink||0)>=12)s.push('cook');if((c.pet||0)+(c.tease||0)+(c.play||0)>=12)s.push('show');if((c.climb||0)>=3&&(w.walk||0)+(w.explore||0)+(w.fish||0)>=3)s.push('explore');if((c.bath||0)>=6)s.push('tidy');
  return [...new Set([...s,...(D.skills[cat.id]||[])])]}
/* ---------- 像素小猫（按品种 / 服装着色） ---------- */
const CAT=["..O.......O..",".OOO.....OOO.",".OODOOOOODOO.","OOOODDODDOOOO","OOKOOOOOOOKOO","OOOOOOPOOOOOO",".OOWWWWWWWOO.","..OWWWWWWWO..","..OOOWWWOOO.T",".OODOOOOODOOT",".OOOOOOOOOOTT",".OWW.OOO.WWO."];
const PALS={orange:['#eb9a5c','#c96d34','#fff3e2'],silver:['#bcc3c6','#5d6a6d','#f4f4f0'],tuxedo:['#343c41','#252c30','#f8f6ee'],siamese:['#e9dcc2','#64544a','#efe4cf'],ragdoll:['#f3ece2','#8d7d73','#fffbec'],blue:['#7d91a8','#6a7f98','#8ea0b4'],calico:['#f7ecdf','#e2873e','#fff8ea'],golden:['#e6b466','#c38a3e','#f8ecd0'],starry:['#2f3b68','#232c55','#46519a']};
const OUTC={bandana:'#e96f57',bow:'#d990b2',cap:'#71a0aa',raincoat:'#eec85b',backpack:'#7a9c7a',scarf:'#62a39a',sakura:'#f7a8c8',bell:'#d8b04e',crown:'#f2c94c',cape:'#2b4170'};
function drawPet(g,x,y,s,breed='orange',o={}){const p=PALS[breed]||PALS.orange,blink=o.blink,fl=o.flip;
  CAT.forEach((row,r)=>[...row].forEach((ch,c)=>{if(ch==='.')return;let col=ch==='D'?p[1]:ch==='W'?p[2]:ch==='P'?'#f2a0a0':ch==='K'?'#3b2a20':p[0];
    if(breed==='calico'&&(ch==='O'||ch==='T'||ch==='D')){const h=(Math.floor(c/2)*7+Math.floor(r/2)*5)%9;col=h<2?'#e2873e':h<4?'#3a3330':p[0]}
    if(breed==='siamese'&&(ch==='O'||ch==='D'||ch==='T')&&(r<3||ch==='T'||r>=10))col=p[1];
    if(breed==='ragdoll'&&(ch==='O'||ch==='D')&&(r<4)&&(c<4||c>8))col=p[1];
    if(breed==='starry'&&ch==='O'&&(c*5+r*3)%11===0)col='#fff4b8';
    if(breed==='golden'&&ch==='O'&&r<3)col=p[1];
    if(ch==='K'){col=blink?p[0]:breed==='starry'?(c<6?'#f0be46':'#62aee8'):(breed==='siamese'||breed==='ragdoll')?'#4f8fc0':'#3b2a20'}
    const cc=fl?12-c:c;g.fillStyle=col;g.fillRect(Math.round(x+cc*s),Math.round(y+r*s),s,s)}));
  const of=o.outfit,oc=OUTC[of];if(!oc||of==='none')return;const px=(c,r,col=oc)=>{g.fillStyle=col;g.fillRect(Math.round(x+(fl?12-c:c)*s),Math.round(y+r*s),s,s)};
  if(of==='crown'){[4,5,6,7,8].forEach(c=>px(c,0));[4,6,8].forEach(c=>px(c,-1));px(6,0,'#e76f6f')}
  else if(of==='bow'){px(9,1);px(10,1);px(11,1);px(10,0)}
  else if(of==='cap'){[3,4,5,6,7,8,9].forEach(c=>px(c,1));[4,5,6,7,8].forEach(c=>px(c,0));px(2,2,'#4e7a85')}
  else if(of==='sakura'){px(10,1);px(9,1,'#fbd0e1');px(11,1,'#fbd0e1');px(10,0,'#fbd0e1');px(10,2,'#fbd0e1');px(10,1,'#ffe066')}
  else if(of==='bell'){[3,4,5,6,7,8,9].forEach(c=>px(c,7,'#c94f4f'));px(6,8,'#f0c64e')}
  else if(of==='bandana'||of==='scarf'){[3,4,5,6,7,8,9].forEach(c=>px(c,7));px(5,8);px(6,8);px(7,8)}
  else if(of==='cape'){[1,2,3,4,8,9,10,11].forEach(c=>px(c,9));[1,2,10,11].forEach(c=>px(c,10));px(2,9,'#fff4b8')}
  else{[1,2,3,9,10,11].forEach(c=>px(c,9))}}
function petCanvas(breed,outfit,s=4,flip=false){const c=document.createElement('canvas');c.width=13*s;c.height=13*s;c.className='sc-pet';const g=c.getContext('2d');drawPet(g,0,s,s,breed,{outfit,flip});return c}
function petImg(breed,outfit,s=4){try{return `<img class="sc-petimg" alt="" src="${petCanvas(breed,outfit,s).toDataURL()}" width="${13*s}" height="${13*s}">`}catch(e){return ''}}
/* ---------- 附近的人：官方 NPC 路过 + 同一浏览器其他窗口（BroadcastChannel 模拟 BLE 广播） ---------- */
const peers=new Map();
const air=null; /* Browser windows never stand in for physical badges. */
function meCard(){const p=P();const r=myRegion();return {fid:D.me.id,owner:'匿名主人',petName:p?.name||'小橘',breed:p?.breed||'orange',sex:p?.sex||'male',outfit:p?.outfit||'none',stage:p?.stage||'kitten',region:r.id,regionInfo:r,skills:ownSkills(),persona:persona(),cards:giveableCards().slice(0,12)}}
function send(type,data={}){if(!air)return;try{air.postMessage({type,from:D.me.id,...data})}catch(e){}}
const distOf=rssi=>Math.max(.2,Math.pow(10,(-59-rssi)/20));
let npcNext=Date.now()+8e3,npcCur=null;
function scopeOk(){if(!D.cfg.discover)return false;if(D.cfg.scope==='spots'){const sg=L.segAt(L.day(),L.nowMin());return sg.kind==='out'||sg.kind==='move'||sg.kind==='work'}return true}
function tickPeers(){if(window.CatOfflineDurable?.transactionPaused)return;const now=Date.now();
  if(air&&scopeOk())send('adv',{card:meCard(),rssi:-50-Math.round(Math.random()*6),t:now});
  if(scopeOk()&&!npcCur&&now>npcNext){const cand=NPCS.filter(n=>!D.blocked[n.fid]);if(cand.length){const n=cand[Math.floor(Math.random()*cand.length)];npcCur={...n,src:'npc',t0:now,rssi:-92};peers.set(n.fid,npcCur);track('social_peer_found',{src:'npc'})}}
  if(npcCur){const k=(now-npcCur.t0)/1e3;npcCur.rssi=k<20?-92+k*1.8:k<110?-56+Math.sin(k)*2:-56-(k-110)*2;npcCur.lastSeen=now;npcCur.dist=distOf(npcCur.rssi);
    if(k>135&&!meetOpen(npcCur.fid)){peers.delete(npcCur.fid);npcCur=null;npcNext=now+(90+Math.random()*120)*1e3}}
  for(const [id,p] of peers)if(p.src==='air'&&now-p.lastSeen>8e3)peers.delete(id);
  for(const p of peers.values())if(p.dist<=3)maybeAlert(p);
  renderNearbyLive();
}
function spawnNpc(){if(npcCur&&peers.has(npcCur.fid))return npcCur;npcNext=0;tickPeers();return npcCur}
function S_NPCOK(){const v=window.__pgSocial&&window.__pgSocial.npcOk;return typeof v==="number"?v:.92}
/* ---------- 3 米内提醒：屏幕边缘发光 + 提示音 + 震动；每天有上限 ---------- */
let actx=null;function tone(f=880,d=.08,v=.08,delay=0){if(!D.cfg.tone)return;try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();const t=actx.currentTime+delay,o=actx.createOscillator(),g=actx.createGain();o.type='square';o.frequency.value=f;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g).connect(actx.destination);o.start(t);o.stop(t+d+.02)}catch(e){}}
const vib=p=>{if(D.cfg.vib)try{navigator.vibrate?.(p)}catch(e){}};
const glow=document.createElement('div');glow.id='sc-glow';document.body.appendChild(glow);
const banner=document.createElement('div');banner.id='sc-banner';banner.hidden=true;document.body.appendChild(banner);
function showBanner(html,fid,ms=9000){banner.innerHTML=html;banner.hidden=false;banner.dataset.fid=fid||'';clearTimeout(banner._t);banner._t=setTimeout(()=>banner.hidden=true,ms)}
banner.addEventListener('click',e=>{const b=e.target.closest('[data-bmeet]');if(b){banner.hidden=true;openMeet(b.dataset.bmeet)}if(e.target.closest('[data-bx]'))banner.hidden=true});
function maybeAlert(p){const d=today();if(!D.cfg.discover||D.blocked[p.fid])return;if((D.alerted[p.fid]||0)>Date.now()-30*6e4)return;if(d.alerts>=D.cfg.alertCap)return;if(meetOpen())return;
  D.alerted[p.fid]=Date.now();d.alerts++;saveD();const f=D.friends[p.fid];
  glow.classList.remove('on');void glow.offsetWidth;glow.classList.add('on');tone(988,.09);tone(1319,.12,.08,.12);vib([80,60,80]);
  showBanner(`<span class="sc-bpet">${petImg(p.breed,p.outfit,3)}</span><div><b>${f?`老朋友「${esc(f.petName)}」就在附近`:`附近 3 米内有一只${esc(BN(p.breed))}`}</b><small>约 ${p.dist.toFixed(1)} 米 · ${f?'敲出友谊暗号打个招呼':'主人匿名，先让小猫们打个招呼'}</small></div><button type="button" class="g-btn" data-bmeet="${esc(p.fid)}">去遇见</button><button type="button" class="sc-bx" data-bx aria-label="关闭">×</button>`,p.fid);
  L.quirk?.react('📡',f?`是${f.petName}！`:'附近有同类的气息！');track('social_alert',{src:p.src,friend:!!f,d:+p.dist.toFixed(1)})}
/* ---------- 空中消息（同一浏览器多窗口 = 模拟蓝牙 / 云端中转） ---------- */
air&&air.addEventListener('message',e=>{const m=e.data||{};if(!m.from||m.from===D.me.id||D.blocked[m.from])return;if(m.to&&m.to!==D.me.id)return;
  if(m.type==='adv'){const had=peers.has(m.from);peers.set(m.from,{...m.card,src:'air',rssi:m.rssi,dist:distOf(m.rssi),lastSeen:Date.now()});if(!had)track('social_peer_found',{src:'air'});return}
  const pr=peers.get(m.from);
  if(m.type==='invite'){if(!meetOpen(m.from))showBanner(`<span class="sc-bpet">${pr?petImg(pr.breed,pr.outfit,3):''}</span><div><b>「${esc(pr?.petName||'附近的小猫')}」想和你对暗号</b><small>长按实体键 1 秒进入，15 秒内有效</small></div><button type="button" class="g-btn" data-bmeet="${esc(m.from)}">去对暗号</button><button type="button" class="sc-bx" data-bx aria-label="关闭">×</button>`,m.from,15000);tone(880,.08);vib(60);return}
  if(m.type==='meet-gift'){receiveGift(m.from,m.gift,m.card,m.peer);return}
  if(m.type==='contact-req'){contactReq(m.from,m.info);return}
  if(m.type==='contact-ok'){const f=D.friends[m.from];if(f){f.contact={...f.contact,theirs:true,info:String(m.info||'').slice(0,40),mine:true};saveD();toast(`「${f.petName}」的主人同意交换联系方式`);track('contact_unlock',{src:'air'});renderHub()}return}
  if(m.type==='contact-no'){toast('对方暂时不想交换联系方式');return}
  if(m.type==='egg-req'){eggReq(m.from,m.card,m.rare);return}
  if(m.type==='egg-ok'){const f=D.friends[m.from];if(f){startEgg(f,m.rare,true)}return}
  if(m.type==='egg-no'){toast('对方暂时不想一起生蛋');return}
  if(m.type==='unfriend'){if(D.friends[m.from]){delete D.friends[m.from];saveD();renderHub()}return}
  if(M&&M.peer.fid===m.from)onMeetMsg(m);
});
/* ---------- 遇见浮层：圆屏吧唧 + 实体键 ---------- */
let M=null;
const meetOpen=fid=>!!M&&(!fid||M.peer.fid===fid);
const mov=document.createElement('div');mov.id='sc-meet';mov.className='sc-ov';mov.setAttribute('role','dialog');mov.setAttribute('aria-modal','true');mov.setAttribute('aria-label','遇见确认');
mov.innerHTML=`<div class="sc-mbox"><header class="sc-mhead"><span id="sc-mpet"></span><div><b id="sc-mtitle"></b><small id="sc-msub"></small></div><button type="button" class="lf-x" data-mclose aria-label="关闭">×</button></header>
<nav class="sc-mtabs" id="sc-mtabs"></nav>
<div class="sc-bwrap"><div class="sc-screen" id="sc-screen"></div><button type="button" class="sc-key" id="sc-key" aria-label="实体键：长按 1 秒进入对暗号">键</button></div>
<p class="sc-hint" id="sc-hint"></p><div class="sc-mact" id="sc-mact"></div></div>`;
document.body.appendChild(mov);
function peerOf(fid){return peers.get(fid)||(D.friends[fid]&&{...D.friends[fid],src:D.friends[fid].src||'npc',dist:9})||NPCS.find(n=>n.fid===fid)&&{...NPCS.find(n=>n.fid===fid),src:'npc',dist:2}||null}
function openMeet(fid,tab){if(String(fid).startsWith('device:')){toast('请在双方吧唧上对暗号，完成后会自动同步到这里。');return;}const p=peerOf(fid);if(!p){toast('对方已经走远了');return}
  if(!P()){return}
  M={peer:p,tab:tab||'rhythm',R:{ph:'idle'},Dt:{},F:{},t0:Date.now()};mov.classList.add('on');banner.hidden=true;
  const f=D.friends[p.fid];$('sc-mpet').innerHTML=petImg(p.breed,p.outfit,4);
  $('sc-mtitle').textContent=f?`老朋友「${p.petName}」`:`${BN(p.breed)}「${p.petName}」`;
  $('sc-msub').textContent=f?`好友 Lv${lvl(f).lv} · 上次见面 ${ago(f.lastAt)}`:`${p.src==='npc'?'官方小猫 · 据点 '+(REGIONS[p.region]?.n||''):'匿名主人'} · 约 ${(p.dist||1).toFixed(1)} 米`;
  if(p.src==='air')send('invite',{to:p.fid});
  renderMeetTabs();renderMeet();track('social_confirm_open',{src:p.src,friend:!!f})}
function closeMeet(){keyControl.cancel(true);if(M){clearTimeout(M.R.timer);clearTimeout(M.R.idle);clearInterval(M.R.cd);stopFate();stopScan();cancelAnimationFrame(M.anim||0)}M=null;mov.classList.remove('on')}
mov.addEventListener('click',e=>{if(e.target===mov||e.target.closest('[data-mclose]'))closeMeet();const t=e.target.closest('[data-mtab]');if(t&&M&&!M.done){resetGame();M.tab=t.dataset.mtab;renderMeetTabs();renderMeet()}});
function renderMeetTabs(){const f=D.friends[M.peer.fid];const tabs=[['rhythm','敲暗号'],['dots','连点暗号']];
  $('sc-mtabs').innerHTML=tabs.map(([k,n])=>`<button type="button" data-mtab="${k}" aria-pressed="${M.tab===k}">${n}</button>`).join('');$('sc-key').hidden=M.tab!=='rhythm'}
function hint(t){const h=$('sc-hint');if(h)h.innerHTML=t}
function resetGame(){keyControl.cancel(true);if(!M)return;clearTimeout(M.R.timer);clearTimeout(M.R.idle);clearInterval(M.R.cd);stopFate();stopScan();M.R={ph:'idle'};M.Dt={};M.F={}}
function renderMeet(){if(!M)return;const tab=M.tab,scr=$('sc-screen'),act=$('sc-mact');scr.className='sc-screen '+tab;
  if(tab==='rhythm'){scr.innerHTML=`<div class="sc-rpulse" id="sc-rp"></div><div class="sc-rnpc" id="sc-rnpc">${petImg(M.peer.breed,M.peer.outfit,3)}</div><div class="sc-rtaps" id="sc-rtaps"></div><div class="sc-rtxt" id="sc-rtxt">长按实体键</div><svg class="sc-rcd" viewBox="0 0 100 100"><circle id="sc-rcdc" cx="50" cy="50" r="47" pathLength="100"/></svg>`;
    const f=D.friends[M.peer.fid];
    act.innerHTML=`<button type="button" class="g-btn ghost" data-r="npclead" ${M.peer.src==='air'?'hidden':''}>让${esc(M.peer.petName)}先敲</button><span class="sc-small">一人敲、一人跟：先敲的人敲 4–8 下，停 1.2 秒算敲完；跟的人 5 秒内跟上。电脑可按空格键敲。</span>`;
    hint(f?.rhythm?`你们的友谊暗号：${rhythmGlyph(f.rhythm)}　敲出来就是老朋友打招呼`:'双方长按实体键 1 秒进入「对暗号」（15 秒内有效），轻点圆屏就是敲');rUI()}
  if(tab==='dots'){const f=D.friends[M.peer.fid];scr.innerHTML=dotsSvg();bindDots();
    act.innerHTML=`<button type="button" class="g-btn ghost" data-d="npcfirst" ${M.peer.src==='air'?'hidden':''}>让${esc(M.peer.petName)}先画给你看</button><span class="sc-small">钟面 8 个点 + 中心 1 个点，顺序一致即匹配，至少 4 个点。连出爱心 / 星星有彩蛋。</span>`;
    hint(f?.seal?`你们的友谊印章：${sealSvg(f.seal,34)} 连出同样的图形也能打招呼`:M.peer.src==='air'?'两人各自连同一个图形（先口头约好），15 秒内都连完就会比对':'先约定图形：可以让它先画给你看，再照着连')}
  if(tab==='qr')renderQr();
  if(tab==='fate')renderFate();
}
/* ---------- 敲暗号 ---------- */
const nowT=()=>performance.now();
function rUI(){if(!M||M.tab!=='rhythm')return;const R=M.R,tx=$('sc-rtxt'),tp=$('sc-rtaps');if(!tx)return;
  const n=(R.role==='follow'?R.follow:R.lead)||[];tp.innerHTML=Array.from({length:Math.max(4,n.length)},(_,i)=>`<i class="${i<n.length?'on':''}"></i>`).join('');
  const T={idle:'长按实体键',armed:M.peer.src==='air'&&!R.partnerArmed?'等对方也长按…':'轻点屏幕开始敲',lead:'敲 4–8 下，停下就算敲完',watch:`看${M.peer.petName}敲…`,'follow-wait':'轮到你跟着敲！',follow:'跟着敲…','npc-follow':`${M.peer.petName}在跟…`,'wait-follow':'等对方跟敲…',judge:'比对中…'};
  tx.textContent=T[R.ph]||'';$('sc-screen').classList.toggle('armed',R.ph!=='idle')}
function pulse(mine=true){const p=$('sc-rp');if(p){p.classList.remove('hit','other');void p.offsetWidth;p.classList.add(mine?'hit':'other')}const n=$('sc-rnpc');if(n&&!mine){n.classList.remove('bop');void n.offsetWidth;n.classList.add('bop')}tone(mine?880:660,.06,.07)}
function arm(){const R=M.R;if(R.ph!=='idle')return;R.ph='armed';R.until=Date.now()+15e3;R.partnerArmed=M.peer.src!=='air'||R.partnerArmed;vib(40);tone(523,.08);
  if(M.peer.src==='air')send('rhy-arm',{to:M.peer.fid});track('social_confirm_start',{method:'rhythm',src:M.peer.src});
  const c=$('sc-rcdc');R.cd=setInterval(()=>{const left=Math.max(0,R.until-Date.now());if(c)c.style.strokeDashoffset=String(100-left/150);if(!left&&['armed','lead','follow-wait','wait-follow'].includes(R.ph)){clearInterval(R.cd);fail('15 秒内没有对上暗号','timeout')}},100);rUI()}
const keyControl=window.CatOfflineMeetKey.bind({w:window,modal:mov,key:$('sc-key'),getSession:()=>M,arm});
mov.addEventListener('pointerdown',e=>{if(!M)return;if(M.tab==='rhythm'&&e.target.closest('#sc-screen')){e.preventDefault();tap()}});
addEventListener('keydown',e=>{if(!M||M.tab!=='rhythm'||e.repeat)return;if(e.code==='Space'){e.preventDefault();if(M.R.ph==='idle'){arm();return}tap()}if(e.key==='Escape')closeMeet()});
function tap(){const R=M.R,t=nowT();
  if(R.ph==='idle'){hint('先长按实体键 1 秒进入「对暗号」');$('sc-key').classList.add('nudge');setTimeout(()=>$('sc-key')?.classList.remove('nudge'),600);return}
  if(R.ph==='armed'){if(!R.partnerArmed){hint('等对方也长按实体键进入「对暗号」');return}R.ph='lead';R.role='lead';R.lead=[t];R.startAt=Date.now();if(M.peer.src==='air')send('rhy-start',{to:M.peer.fid,at:R.startAt});pulse();idle(leadDone);rUI();return}
  if(R.ph==='lead'){R.lead.push(t);pulse();idle(leadDone);rUI();return}
  if(R.ph==='follow-wait'){if(Date.now()>R.followBy){fail('超过 5 秒没有跟上','late');return}R.ph='follow';R.role='follow';R.follow=[t];if(M.peer.src==='air')send('rhy-fol',{to:M.peer.fid});pulse();idle(followDone);rUI();return}
  if(R.ph==='follow'){R.follow.push(t);pulse();idle(followDone);rUI();return}}
function idle(fn){clearTimeout(M.R.idle);M.R.idle=setTimeout(fn,1200)}
function leadDone(){const R=M.R,n=R.lead.length;if(n<4||n>8){R.ph='armed';R.lead=[];hint(`刚才敲了 ${n} 下，要敲 4–8 下哦`);rUI();return}
  if(M.peer.src==='air'){R.ph='wait-follow';send('rhy-lead',{to:M.peer.fid,taps:R.lead.map(x=>x-R.lead[0])});R.until=Date.now()+12e3;rUI();return}
  R.ph='npc-follow';rUI();const base=R.lead.map(x=>x-R.lead[0]);const ok=Math.random()<(S_NPCOK());const sc=ok?1+(Math.random()-.5)*.12:1.5;
  const taps=base.map((x,i)=>x*sc+(i?(Math.random()-.5)*(ok?40:260):0));if(!ok&&Math.random()<.5)taps.pop();
  const t0=nowT()+650;taps.forEach(x=>setTimeout(()=>{if(M)pulse(false)},650+x));R.timer=setTimeout(()=>{if(!M)return;finishRhythm(R.lead,taps.map(x=>x+t0),'lead')},650+taps[taps.length-1]+500)}
function npcLead(){const R=M.R;if(R.ph==='idle')arm();if(R.ph!=='armed')return;const f=D.friends[M.peer.fid];const norm=f?.rhythm||M.peer.rhythm||[0,.25,.5,1];const dur=1500+Math.random()*900;
  const taps=norm.map(x=>x*dur);R.ph='watch';R.partnerLead=taps;rUI();taps.forEach(x=>setTimeout(()=>{if(M)pulse(false)},300+x));
  R.timer=setTimeout(()=>{if(!M)return;R.ph='follow-wait';R.followBy=Date.now()+5e3;R.until=Math.max(R.until,Date.now()+5e3);rUI();tone(1047,.1)},300+dur+400)}
function followDone(){const R=M.R;const lead=R.partnerLead;finishRhythm(lead,R.follow.map(x=>x-R.follow[0]),'follow')}
function judge(a,b,settings=D.cfg){a=a.map(x=>x-a[0]);b=b.map(x=>x-b[0]);if(a.length!==b.length)return {ok:false,why:`次数不同（${a.length} 下 / ${b.length} 下）`,n:a.length};
  const ta=a[a.length-1]||1,tb=b[b.length-1]||1;const na=a.slice(1).map((t,i)=>(t-a[i])/ta),nb=b.slice(1).map((t,i)=>(t-b[i])/tb);
  const err=Math.max(...na.map((v,i)=>Math.abs(v-nb[i]))),dd=Math.abs(ta-tb)/Math.max(ta,tb);const tol=settings.tol/100,dt=settings.dur/100;
  return {ok:err<=tol&&dd<=dt,err,dd,n:a.length,why:err>tol?`每下间隔差了 ${Math.round(err*100)}%（要 ≤${D.cfg.tol}%）`:dd>dt?`总时长差了 ${Math.round(dd*100)}%（要 ≤${D.cfg.dur}%）`:''}}
const normR=a=>{a=a.map(x=>x-a[0]);const T=a[a.length-1]||1;return a.map(x=>+(x/T).toFixed(3))};
function rhythmGlyph(r){return `<span class="sc-rg">${r.map((x,i)=>i?`<i style="margin-left:${Math.max(2,(x-r[i-1])*40)}px"></i>`:'<i></i>').join('')}</span>`}
function finishRhythm(lead,fol,role){const R=M.R;R.ph='judge';rUI();const j=judge(lead,fol);
  if(M.peer.src==='air'&&role==='follow')send('rhy-res',{to:M.peer.fid,ok:j.ok,why:j.why,rhythm:normR(lead)});
  const f=D.friends[M.peer.fid];let old=false;if(j.ok&&f?.rhythm){const jj=judge(f.rhythm.map(x=>x*1000),normR(lead).map(x=>x*1000));old=jj.ok}
  track('social_confirm_result',{method:'rhythm',ok:j.ok,n:j.n,err:j.err?+j.err.toFixed(2):null,role,old});
  if(!j.ok){fail(j.why,'mismatch');return}
  success('rhythm',{rhythm:normR(lead),oldGreet:old})}
function onMeetMsg(m){const R=M.R;
  if(m.type==='rhy-arm'){R.partnerArmed=true;if(R.ph==='idle')hint('对方已进入「对暗号」，你也长按实体键');rUI();return}
  if(m.type==='rhy-start'){if(R.ph==='lead'&&R.startAt&&(R.startAt<m.at||(R.startAt===m.at&&D.me.id<m.from)))return;R.ph='watch';R.role='follow';R.lead=[];clearTimeout(R.idle);rUI();return}
  if(m.type==='rhy-fol'){if(R.ph==='wait-follow')R.until=Math.max(R.until||0,Date.now()+8e3);return}
  if(m.type==='rhy-lead'){R.partnerLead=m.taps;R.ph='watch';rUI();m.taps.forEach(x=>setTimeout(()=>{if(M)pulse(false)},200+x));R.timer=setTimeout(()=>{if(!M)return;R.ph='follow-wait';R.followBy=Date.now()+5e3;R.until=Math.max(R.until||0,Date.now()+5e3);rUI();tone(1047,.1)},200+m.taps[m.taps.length-1]+400);return}
  if(m.type==='rhy-res'){track('social_confirm_result',{method:'rhythm',ok:m.ok,role:'lead'});if(m.ok)success('rhythm',{rhythm:m.rhythm});else fail(m.why||'没对上','mismatch');return}
  if(m.type==='dots'){M.Dt.partner={seq:m.seq,at:Date.now()};checkDots();return}
  if(m.type==='tilt'){M.F.peer={a:m.a,t:Date.now()};return}
  
}
function fail(why,reason){if(!M)return;const R=M.R;clearTimeout(R.idle);clearTimeout(R.timer);clearInterval(R.cd);M.R={ph:'idle',partnerArmed:R.partnerArmed};$('sc-key')?.classList.remove('armed');
  hint(`<b class="sc-bad">没对上：${esc(why)}</b>　再试一次吧`);tone(330,.15,.07);vib(120);M.fails=(M.fails||0)+1;D.lastFail=Date.now();saveD();rUI();
  if(M.fails>=2)hint(`<b class="sc-bad">没对上：${esc(why)}</b>　连续没对上？可以换「连点暗号」；真实相遇请在两台吧唧上完成`);
  track('social_confirm_fail',{method:M.tab,reason})}
/* ---------- 连点暗号 ---------- */
const DOTS=[...Array(8)].map((_,i)=>{const a=i/8*Math.PI*2-Math.PI/2;return [120+Math.cos(a)*84,120+Math.sin(a)*84]}).concat([[120,120]]);
function dotsSvg(){return `<svg viewBox="0 0 240 240" class="sc-dots" id="sc-dots"><polyline id="sc-dl" points="" /><polyline id="sc-dghost" points="" />${DOTS.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="11" data-dot="${i}"/>`).join('')}</svg>`}
function bindDots(){const sv=$('sc-dots');if(!sv)return;let seq=null;const pt=e=>{const r=sv.getBoundingClientRect();return [(e.clientX-r.left)/r.width*240,(e.clientY-r.top)/r.height*240]};
  const near=(p,rad)=>DOTS.findIndex(([x,y])=>Math.hypot(x-p[0],y-p[1])<rad);
  const draw=(cur)=>{$('sc-dl').setAttribute('points',(seq||[]).map(i=>DOTS[i].join(',')).concat(cur?[cur.join(',')]:[]).join(' '));sv.querySelectorAll('[data-dot]').forEach(c=>c.classList.toggle('on',!!seq?.includes(+c.dataset.dot)))};
  sv.addEventListener('pointerdown',e=>{if(M.done)return;const i=near(pt(e),26);if(i<0)return;e.preventDefault();sv.setPointerCapture?.(e.pointerId);seq=[i];tone(700+i*40,.04,.05);draw()});
  sv.addEventListener('pointermove',e=>{if(!seq)return;const p=pt(e),i=near(p,20);if(i>=0&&!seq.includes(i)){seq.push(i);tone(700+i*40,.04,.05)}draw(p)});
  const up=()=>{if(!seq)return;const s=seq;seq=null;draw();$('sc-dl').setAttribute('points',s.map(i=>DOTS[i].join(',')).join(' '));sv.querySelectorAll('[data-dot]').forEach(c=>c.classList.toggle('on',s.includes(+c.dataset.dot)));dotsDone(s)};
  sv.addEventListener('pointerup',up);sv.addEventListener('pointercancel',up)}
function dotsDone(seq){if(seq.length<4){hint('至少连 4 个点哦');return}
  M.Dt.mine={seq,at:Date.now()};track('social_confirm_start',{method:'dots',src:M.peer.src});const egg=shapeEgg(seq);if(egg)eggFx(egg);
  if(M.peer.src==='air'){send('dots',{to:M.peer.fid,seq});hint('已连好，等对方也连完（15 秒内）…');checkDots();return}
  if(M.Dt.target){checkDots();return}
  hint(`${esc(M.peer.petName)}在照着连…`);setTimeout(()=>{if(!M)return;const ok=Math.random()<(S_NPCOK());M.Dt.partner={seq:ok?seq.slice():seq.slice().reverse(),at:Date.now()};checkDots()},1100)}
function checkDots(){const a=M.Dt.mine,b=M.Dt.target?{seq:M.Dt.target}:M.Dt.partner;if(!a||!b)return;if(Math.abs(a.at-(b.at||a.at))>15e3){M.Dt={};hint('间隔超过 15 秒，重新连一次');return}
  const ok=a.seq.length===b.seq.length&&a.seq.every((v,i)=>v===b.seq[i]);track('social_confirm_result',{method:'dots',ok,n:a.seq.length});
  if(ok)success('dots',{seal:a.seq,egg:shapeEgg(a.seq)});else{M.Dt={};M.Dt.target=b===M.Dt.partner?null:M.Dt.target;fail('图形或顺序不一致','mismatch');setTimeout(()=>{if(M&&M.tab==='dots'){renderMeet()}},900)}}
function npcFirst(){const f=D.friends[M.peer.fid];let seq=f?.seal;if(!seq){const n=4+Math.floor(Math.random()*2);const pool=[0,1,2,3,4,5,6,7,8];seq=[];while(seq.length<n){const i=pool.splice(Math.floor(Math.random()*pool.length),1)[0];seq.push(i)}}
  M.Dt={target:seq};const g=$('sc-dghost');let k=0;const iv=setInterval(()=>{k++;g.setAttribute('points',seq.slice(0,k).map(i=>DOTS[i].join(',')).join(' '));if(k>=seq.length){clearInterval(iv);setTimeout(()=>{g.classList.add('fade');hint('记住了吗？照着连一遍（按同样的顺序）')},900)}},380);g.classList.remove('fade');hint(`${esc(M.peer.petName)}在画…`)}
function shapeEgg(seq){const s=seq.slice(),set=new Set(s);if(s.length>=5&&s.every(i=>i<8)&&s.slice(1).every((v,i)=>[3,5].includes((v-s[i]+8)%8)))return 'star';
  const H=[8,1,2,4,6,7];if(set.size===6&&H.every(i=>set.has(i))){const k=s.indexOf(8);const r=s.slice(k).concat(s.slice(0,k));if(r.join()===H.join()||[8,...H.slice(1).reverse()].join()===r.join())return 'heart'}return null}
function eggFx(kind){const b=document.createElement('div');b.className='sc-eggfx';b.textContent=kind==='heart'?'💗':'⭐';$('sc-screen')?.appendChild(b);setTimeout(()=>b.remove(),1600);tone(1319,.1);tone(1568,.14,.08,.1);track('social_dots_egg',{kind})}
function sealSvg(seq,s=40){return `<svg viewBox="0 0 240 240" width="${s}" height="${s}" class="sc-seal"><circle cx="120" cy="120" r="112"/><polyline points="${seq.map(i=>DOTS[i].join(',')).join(' ')}"/>${seq.map(i=>`<circle class="d" cx="${DOTS[i][0]}" cy="${DOTS[i][1]}" r="9"/>`).join('')}</svg>`}
mov.addEventListener('click',e=>{if(!M)return;const r=e.target.closest('[data-r]')?.dataset.r;if(r==='npclead')npcLead();const d=e.target.closest('[data-d]')?.dataset.d;if(d==='npcfirst')npcFirst()});
/* ---------- 好友度：新连接 > 老朋友重复见面；老朋友单独一条亲密度成长线 ---------- */
const LV=[0,40,90,160,250,360];
function lvl(f){const p=f?.pts||0;let lv=1;LV.forEach((t,i)=>{if(p>=t)lv=i+1});lv=Math.min(lv,LV.length);const a=LV[lv-1],b=LV[lv]||a+150;return {lv,p,a,b,k:Math.min(1,(p-a)/(b-a))}}
function bondLv(f){return 1+Math.floor((f?.bond||0)/50)}
function success(how,extra={}){if(!M||M.done)return;M.done=true;clearInterval(M.R.cd);clearTimeout(M.R.idle);stopFate();stopScan();vib([60,40,60,40,120]);tone(784,.08);tone(988,.08,.08,.1);tone(1319,.16,.08,.2);
  const res=completeMeet(M.peer,how,extra);icebreaker(res)}
/* Runs only inside the existing native event transaction, against staged data. */
function hostPlanDeviceEncounter(data,event,at){
  const fid='device:'+event.peerId,key=event.peerId+':'+event.encounterId;
  data.dex.nativeEncounters??={};
  if(data.dex.nativeEncounters[key])return {duplicate:true,message:'此相遇已有持久结果，未重复奖励。'};
  if(Object.keys(data.dex.nativeEncounters).length>=4096)throw Error('真实相遇记录已满，设备事件保留。');
  if(data.blocked?.[fid])return {rejected:true,reason:'blocked',message:'对方已被本机拉黑，此次相遇不添加好友、不结算成长。'};
  const day=dk(new Date(at));
  const daily=data.daily.k===day?data.daily:{k:day,alerts:0,fate:0,gifts:0,eggs:0,envy:0,meets:0,coins:0,world:0};
  const peer={fid,src:'native_device',owner:'匿名主人',petName:event.peerName,breed:event.peerBreed,sex:null,stage:null,outfit:'none',skills:[],cards:[]};
  let rhythm=null;
  if(event.method==='rhythm'){let t=0;const taps=[0];for(const gap of event.mark){t+=gap;taps.push(t);}rhythm=taps.map(x=>x/t);}
  const extra={rhythm,seal:event.method==='dots'?event.mark.slice():null};
  const old=data.friends[fid];
  extra.oldGreet=!!(rhythm&&old?.rhythm&&judge(old.rhythm.map(x=>x*1000),rhythm.map(x=>x*1000),{tol:15,dur:30}).ok);
  const result=friendProgress(data,peer,event.method,extra,at,daily);
  result.f.nativePeerId=event.peerId;result.f.lastEncounterId=event.encounterId;
  data.seen[event.peerBreed]=data.seen[event.peerBreed]||at;
  const growth=worldGrow(result.f,event.method,result.isNew,{data,daily,day,at,event});
  data.dex.deviceGiftPairs??={};
  const gift=!data.dex.deviceGiftPairs[event.peerId]&&!data.dex.deviceReceipts?.some(x=>x.kind==='gift'&&x.peerId===event.peerId&&x.status==='applied');
  if(gift)data.dex.deviceGiftPairs[event.peerId]=event.encounterId;
  const message=(event.method==='rhythm'?'敲暗号':'连点暗号')+' · '+(result.isNew?'成为朋友':'老朋友见面')+'「'+event.peerName+'」'+(growth.frag?'；相遇世界：'+growth.frag.t:'；'+(growth.skip==='same'?'今天已和它种过种子':growth.skip==='cap'?'今天世界成长已达上限':'相遇已记下'));
  data.dex.nativeEncounters[key]={eventId:event.eventId,peerId:event.peerId,fid,method:event.method,mark:event.mark.slice(),occurredAtMs:event.occurredAtMs,recordedAtMs:at,source:'native_device',peerComplete:true,message};
  return {...result,gift,message,growth};
}
function nativeEncounterHelp(){
 const records=Object.values(D.dex.nativeEncounters||{}).sort((a,b)=>b.recordedAtMs-a.recordedAtMs);
 return `<section class="lf-sec"><h4>真实吧唧相遇</h4><p class="lf-note">双方在各自吧唧长按下键 1 秒，靠近后选择同一种暗号。普通附近广播不会添加好友。</p><p>敲暗号：一人先敲 4–8 下，停 1.2 秒后另一人在 5 秒内跟敲。连点暗号：钟面 8 点加中心 1 点，两边连至少 4 点，顺序相同。匹配后双方分别确认，保存后回传手机。</p><p class="sc-small">电源键短按回主屏；长按仍为硬件关机。没有第二台吧唧时无法完成真实相遇。当面晃一晃尚无完整双机链路，未开放；扫码相遇已取消。</p><div class="lf-row"><button type="button" class="g-btn" data-native-device>连接我的吧唧</button><button type="button" class="g-btn ghost" data-htab="friends">看好友</button></div><h4>真实相遇记录 <small>${records.length} 次</small></h4><ol class="lf-list">${records.slice(0,30).map(x=>`<li><span>🤝</span><p>${esc(x.message)}<small>${x.occurredAtMs?new Date(x.occurredAtMs).toLocaleString():'设备当时没有可靠时钟；时间未推断'} · ${esc(x.method==='rhythm'?'敲暗号':'连点暗号')}</small></p></li>`).join('')||'<li class="lf-empty">尚无双方持久确认的真实吧唧相遇。吧唧离线保存后，连接手机会自动补传。查看相遇页期间会等待互动结束；回到小屋后即可继续同步。</li>'}</ol></section>`;
}

function friendProgress(D,peer,how,extra,now,d){
  let f=D.friends[peer.fid];const isNew=!f;
  if(isNew){f=D.friends[peer.fid]={fid:peer.fid,owner:peer.owner||'匿名主人',src:peer.src,petName:peer.petName,breed:peer.breed,sex:peer.sex,outfit:peer.outfit,stage:peer.stage,region:peer.region,regionInfo:peer.regionInfo||null,skills:peer.skills||[],persona:peer.persona||null,cards:peer.cards||[],pts:0,bond:0,meets:[],firstAt:now,lastAt:now,contact:{mine:false,theirs:false,info:''},gifts:0,gave:0,co:{}}}
  else Object.assign(f,{petName:peer.petName,breed:peer.breed,sex:peer.sex,outfit:peer.outfit,stage:peer.stage,skills:peer.skills||f.skills,persona:peer.persona||f.persona,cards:peer.cards||f.cards});
  const sameDay=f.meets.filter(t=>dk(new Date(t))===dk(new Date(now))).length;
  const gain=isNew?30:Math.max(1,Math.round(10*Math.pow(.5,sameDay)));const lines=[];f.pts+=gain;
  lines.push(isNew?['🤝',`和「${f.petName}」成为朋友 · 好友度 +${gain}`]:['💞',`老朋友见面 · 好友度 +${gain}${sameDay?'（今天已见过，收益递减）':''}`]);
  if(!isNew){const b=(sameDay?2:6)+(extra.oldGreet?4:0);f.bond+=b;lines.push(['🧶',`老朋友亲密度 +${b}${extra.oldGreet?'（敲出了友谊暗号）':''} · 亲密 Lv${bondLv(f)}`]);
    const wk=weekKey(now);f.co[wk]=(f.co[wk]||0)+(sameDay?0:1);if(f.co[wk]===2){f.bond+=15;lines.push(['📅','本周共同任务完成：和老朋友见面 2 天 · 亲密度 +15'])}Object.keys(f.co).forEach(k=>{if(k!==wk)delete f.co[k]})}
  f.meets.push(now);f.meets=f.meets.slice(-40);f.lastAt=now;d.meets++;
  if(how==='rhythm'&&extra.rhythm&&(!f.rhythm||isNew)){f.rhythm=extra.rhythm;D.dex.rhythms.push({fid:f.fid,r:extra.rhythm,at:now});lines.push(['🥁','这段节奏存为你们的友谊暗号'])}
  if(how==='dots'&&extra.seal&&!f.seal){f.seal=extra.seal;D.dex.seals.push({fid:f.fid,seq:extra.seal,at:now,egg:extra.egg||null});lines.push(['💮',`连出的图形收进图鉴：友谊印章${extra.egg?(extra.egg==='heart'?' · 爱心彩蛋':' · 星星彩蛋'):''}`])}
  return {f,isNew,lines,gain};
}
function completeMeet(peer,how,extra={}){
  if(peer.src!=='npc')throw Error('真实吧唧相遇须由持久设备收据结算');
  const now=Date.now(),d=today();const {f,isNew,lines,gain}=friendProgress(D,peer,how,extra,now,d);
  if(how==='fate'){D.dex.fate.push({fid:f.fid,name:f.petName,at:now});lines.push(['✨','缘分擦肩：收进缘分图鉴，获得限定印记「同频」'])}
  D.seen[peer.breed]=D.seen[peer.breed]||now;
  first('friend','第一次交到朋友');if(how==='fate')first('fate','第一次缘分擦肩');if(how==='dots')first('seal','第一枚友谊印章');
  drift({ext:isNew?2:1,curious:isNew?1:0},'meet');
  /* 宠物自己决定送什么（盲盒） + 带上提前准备的礼物 */
  const gift=giveGift(f,isNew,how);if(gift)lines.push([gift.big?'🎀':'🎁',`${petName()}送给它：${gift.label}${gift.prepared?'（你提前准备的）':''}`]);
  /* 图鉴交换：各出一张非锁定卡；好友可定向 */
  const card=pickCardToGive(f);if(card)lines.push(['🃏',`${petName()}拿出了图鉴卡「${cardName(card)}」交换`]);
  /* 技能互学：好友 Lv2 起，相处时概率学会对方的技能 */
  const sk=learnSkill(f);if(sk)lines.push(['📚',`${petName()}从「${f.petName}」那里学会了${SKILLS[sk].i}${SKILLS[sk].n}`]);
  /* 跨社团 / 地域连接：拿到对方据点特产 */
  const rg=f.region;if(rg&&rg!==myRegion().id){const info=REGIONS[rg]||f.regionInfo;if(info){const had=D.dex.regions[rg];D.dex.regions[rg]={n:info.n,sp:info.sp,i:info.i,c:(had?.c||0)+1,at:had?.at||now,from:f.petName};if(!had)lines.push([info.i||'📍',`跨据点连接：获得「${info.n}」特产「${info.sp}」`])}}
  /* 相遇世界：这次相遇种下一颗种子 */
  const wg=worldGrow(f,how,isNew);if(wg.frag)lines.push(['🌱',`相遇世界 · ${W_TIER[wg.tier]}：${wg.frag.t}`]);else if(wg.skip==='cap')lines.push(['🌱',`今天的相遇世界已经长满 ${wCap()} 次，明天再来`]);else if(wg.skip==='same')lines.push(['🌱','今天已经和它种过种子了，世界不再重复生长']);
  /* NPC 当场带来它的礼物 */
  if(peer.src==='npc'&&gift&&npcReturn(f,gift))lines.push(['💥','回礼暴击！它看到你准备的礼物，回了一份大礼']);
  if(peer.src==='npc'){const g=npcGift(f,isNew,how==='fate');if(g)lines.push([g.big?'🎀':'📦',g.big?`缘分擦肩！「${f.petName}」带来了一份大礼物（馈赠限定），去礼物页拆开吧`:`「${f.petName}」带来了一份小礼物，去礼物页拆开吧`]);const c=npcCard(f);if(c)receiveCard(c,f.petName)}
  if(peer.src==='air')send('meet-gift',{to:peer.fid,gift,card,peer:meCard()});
  const giver=D.gifts.given;if(gift){const tl=title();lines.push(['🏅',`慷慨值 +${gift.prepared?5:2} · 称号「${tl}」`])}
  saveD();
  try{ST().socialGrant({coins:gift?Math.min(4,30-(d.coins||0))>0?2:0:0,mood:isNew?6:3,journal:{kind:'social',msg:isNew?`${petName()}在外面认识了新朋友「${f.petName}」，还交换了礼物。`:`${petName()}和老朋友「${f.petName}」又见面啦。`},message:'遇见成功'});if(gift)d.coins=(d.coins||0)+2}catch(e){}
  L.moment({type:'social',icon:isNew?'🤝':'💞',label:isNew?`和「${f.petName}」成为朋友`:`和老朋友「${f.petName}」见面`,heart:isNew?6:4});
  slog(isNew?'🤝':'💞',`${how==='rhythm'?'敲暗号':how==='dots'?'连点暗号':how==='fate'?'缘分擦肩':'扫码'}确认 · ${isNew?'新朋友':'老朋友'}「${f.petName}」`);
  track('social_meet',{how,isNew,src:peer.src,gain,lv:lvl(f).lv,old:!!extra.oldGreet});
  return {f,isNew,lines,how,peer};
}
function first(k,label){if(!D.dex.firsts[k]){D.dex.firsts[k]={at:Date.now(),label};return true}return false}
function title(){const g=D.gifts.gen;return g>=120?'礼物之星':g>=60?'慷慨的猫':g>=20?'热心小信使':'新手小信使'}
/* ---------- 礼物：宠物决定 · 盲盒 · 递减 · 冷却 · 上限 · 重复转喵币 ---------- */
function giveGift(f,isNew,how){const big=how==='fate';const prep=D.gifts.prepared.findIndex(p=>!p.to||p.to===f.fid);let g;
  if(prep>=0){const p=D.gifts.prepared.splice(prep,1)[0];g={...p.gift,prepared:true};D.gifts.gen+=5}
  else if(big){/* Fate 缘分擦肩：大礼物 = 一件馈赠限定（服饰或家具）+ 喵币 */const furn=Math.random()<.5;g=furn?{kind:'furn',id:pick(Object.keys(FURN))}:{kind:'outfit',id:pick(GIFT_OUT)};g.big=true;g.bonus=10;g.label=labelOf(g);D.gifts.gen+=6}
  else{const ps=persona();const r=Math.random();const it=ps.greedy>=60?'fish':ps.curious>=60?pick(['shell','star']):ps.show>=60?'flower':pick(Object.keys(ITEMS));g={kind:'item',id:it,n:1+(r<.3?1:0),blind:true};g.label=labelOf(g);D.gifts.gen+=2}
  D.gifts.given++;f.gave=(f.gave||0)+1;D.gifts.log.unshift({t:Date.now(),dir:'out',who:f.petName,label:g.label});D.gifts.log=D.gifts.log.slice(0,40);first('gift','第一次送出礼物');
  drift({show:1,clingy:0},'give');track('gift_give',{kind:g.kind,tier:g.big?'big':'small',prepared:!!g.prepared,src:f.src});return g}
function rollBox(f,isNew,big){/* 擦身遇见 = 小礼物（道具 / 喵币）；Fate 缘分擦肩 = 大礼物（馈赠限定服饰或家具 + 喵币） */
  const p=P(),hvOk=!D.hv[f.fid]||Date.now()-D.hv[f.fid]>72*H,recent=(f.recv||[]).filter(t=>Date.now()-t<7*DAY).length,decay=Math.pow(.6,recent);
  const notOwnedOut=GIFT_OUT.filter(o=>!p.wardrobe.includes(o)),notFurn=Object.keys(FURN).filter(k=>!D.furn.owned[k]);
  let g;
  if(big){if(hvOk&&(notOwnedOut.length||notFurn.length)){const useOut=notOwnedOut.length&&(!notFurn.length||Math.random()<.5);g=useOut?{kind:'outfit',id:pick(notOwnedOut)}:{kind:'furn',id:pick(notFurn)};D.hv[f.fid]=Date.now()}
    else{const it=pick(Object.keys(ITEMS));g={kind:'item',id:it,n:3}}g.big=true;g.bonus=hvOk?10:20}
  else{const r=Math.random()*decay;if(r>.3){const it=pick(Object.keys(ITEMS));g={kind:'item',id:it,n:isNew?2:1+(r>.7?1:0)}}else g={kind:'coins',n:Math.max(2,Math.round((isNew?8:6)*decay))}}
  f.recv=[...(f.recv||[]),Date.now()].slice(-20);return g}
function labelOf(g){const b=g.kind==='outfit'?`👘 ${ON(g.id)}（馈赠限定）`:g.kind==='furn'?`${FURN[g.id].i} ${FURN[g.id].n}（馈赠限定家具）`:g.kind==='item'?`${ITEMS[g.id].i}${ITEMS[g.id].n} ×${g.n}`:`🪙 ${g.n} 喵币`;return g.big?`🎀 大礼物：${b}${g.bonus?` + 🪙${g.bonus}`:''}`:`🎁 小礼物：${b}`}
function npcGift(f,isNew,big){const d=today();if(d.gifts>=5&&!big)return null;d.gifts++;const g=rollBox(f,isNew,big);g.label=labelOf(g);D.gifts.inbox.push({id:uid(),from:f.fid,fname:f.petName,breed:f.breed,g,at:Date.now(),open:false});saveD();return g}
function receiveGift(fromId,gift,card,peerCard){let f=D.friends[fromId];const d=today();
  if(!f&&peerCard){/* 对方先完成了，这里也补上好友（双向确认） */}
  if(card)receiveCard(card,f?.petName||peerCard?.petName||'朋友');
  if(!gift)return;if(d.gifts>=5&&!gift.big){slog('🎁',`今天收到的礼物已达上限，「${f?.petName||'朋友'}」的礼物改成一句问候`);return}d.gifts++;
  let g=gift;if(g.kind==='item'&&f){/* 同一个人反复送礼收益递减 */const recent=(f.recv||[]).filter(t=>Date.now()-t<7*DAY).length;if(recent>=3)g={...g,n:1}}
  if(f)f.recv=[...(f.recv||[]),Date.now()].slice(-20);
  /* 对方是提前准备礼物的给予者，可能触发回礼暴击（对方侧结算） */
  D.gifts.inbox.push({id:uid(),from:fromId,fname:f?.petName||peerCard?.petName||'朋友',breed:f?.breed||peerCard?.breed,g:{...g,label:g.label||labelOf(g)},at:Date.now(),open:false});saveD();
  toast(`「${f?.petName||peerCard?.petName||'朋友'}」把${g.big?'一份大礼物':'小礼物'}带过来了`);renderHub()}
function openGift(id){const it=D.gifts.inbox.find(x=>x.id===id);if(!it||it.open)return null;it.open=true;const g=it.g,p=P();let msg='';
  if(g.kind==='outfit'){if(p.wardrobe.includes(g.id)){ST().socialGrant({coins:8,message:'重复'});msg=`${ON(g.id)} 已经有了，换成 8 喵币`}else{ST().socialGrant({outfits:[g.id],journal:{kind:'gift',msg:`收到「${it.fname}」送的${ON(g.id)}（馈赠限定）。`}});msg=`获得馈赠限定「${ON(g.id)}」，去衣柜给${petName()}穿上吧`;first('outfit','第一件馈赠限定服装')}}
  else if(g.kind==='furn'){if(D.furn.owned[g.id]){ST().socialGrant({coins:8});msg=`${FURN[g.id].n} 已经有了，换成 8 喵币`}else{D.furn.owned[g.id]=Date.now();D.furn.placed[g.id]=true;placeFurniture();msg=`获得馈赠限定家具「${FURN[g.id].n}」，已经摆进小家`}}
  else if(g.kind==='item'){ST().socialGrant({items:{[g.id]:g.n}});msg=`获得 ${ITEMS[g.id].n} ×${g.n}，放进背包了`}
  else if(g.kind==='coins'){ST().socialGrant({coins:g.n});msg=`获得 ${g.n} 喵币`}
  if(g.bonus){ST().socialGrant({coins:g.bonus});msg+=`；另有 ${g.bonus} 喵币`}
  if(g.crit){ST().socialGrant({coins:10});msg+='；回礼暴击 +10 喵币！'}
  D.gifts.log.unshift({t:Date.now(),dir:'in',who:it.fname,label:g.label});saveD();drift({greedy:g.kind==='item'?1:0,show:g.kind==='outfit'?1:0});
  L.moment({type:'gift',icon:'🎁',label:`拆开「${it.fname}」带来的礼物`,heart:3});track('gift_open',{kind:g.kind,id:g.id||null,tier:g.big?'big':'small'});return msg}
function prepareGift(item,n,to){if(D.friends[to]?.src==='native_device'){toast('真实吧唧目前仅支持首次互赠野花，自定义礼物尚未开放');return;}const p=P();if((p.inventory[item]||0)<n){toast(`背包里的${ITEMS[item].n}不够`);return}
  const r=ST().socialGrant({items:{[item]:-n},message:'准备礼物'});if(!r.ok){toast(r.message);return}
  const crit=Math.random()<Math.min(.5,.2+D.gifts.gen/300);
  D.gifts.prepared.push({to:to||null,gift:{kind:'item',id:item,n:n+(crit?1:0),label:`${ITEMS[item].i}${ITEMS[item].n} ×${n}`,crit,prepared:true},at:Date.now()});saveD();
  toast(`礼物已经交给${petName()}，下次见到${to?'「'+(D.friends[to]?.petName||'它')+'」':'朋友'}时由它带过去`);track('gift_prepare',{item,n,to:!!to});renderHub()}
/* 给予者回礼暴击：NPC 收到准备好的礼物时以一定概率回礼 */
function npcReturn(f,g){if(f.src==='npc'&&g?.prepared&&Math.random()<Math.min(.6,.3+D.gifts.gen/300)){D.gifts.crit++;D.gifts.inbox.push({id:uid(),from:f.fid,fname:f.petName,breed:f.breed,g:{kind:'coins',n:12,label:'🪙 12 喵币（回礼暴击！）',crit:false},at:Date.now(),open:false});return true}return false}
/* ---------- 图鉴卡 ---------- */
function giveableCards(){const p=P();if(!p)return [];const own=[...new Set((p.cats||[]).map(c=>c.breed))].map(b=>'breed:'+b);const q=Object.keys(L.quirk?.book||{}).map(k=>'quirk:'+k);
  const rec=Object.keys(D.dex.cards);const r=myRegion();return [...new Set([...own,...q,'region:'+r.id,...rec])].filter(c=>!D.dex.locked[c])}
function cardName(c){const [t,id]=c.split(':');if(t==='breed')return BN(id)+'卡';if(t==='quirk')return (L.quirk?.list.find(q=>q.id===id)?.name||'怪行为')+'卡';if(t==='region'){const r=REGIONS[id]||D.dex.regions[id]||(id===myRegion().id?myRegion():null);return (r?.n||'据点')+'卡'}return c}
function cardIcon(c){const [t,id]=c.split(':');if(t==='breed')return '🐱';if(t==='quirk')return L.quirk?.list.find(q=>q.id===id)?.icon||'✨';return '📍'}
function pickCardToGive(f){const pool=giveableCards();if(!pool.length)return null;const want=f.wantFromMe&&pool.includes(f.wantFromMe)?f.wantFromMe:null;const c=want||pick(pool);if(want)delete f.wantFromMe;track('dex_card_give',{targeted:!!want});return c}
function npcCard(f){const n=NPCS.find(x=>x.fid===f.fid);if(!n)return null;const pool=['breed:'+n.breed,'region:'+n.region,...Object.keys(REGIONS).map(r=>'region:'+r)];if(f.want&&pool.includes(f.want)){const w=f.want;f.want=null;return w}return pick(pool)}
function receiveCard(c,from){const had=D.dex.cards[c];D.dex.cards[c]={n:(had?.n||0)+1,at:had?.at||Date.now(),from};const [t,id]=c.split(':');if(t==='breed')D.seen[id]=D.seen[id]||Date.now();if(t==='region'&&REGIONS[id]&&!D.dex.regions[id])D.dex.regions[id]={...REGIONS[id],c:1,at:Date.now(),from};saveD();track('dex_card_get',{type:t,dup:!!had})}
/* ---------- 技能互学 ---------- */
function learnSkill(f){if(lvl(f).lv<2)return null;const mine=ownSkills(),cand=(f.skills||[]).filter(s=>!mine.includes(s)&&SKILLS[s]);if(!cand.length||Math.random()>.45)return null;const s=pick(cand);const id=P().id;D.skills[id]=[...(D.skills[id]||[]),s];track('skill_learn',{skill:s});return s}
/* ---------- 联系方式：双方同意才解锁；未成年禁用 ---------- */
function askContact(fid){const f=D.friends[fid];if(!f)return;if(f.src==='native_device'){toast('吧唧联系方式交换尚未开放');return;}if(L.cfg.minor){toast('未满 14 周岁不能交换联系方式');return}
  if(f.src==='npc'){f.contact={mine:true,theirs:true,info:`官方小猫不交换个人联系方式 · ${REGIONS[f.region]?.n||'据点'}：每周六 14:00 有线下遛猫会`};saveD();toast('官方小猫回了据点活动信息');track('contact_unlock',{src:'npc'});renderHub();return}
  const info=(D.cfg.contact||'').trim();if(!info){toast('先在「设置」里填写你愿意交换的联系方式');hubTab='settings';renderHub();return}
  f.contact={...f.contact,mine:true};saveD();send('contact-req',{to:fid,info});toast('已发出请求，对方同意后双方才会看到');renderHub()}
function contactReq(from,info){const f=D.friends[from];if(!f)return;if(L.cfg.minor){send('contact-no',{to:from});return}
  showBanner(`<span class="sc-bpet">${petImg(f.breed,f.outfit,3)}</span><div><b>「${esc(f.petName)}」的主人想交换联系方式</b><small>同意后双方互相可见，可随时在好友页隐藏</small></div><button type="button" class="g-btn" data-cok="${esc(from)}">同意</button><button type="button" class="g-btn ghost" data-cno="${esc(from)}">暂不</button>`,from,20000);
  banner._ci={from,info}}
banner.addEventListener('click',e=>{const ok=e.target.closest('[data-cok]'),no=e.target.closest('[data-cno]');if(!ok&&!no)return;const {from,info}=banner._ci||{};banner.hidden=true;const f=D.friends[from];if(!f)return;
  if(ok){const mine=(D.cfg.contact||'').trim()||'（对方未填写）';f.contact={mine:true,theirs:true,info:String(info||'').slice(0,40)};saveD();send('contact-ok',{to:from,info:mine});toast('已交换联系方式');track('contact_unlock',{src:'air'});renderHub()}else send('contact-no',{to:from})});
/* ---------- 联机生蛋：好友 Lv2 + 7 天内见过 + 双方成年异性；稀有外观只出现在联机生蛋后代 ---------- */
function eggCheck(f){if(f.src==='native_device')return '吧唧联机生蛋尚未开放';const p=P();if(!p)return '数据加载中';if(lvl(f).lv<2)return '好友度达到 Lv2 才能一起生蛋';if(Date.now()-f.lastAt>7*DAY)return '7 天内见过面才能约蛋';
  if(p.stage!=='adult')return `${p.name}还没成年`;if(f.stage!=='adult')return `「${f.petName}」还没成年`;if(f.sex===p.sex)return '需要一只异性的好友猫咪';if(p.family?.pair)return '家里已经有一颗蛋 / 一对在准备中';if((p.cats||[]).length>=6)return '家里已经住满 6 只猫';if(today().eggs>=1)return '今天已经约过蛋了';return ''}
function rareRoll(a,b,f){const s=[a,b].sort().join('+');const T={'orange+tuxedo':'calico','calico+orange':'calico','orange+silver':'golden','blue+orange':'golden','orange+siamese':'golden','blue+ragdoll':'starry','siamese+tuxedo':'starry','ragdoll+siamese':'starry'};
  const target=T[s]||(['calico','golden','starry'][hash(s)%3]);const chance=Math.min(.6,.25+(a!==b?.1:0)+bondLv(f)*.05+(f.bond>=50?.05:0));return Math.random()<chance?target:null}
function askEgg(fid){const f=D.friends[fid];const why=eggCheck(f);if(why){toast(why);return}const rare=rareRoll(P().breed,f.breed,f);
  if(f.src==='air'){send('egg-req',{to:fid,card:meCard(),rare});toast('已发出约蛋请求，等对方同意');return}startEgg(f,rare)}
function eggReq(from,card,rare){const f=D.friends[from];if(!f)return;if(card)Object.assign(f,{breed:card.breed,sex:card.sex,stage:card.stage,petName:card.petName});const why=eggCheck(f);if(why){send('egg-no',{to:from});toast(`收到约蛋请求，但${why}`);return}
  showBanner(`<span class="sc-bpet">${petImg(f.breed,f.outfit,3)}</span><div><b>「${esc(f.petName)}」想和${esc(petName())}一起孵一颗蛋</b><small>两边家里各孵一只幼猫，后代继承双方特征</small></div><button type="button" class="g-btn" data-eok="${esc(from)}">好呀</button><button type="button" class="g-btn ghost" data-eno="${esc(from)}">暂不</button>`,from,20000);banner._ei={from,rare}}
banner.addEventListener('click',e=>{const ok=e.target.closest('[data-eok]'),no=e.target.closest('[data-eno]');if(!ok&&!no)return;const {from,rare}=banner._ei||{};banner.hidden=true;const f=D.friends[from];if(!f)return;if(ok){if(startEgg(f,rare))send('egg-ok',{to:from,rare})}else send('egg-no',{to:from})});
function startEgg(f,rare,remoteOk){const r=ST().beginRemoteFamily({name:f.petName,breed:f.breed,sex:f.sex,owner:f.owner,fid:f.fid,rare});if(!r.ok){toast(r.message);return false}
  today().eggs++;f.egg={at:Date.now(),rare};saveD();first('egg','第一颗联机蛋');slog('🥚',`和「${f.petName}」约了一颗蛋${rare?'（好像有点特别）':''}`);toast(`🥚 ${r.message}`);
  L.moment({type:'egg',icon:'🥚',label:`和「${f.petName}」约了一颗联机蛋`,heart:5});track('egg_start',{rare:!!rare,src:f.src});renderHub();return true}
function claimEgg(){const p=P();const nm=prompt('给新生幼猫取个名字（2～12 字）','小团子');if(!nm)return;const r=ST().claimBaby(nm.trim());toast(r.message)}
/* 孵化庆祝：检测带 lineage 的新猫 */
let catIds=null;
function watchHatch(){if(window.CatOfflineDurable?.transactionPaused)return;const p=P();if(!p)return;const ids=(p.cats||[]).map(c=>c.id);if(catIds){(p.cats||[]).forEach(c=>{if(!catIds.includes(c.id)&&c.lineage&&!D.hatched.includes(c.id))celebrate(c)})}catIds=ids}
function celebrate(c){D.hatched.push(c.id);const ln=c.lineage;const fp=D.friends[ln.fid]?.persona||{ext:50,clingy:50,show:50,curious:50,greedy:50};const pp=D.persona[ln.parentId]||persona();
  D.persona[c.id]=Object.fromEntries(DIMS.map(([k])=>[k,Math.max(0,Math.min(100,Math.round((pp[k]+fp[k])/2+(Math.random()-.5)*16)))]));saveD();first('hatch','第一只联机后代');
  const ov=document.createElement('div');ov.className='sc-ov on sc-hatch';ov.innerHTML=`<div class="sc-mbox"><div class="sc-hcel"><div class="sc-egg">🥚</div><div class="sc-hpet">${petImg(c.breed,'none',7)}</div></div><h3>${esc(c.name)}孵化啦！</h3><p>${esc(ln.parentName)} × 好友的「${esc(ln.partnerName)}」${ln.rare?`<br><b class="sc-rare">稀有外观：${esc(BN(c.breed))}</b>（只会出现在联机生蛋的后代里）`:''}</p><p class="sc-small">性格继承了双方：${ptag(D.persona[c.id])}</p><button type="button" class="g-btn" data-hx>欢迎回家</button></div>`;
  document.body.appendChild(ov);ov.addEventListener('click',e=>{if(e.target.closest('[data-hx]')||e.target===ov)ov.remove()});for(let i=0;i<24;i++){const s=document.createElement('i');s.className='sc-conf';s.style.left=Math.random()*100+'%';s.style.animationDelay=Math.random()*.8+'s';s.style.background=pick(['#f2a0a0','#f0bf73','#86c27e','#9bb8cc','#c9a5e8']);ov.appendChild(s)}
  tone(784,.1);tone(988,.1,.08,.12);tone(1175,.1,.08,.24);tone(1568,.2,.08,.36);vib([100,50,100]);track('egg_hatch',{rare:!!ln.rare,breed:c.breed});slog('🐣',`${c.name}孵化啦${ln.rare?'（稀有：'+BN(c.breed)+'）':''}`)}
/* No QR, phone tilt, pointer tilt or generated Fate samples. */
function stopScan(){}function stopFate(){}
function myCode(){return ''}function parseCode(){return {err:'扫码相遇已取消'}}
function useCode(){toast('扫码相遇已取消，请使用吧唧暗号');return false}
function renderQr(){useCode()}function renderFate(){toast('缘分擦肩未开放采集')}
/* ---------- 破冰小剧场：两只小猫打招呼 → 玩耍 → 交换礼物；主人旁观 ---------- */
function icebreaker(res){const scr=$('sc-screen'),act=$('sc-mact');scr.className='sc-screen ice';scr.innerHTML='<canvas id="sc-ice" width="240" height="240"></canvas>';
  const me=P(),pe=res.peer;hint(`主人旁观中 · ${res.isNew?'两只小猫第一次见面':'老朋友见面啦'}`);act.innerHTML=`<button type="button" class="g-btn ghost" data-skip>跳过动画</button>`;
  const g=$('sc-ice').getContext('2d');g.imageSmoothingEnabled=false;const T0=performance.now(),Dur=5200;let done=false;
  const end=()=>{if(done)return;done=true;cancelAnimationFrame(M?.anim||0);showResult(res)};act.querySelector('[data-skip]').onclick=end;
  const f=t=>{if(!M)return;const k=(t-T0)/1000;g.fillStyle='#231d36';g.fillRect(0,0,240,240);g.fillStyle='#3a3152';g.fillRect(0,160,240,80);
    const ap=Math.min(1,k/1.4),x1=20+ap*55,x2=184-ap*55,bob=Math.round(Math.sin(k*8)*1.5);
    drawPet(g,x1,120+(k<1.4?bob:0),3,me.breed,{outfit:me.outfit,blink:k%3>2.8});drawPet(g,x2,120+(k<1.4?-bob:0),3,pe.breed,{outfit:pe.outfit,flip:true,blink:k%3.4>3.2});
    g.font='12px system-ui';g.textAlign='center';
    if(k>1.4&&k<2.6){g.fillStyle='#ff9a9a';for(let i=0;i<3;i++){const ph=((k-1.4)*1.2+i/3)%1;g.globalAlpha=1-ph;g.fillText('♥',120+Math.sin(i*2)*10,118-ph*40)}g.globalAlpha=1;g.fillStyle='#fff4e0';g.fillText('喵～你好呀',120,70)}
    if(k>2.6&&k<4){const ph=(k-2.6)/1.4,bx=x1+38+Math.abs(Math.sin(ph*Math.PI*2))*(x2-x1-38),by=150-Math.abs(Math.sin(ph*Math.PI*4))*30;g.fillStyle='#f0bf73';g.beginPath();g.arc(bx,by,6,0,7);g.fill();g.fillStyle='#fff4e0';g.fillText('一起玩毛线球！',120,70)}
    if(k>4){g.fillStyle='#e8907a';const bx=120-6,by=128-Math.sin(Math.min(1,(k-4))*Math.PI)*20;g.fillRect(bx,by,14,12);g.fillStyle='#f0bf73';g.fillRect(bx+5,by,4,12);g.fillStyle='#fff4e0';g.fillText('互相交换礼物',120,70)}
    g.fillStyle='#8e83a6';g.font='10px system-ui';g.fillText('👀 主人旁观中',120,226);
    if(t-T0>Dur){end();return}M.anim=requestAnimationFrame(f)};M.anim=requestAnimationFrame(f)}
function showResult(res){if(!M)return;const f=res.f,lv=lvl(f);$('sc-screen').className='sc-screen done';$('sc-screen').innerHTML=`<div class="sc-done">${petImg(f.breed,f.outfit,5)}<b>${res.isNew?'成为朋友啦':'老朋友打招呼'}</b><small>好友 Lv${lv.lv}</small></div>`;
  $('sc-mtabs').innerHTML='';$('sc-key').hidden=true;
  hint('');const ret=false;
  $('sc-mact').innerHTML=`<ul class="sc-res">${res.lines.map(([i,t])=>`<li><span>${i}</span>${esc(t)}</li>`).join('')}${ret?'<li><span>💥</span>回礼暴击！对方回了一份大礼</li>':''}</ul>
  ${M.reply?`<div class="sc-reply"><b>回执码</b>：让对方扫这个码完成双向确认<div id="sc-rqr"></div><button type="button" class="g-btn ghost" data-q="copyreply">复制回执码</button></div>`:''}
  <div class="lf-row"><button type="button" class="g-btn" data-goto="gifts">去拆礼物</button><button type="button" class="g-btn ghost" data-goto="friends">看好友</button><button type="button" class="g-btn ghost" data-mclose>完成</button></div>`;
  if(M.reply)try{$('sc-rqr').appendChild(window.__pgQR.canvas(M.reply,3,3))}catch(e){}
  renderHub()}
mov.addEventListener('click',e=>{const g=e.target.closest('[data-goto]');if(g){closeMeet();openHub(g.dataset.goto)}});
/* ---------- 相遇世界：每一次确认的相遇 = 一颗种子；没有相遇，房间不会变化 ---------- */
const WPAL={orange:'#dd8b48',silver:'#a9adb3',tuxedo:'#3a3a42',siamese:'#e8d5b5',ragdoll:'#f1e7dc',blue:'#798fa0',calico:'#e9a35a',golden:'#e5b860',starry:'#2f3a6b'};
/* 每天能长几次：随机数（3–5 次），按主人匿名 ID + 日期生成，当天固定 */
const WCAP_MIN=3,WCAP_MAX=5;const wCap=(day=dk(new Date()),target=D)=>WCAP_MIN+hash(target.me.id+'|wcap|'+day)%(WCAP_MAX-WCAP_MIN+1);
const mb32=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const WS_WALL={frame:'相框',poster:'海报',stars:'星星贴纸',clock:'挂钟'},WS_FLOOR={flower:'盆花',cushion:'靠垫',books:'书堆',mush:'蘑菇灯',fish:'小鱼缸'};
const W_SLOTS={wall:['b1','b2','b3','r1','r2','r3','r4'],floor:['f1','f2','f3','f4']};
const W_PAPER=[['#f3d9c6','蜜桃'],['#d9e6c3','抹茶'],['#cfdcf0','晴空'],['#efd3e0','樱花'],['#f2e6b8','奶油'],['#d6cdea','薰衣草']];
const W_FLOORS=[['橡木',['#cfa073','#d3a779','#d8aa7d','#dcaf82']],['胡桃木',['#a8754f','#ad7b55','#b2805a','#b8865f']],['白桦',['#e6cfa8','#e9d3ad','#ecd7b2','#efdbb7']],['薄荷格',['#cfe3d4','#f2ebdc','#cfe3d4','#f2ebdc']],['樱桃木',['#c98a6b','#cd9071','#d19676','#d59b7b']]];
const W_MID={paper:'墙纸',floor:'地板',garland:'彩灯串',shelf:'置物架',sidewin:'侧墙新窗',expand:'房间扩一格'};
const W_AREAS={balcony:{n:'阳台',i:'🪴',view:'city',vn:'城市',c:'#c9b8a6'},yard:{n:'小院',i:'🌳',view:'garden',vn:'花园',c:'#8fcf7a'},floor2:{n:'二楼',i:'🪜',view:'cloud',vn:'云朵',c:'#e9c9a8',need:'big'},
  attic:{n:'阁楼',i:'🔭',view:'stars',vn:'星空',c:'#c0705a',need:'floor2'},roof:{n:'屋顶花园',i:'🌻',view:'sunset',vn:'日落',c:'#f2b45c',need:'floor2'},pond:{n:'池塘',i:'🦆',view:'pond',vn:'池塘',c:'#6fb7d6',need:'yard'},
  corner:{n:'街角',i:'🏮',view:'street',vn:'街灯',c:'#8f7fb3',need:'yard'},beach:{n:'海边小路',i:'🌊',view:'sea',vn:'大海',c:'#3f8fc4',need:'corner'}};
const W_TIER={small:'小变化',mid:'中变化',big:'大变化'};
const wHow=(e)=>e.tier==='big'?'缘分擦肩':e.tier==='mid'?'擦身遇见 · 成为好友':'擦身遇见老朋友';
function worldState(target=D){const S={decor:{},order:[],paper:null,floor:null,garland:null,shelf:null,sidewin:false,expand:0,areas:[],view:null,trees:0,bloom:0,door:false,cnt:{small:0,mid:0,big:0},frags:[],papers:[],floors:[]};
  (target.world.log||[]).forEach((e,i)=>{const R=mb32(e.seed),pk=a=>a[Math.floor(R()*a.length)%a.length],col=WPAL[e.breed]||WPAL.orange,cn=`「${e.name}」`;let fr;const mw=k=>k==='stars'?'一组':k==='books'?'一摞':'一个';
    if(e.tier==='small'){let kind=pk([...Object.keys(WS_WALL),...Object.keys(WS_FLOOR)]);let type=WS_WALL[kind]?'wall':'floor';
      let free=W_SLOTS[type].filter(s=>!S.decor[s]);if(!free.length){const ot=type==='wall'?'floor':'wall';const of=W_SLOTS[ot].filter(s=>!S.decor[s]);if(of.length){type=ot;free=of;kind=pk(Object.keys(type==='wall'?WS_WALL:WS_FLOOR))}}
      const nm=(type==='wall'?WS_WALL:WS_FLOOR)[kind];
      if(free.length){const s=free[0];S.decor[s]={id:i,k:kind,col,from:e.name};S.order.push(s);fr={k:kind,t:`${type==='wall'?'墙上':'地上'}多了${mw(kind)}${cn}花色的${nm}`}}
      else if(S.areas.includes('yard')){S.trees++;fr={k:'tree',t:'房间摆满了，小院里多长出一棵树'}}
      else{const s=S.order.shift();const old=S.decor[s];const tp=W_SLOTS.wall.includes(s)?'wall':'floor';const k2=WS_WALL[kind]&&tp==='wall'||WS_FLOOR[kind]&&tp==='floor'?kind:pk(Object.keys(tp==='wall'?WS_WALL:WS_FLOOR));
        S.decor[s]={id:i,k:k2,col,from:e.name};S.order.push(s);fr={k:k2,t:`房间摆满了，把「${old.from}」留下的${(WS_WALL[old.k]||WS_FLOOR[old.k])}换成了${cn}花色的${WS_WALL[k2]||WS_FLOOR[k2]}`}}
      S.cnt.small++}
    else if(e.tier==='mid'){const av=['paper','floor'];['garland','shelf','sidewin'].forEach(k=>{if(!S[k])av.push(k,k)});if(S.expand<3)av.push('expand');const k=pk(av);
      if(k==='paper'){const p=pk(W_PAPER.filter(x=>x[0]!==S.paper?.c));S.paper={c:p[0],n:p[1]};if(!S.papers.some(x=>x.n===p[1]))S.papers.push(S.paper);fr={k,t:`墙纸换成了${p[1]}色`}}
      else if(k==='floor'){const f=pk(W_FLOORS.slice(1).filter(x=>x[0]!==S.floor?.n));S.floor={n:f[0],cs:f[1]};if(!S.floors.some(x=>x.n===f[0]))S.floors.push(S.floor);fr={k,t:`地板换成了${f[0]}花色`}}
      else if(k==='garland'){S.garland=col;fr={k,t:`墙上挂起了一串彩灯（带一点${cn}的毛色）`}}
      else if(k==='shelf'){S.shelf=col;fr={k,t:'侧墙多了一个小置物架'}}
      else if(k==='sidewin'){S.sidewin=true;fr={k,t:'侧墙开了一扇新窗'}}
      else{S.expand++;fr={k,t:`房间往外扩了一格（地图上第 ${S.expand} 次扩建）`}}
      S.cnt.mid++}
    else{const own=new Set(S.areas);const av=Object.keys(W_AREAS).filter(k=>{if(own.has(k))return false;const n=W_AREAS[k].need;return !n||(n==='big'?S.cnt.big>=1:own.has(n))});
      if(av.length){const k=pk(av);const A=W_AREAS[k];S.areas.push(k);S.view=k;const fd=!S.door;S.door=true;fr={k,t:`长出了新区域「${A.n}」${fd?'，墙上多了一扇门':''}，窗外变成了${A.vn}`}}
      else{S.bloom++;fr={k:'bloom',t:'地图上又开出一片花田'}}
      S.cnt.big++}
    S.frags.push(fr)});
  return S}
function worldGrow(f,how,isNew,ctx){if(f.src!=='native_device')return {skip:'source'};const target=ctx?.data||D,d=ctx?.daily||today();d.world=d.world||0;const day=ctx?.day||dk(new Date());target.world.log=target.world.log||[];
  if(target.world.log.some(e=>e.fid===f.fid&&e.day===day))return {skip:'same'};
  if(d.world>=wCap(day,target))return {skip:'cap'};
  const tier=how==='fate'?'big':isNew?'mid':'small';
  const seed=hash([target.me.id,f.fid].sort().join('|')+'|'+day+'|'+how);
  target.world.log.push({t:ctx?.at||Date.now(),day,source:'native_device',eventId:ctx?.event?.eventId||null,fid:f.fid,name:f.petName,breed:f.breed,how,tier,seed});d.world++;target.world.unseen=(target.world.unseen||0)+1;
  const S=worldState(target);const fr=S.frags[S.frags.length-1];if(ctx)return {tier,frag:fr};saveD();
  try{buildWorld3D()}catch(e){}
  track('world_grow',{tier,frag:fr.k,how});
  setTimeout(()=>toast(`🌱 相遇世界：${fr.t}`),900);
  return {tier,frag:fr}}
/* ---------- 整理小家：自动生成之上的一层「我的改动」（不改种子，新相遇照常自动生长） ---------- */
const W_SLOTN={b1:'后墙中间',b2:'后墙左边',b3:'后墙右边（窗旁）',r1:'侧墙里侧',r2:'侧墙中间',r3:'侧墙外侧',r4:'侧墙低处',f1:'地上 · 爬架旁',f2:'地上 · 爬架前',f3:'地上 · 地毯前',f4:'地上 · 左前角'};
const W_MIDN={garland:'彩灯串',shelf:'置物架',sidewin:'侧墙新窗'};
let wEditOpen=false;
const wE=()=>(D.world.edit=D.world.edit||{});
function worldApplied(S){S=S||worldState();const E=D.world.edit||{};const V={...S,decor:{...S.decor},hidden:[]};
  if(E.shuf)['wall','floor'].forEach(t=>{const sl=W_SLOTS[t];const it=sl.map(s=>V.decor[s]||null);const R=mb32(E.shuf+(t==='wall'?1:2));for(let i=it.length-1;i>0;i--){const j=Math.floor(R()*(i+1));[it[i],it[j]]=[it[j],it[i]]}sl.forEach((s,i)=>{if(it[i])V.decor[s]=it[i];else delete V.decor[s]})});
  (E.moves||[]).forEach(([id,to])=>{const from=Object.keys(V.decor).find(s=>V.decor[s].id===id);if(!from||from===to)return;const tp=W_SLOTS.wall.includes(from)?'wall':'floor';if(!W_SLOTS[tp].includes(to))return;const o=V.decor[to];V.decor[to]=V.decor[from];if(o)V.decor[from]=o;else delete V.decor[from]});
  Object.keys(V.decor).forEach(s=>{if((E.hide||[]).includes(V.decor[s].id)){V.hidden.push({...V.decor[s],slot:s});delete V.decor[s]}});
  if(E.paper==='orig')V.paper=null;else if(E.paper){const p=S.papers.find(x=>x.n===E.paper);if(p)V.paper=p}
  if(E.floor==='orig')V.floor=null;else if(E.floor){const p=S.floors.find(x=>x.n===E.floor);if(p)V.floor=p}
  if(E.view==='orig')V.view=null;else if(E.view&&S.areas.includes(E.view))V.view=E.view;
  const off=E.off||{};Object.keys(W_MIDN).forEach(k=>{if(off[k])V[k]=k==='sidewin'?false:null});
  return V}
function worldEditHtml(S,V){const E=D.world.edit||{};const chip=(grp,val,label,on)=>`<button type="button" class="sc-wchip${on?' on':''}" data-we="${grp}" data-wv="${esc(val)}">${esc(label)}</button>`;
  const items=[...Object.entries(V.decor).map(([s,it])=>({...it,slot:s,hid:false})),...V.hidden.map(it=>({...it,hid:true}))].sort((a,b)=>a.id-b.id);
  const rows=items.map(it=>{const tp=W_SLOTS.wall.includes(it.slot)?'wall':'floor';const nm=WS_WALL[it.k]||WS_FLOOR[it.k];
    const opts=W_SLOTS[tp].map(s=>{const o=V.decor[s];return `<option value="${s}"${s===it.slot?' selected':''}>${W_SLOTN[s]}${o&&s!==it.slot?`（和${WS_WALL[o.k]||WS_FLOOR[o.k]}换）`:''}</option>`}).join('');
    return `<li class="sc-weitem${it.hid?' hid':''}"><i style="background:${it.col}"></i><span><b>${nm}</b><small>「${esc(it.from)}」留下的</small></span>${it.hid?'':`<select data-wmove="${it.id}" aria-label="${nm}的位置">${opts}</select>`}<button type="button" class="g-btn ghost" data-we="hide" data-wv="${it.id}">${it.hid?'摆出来':'收起'}</button></li>`}).join('');
  const papers=S.papers.length?`<div class="sc-werow"><b>墙纸</b>${chip('paper','','自动（最新）',!E.paper)}${chip('paper','orig','原来的',E.paper==='orig')}${S.papers.map(p=>chip('paper',p.n,p.n,E.paper===p.n)).join('')}</div>`:'';
  const floors=S.floors.length?`<div class="sc-werow"><b>地板</b>${chip('floor','','自动（最新）',!E.floor)}${chip('floor','orig','原来的',E.floor==='orig')}${S.floors.map(p=>chip('floor',p.n,p.n,E.floor===p.n)).join('')}</div>`:'';
  const views=S.areas.length?`<div class="sc-werow"><b>窗外</b>${chip('view','','自动（最新区域）',!E.view)}${chip('view','orig','原来的',E.view==='orig')}${S.areas.map(k=>chip('view',k,W_AREAS[k].vn,E.view===k)).join('')}</div>`:'';
  const mids=Object.keys(W_MIDN).filter(k=>S[k]);const midr=mids.length?`<div class="sc-werow"><b>装饰</b>${mids.map(k=>chip('off',k,(E.off?.[k]?'○ ':'● ')+W_MIDN[k],!E.off?.[k])).join('')}</div>`:'';
  const any=items.length||papers||floors||views||midr;
  return `<details class="sc-wedit" ${wEditOpen?'open':''}><summary>✏️ 整理小家 <small>东西都是相遇自动长出来的，摆法你可以改</small></summary>
  ${any?`${items.length?`<ol class="sc-welist">${rows}</ol>`:''}${papers}${floors}${views}${midr}
  <div class="lf-row"><button type="button" class="g-btn" data-we="shuf">🎲 随机摆一摆</button><button type="button" class="g-btn ghost" data-we="reset">↺ 恢复自动生成</button></div>
  <p class="sc-small">你的改动会一直保留；之后的相遇照常自动长新东西，不会被你的改动挡住。收起的摆件放进收纳，随时能摆回来。</p>`:'<p class="lf-note">还没有长出可以整理的东西。</p>'}</details>`}
function worldEditClick(e){const t=e.target.closest('[data-we]');if(!t)return false;const E=wE(),g=t.dataset.we,v=t.dataset.wv;wEditOpen=true;
  if(g==='hide'){const id=+v;E.hide=E.hide||[];E.hide=E.hide.includes(id)?E.hide.filter(x=>x!==id):[...E.hide,id]}
  else if(g==='paper'||g==='floor'||g==='view'){if(v)E[g]=v;else delete E[g]}
  else if(g==='off'){E.off=E.off||{};E.off[v]=!E.off[v]}
  else if(g==='shuf'){E.shuf=1+Math.floor(Math.random()*1e9);E.moves=[]}
  else if(g==='reset'){D.world.edit={}}
  saveD();try{buildWorld3D()}catch(err){}track('world_edit',{op:g});wRerender();return true}
function worldEditChange(e){const t=e.target;if(!t.dataset?.wmove)return false;const E=wE();E.moves=[...(E.moves||[]),[+t.dataset.wmove,t.value]].slice(-80);wEditOpen=true;saveD();try{buildWorld3D()}catch(err){}track('world_edit',{op:'move'});wRerender();return true}
function wRerender(){const b=$('sc-hbody');const st=b?.scrollTop||0;renderHub();if(b)b.scrollTop=st}
/* ---------- 3D：把世界画进小家（只在原房间之上叠加，原材质存档可还原） ---------- */
let worldG=null;
function wViewPix(v,c,r){/* 16×13 像素窗景 */const C=16,Rr=13;
  if(v==='city'){const hs=[5,7,4,8,6,9,5,7,6,4,8,5,7,6,9,5];const sky=r<4?'#9fd0f0':'#cfe8f5';const h=hs[c];if(Rr-r<=h){const lit=(c%3!==1)&&(r%2===0)&&((c*7+r*3)%5<3);return lit?'#ffe39a':['#7d8fa8','#93a3b8','#6f7f96'][Math.floor(c/2)%3]}return sky}
  if(v==='garden'){if(r>=10)return (c+r)%5===0?'#f6a5c0':(c*3+r)%7===0?'#ffe07a':'#79bb66';if(r>=8)return (c*5+r)%9===0?'#ffffff':'#8fcf7a';if(c>=2&&c<=4&&r>=4&&r<8)return r<6?'#5f9c50':'#8a6446';if(c===3&&r===3)return '#6fae5c';return r<3?'#bfe6f7':'#d7f0f9'}
  if(v==='cloud'){const cl=[[3,2],[4,2],[5,2],[2,3],[3,3],[4,3],[5,3],[6,3],[10,5],[11,5],[12,5],[9,6],[10,6],[11,6],[12,6],[13,6],[4,9],[5,9],[6,9],[3,10],[4,10],[5,10],[6,10],[7,10]];if(cl.some(([x,y])=>x===c&&y===r))return r===3||r===6||r===10?'#e8f4fb':'#ffffff';return r<5?'#a9d8f5':r<9?'#bde2f8':'#d3ecfa'}
  if(v==='stars'){if((c===12||c===13)&&(r===2||r===3))return '#fff4c8';if((c*7+r*11)%17===0)return '#fff4b8';if((c*5+r*3)%23===0)return '#9fb3ff';return r<6?'#1f2a52':'#2b376b'}
  if(v==='sunset'){const dx=c-8,dy=r-8;if(dx*dx+dy*dy<=6&&r<=8)return '#ff7b4a';if(r>=10)return (c%4===1&&r===10)?'#5d3f4f':'#6b4a5a';return r<3?'#f5866a':r<6?'#ff9e6b':r<8?'#ffc98a':'#f7e1a8'}
  if(v==='pond'){if(r>=7){if((c===4||c===5)&&r===9||(c===11&&r===11)||(c===12&&r===11))return '#7cc46a';if(c===5&&r===8)return '#f6a5c0';return (c+r)%6===0?'#9fd3ea':'#6fb7d6'}if(r>=5)return c<3||c>12?'#5f9c50':'#8fcf7a';return r<2?'#a9d8f0':'#c4e6f5'}
  if(v==='street'){if(r>=11)return '#6d6a7d';if(c===11&&r>=3)return '#3b3b4a';if((c===10||c===11||c===12)&&r===2)return '#ffe08a';if(c>=2&&c<=6&&r>=6){return (r===8&&(c===3||c===5))?'#ffd36b':'#a06a5a'}if(c>=1&&c<=7&&r===5)return '#7a4a44';return r<4?'#5d5f9a':r<8?'#7a72aa':'#8f7fb3'}
  if(v==='sea'){if(r>=11)return '#f0d9a8';if(r>=6)return (c+r*2)%5===0?'#bfe8f7':'#3f8fc4';if((c===12||c===13)&&(r===2||r===3))return '#fff1b0';return r<3?'#a8dcf5':'#c4e7f8'}
  return null}
function buildWorld3D(S){const r=window.__pgRoom;if(!r?.scene)return false;S=S||worldApplied();let Mesh,Box,Mat,Grp;
  r.scene.traverse(o=>{if(!Mesh&&o.isMesh&&o.geometry?.type==='BoxGeometry'&&o.material&&!Array.isArray(o.material)&&o.material.type==='MeshStandardMaterial'){Mesh=o.constructor;Box=o.geometry.constructor;Mat=o.material.constructor}if(!Grp&&o.type==='Group')Grp=o.constructor});
  if(!Mesh)return false;Grp=Grp||Mesh;
  /* 墙纸 / 地板：替换为新材质，原材质存在 userData 里 */
  const walls=[],tiles=[];r.scene.traverse(o=>{if(!o.isMesh||o.geometry?.type!=='BoxGeometry'||o.parent?.name?.startsWith('pg-'))return;const q=o.geometry.parameters;
    if((q.width===49&&q.height===23)||(q.depth===44&&q.height===23))walls.push(o);else if(Math.abs(q.width-12.03)<.05&&Math.abs(q.depth-3.92)<.05&&q.height<.3)tiles.push(o)});
  const swap=(o,c)=>{if(!o.userData.pgMat)o.userData.pgMat=o.material;if(o.material!==o.userData.pgMat)o.material.dispose();o.material=c==null?o.userData.pgMat:o.userData.pgMat.clone();if(c!=null)o.material.color.set(c)};
  walls.forEach(o=>{if(!S.paper){if(o.userData.pgMat)swap(o,null);return}const side=o.geometry.parameters.depth===44;const c=new (o.material.color.constructor)(S.paper.c);if(side)c.offsetHSL(0,0,-.04);swap(o,'#'+c.getHexString())});
  const base=W_FLOORS[0][1];tiles.forEach(o=>{const oc='#'+(o.userData.pgMat||o.material).color.getHexString();if(!S.floor){if(o.userData.pgMat)swap(o,null);return}const i=Math.max(0,base.indexOf(oc));swap(o,S.floor.cs[i])});
  if(!worldG){worldG=new Grp();worldG.name='pg-world';r.scene.add(worldG)}
  while(worldG.children.length){const c=worldG.children.pop();c.traverse?.(x=>{x.geometry?.dispose();x.material?.dispose?.()})}
  const G=worldG;const cube=(w,h,d,x,y,z,col,o={})=>{const m=new Mesh(new Box(w,h,d),new Mat({color:col,roughness:1,flatShading:true,...(o.em?{emissive:o.em,emissiveIntensity:o.ei||.7}:{}),...(o.op?{transparent:true,opacity:o.op}:{})}));m.position.set(x,y,z);m.castShadow=!o.op;m.receiveShadow=true;G.add(m);return m};
  /* 墙面局部坐标：u 沿墙水平、v 高度（中心）、n 离墙距离 */
  const WB=22.58,WR=-24.08;const wb=(side,u,v,w,h,d,col,o={},n=0)=>side==='b'?cube(w,h,d,u,v,WB-n-d/2,col,o):cube(d,h,w,WR+n+d/2,v,u,col,o);
  const SL={b1:['b',1.5,17],b2:['b',17,15.5],b3:['b',-21,15],r1:['r',17,13],r2:['r',5,14.5],r3:['r',-15,13],r4:['r',19.8,8.8],f1:[19,0,-2],f2:[13.5,0,1.5],f3:[-4,0,-13],f4:[22,0,-6]};
  Object.entries(S.decor).forEach(([s,it])=>{const P0=SL[s];if(!P0)return;const col=it.col;
    if(P0.length===3&&typeof P0[0]==='string'){const [sd,u,v]=P0;
      if(it.k==='frame'){wb(sd,u,v,3.8,3.2,.25,0x7a5638);wb(sd,u,v,3.0,2.4,.12,col,{},.25);wb(sd,u+.5,v-.3,1.2,1,.1,0xfff6e6,{},.37);wb(sd,u+.1,v+.25,.5,.5,.1,0xfff6e6,{},.37);wb(sd,u+.9,v+.25,.5,.5,.1,0xfff6e6,{},.37)}
      if(it.k==='poster'){wb(sd,u,v,3,4,.1,0xfbf3e2);wb(sd,u,v+.7,2.4,1.6,.08,col,{},.1);wb(sd,u-.6,v-1.1,.9,.3,.08,0x9a8a7a,{},.1);wb(sd,u+.3,v-1.1,.5,.3,.08,0x9a8a7a,{},.1);wb(sd,u-1.2,v+1.8,.35,.35,.08,0xe86a5a,{},.1);wb(sd,u+1.2,v+1.8,.35,.35,.08,0xe86a5a,{},.1)}
      if(it.k==='stars'){[[0,0,.9],[-1.6,.9,.6],[1.5,1,.7],[-1,-1.3,.5],[1.1,-1.1,.55]].forEach(([a,b,z],i)=>{const c2=i%2?col:0xffd85a;wb(sd,u+a,v+b,z,z*.4,.08,c2,{em:c2,ei:.35});wb(sd,u+a,v+b,z*.4,z,.08,c2,{em:c2,ei:.35})})}
      if(it.k==='clock'){wb(sd,u,v,3,2.2,.25,col);wb(sd,u,v,2.2,3,.25,col);wb(sd,u,v,2.4,2.4,.25,col);wb(sd,u,v,1.9,1.9,.1,0xfffaf0,{},.25);wb(sd,u,v+.35,.18,.8,.06,0x3a3330,{},.35);wb(sd,u-.3,v,.7,.18,.06,0x3a3330,{},.35)}}
    else{const [x,,z]=P0;
      if(it.k==='flower'){cube(1.8,1.6,1.8,x,.8,z,0xc9784f);cube(2,.3,2,x,1.65,z,0xb56a44);cube(.3,1.6,.3,x,2.5,z,0x5f9c50);cube(.8,.5,.4,x+.5,2.3,z,0x6fae5c);cube(1.3,1,1.3,x,3.6,z,col,{em:col,ei:.15});cube(.5,.5,.5,x,3.6,z-.5,0xffe07a)}
      if(it.k==='cushion'){cube(3.2,.9,3.2,x,.45,z,col);cube(2.6,.25,2.6,x,1,z,0xfff6e6,{op:.35});cube(.4,.4,.4,x+1.6,.6,z+1.6,0xf0bf73);cube(.4,.4,.4,x-1.6,.6,z-1.6,0xf0bf73)}
      if(it.k==='books'){cube(2.8,.6,2,x,.3,z,0x8fb3c9);cube(2.6,.55,1.9,x+.1,.88,z,col);cube(2.4,.5,1.8,x-.1,1.4,z,0xe8907a);cube(1.6,.45,1.2,x,1.88,z,0xf2e6b8)}
      if(it.k==='mush'){cube(.8,1.6,.8,x,.8,z,0xfaf2e4);cube(2.4,.9,2.4,x,2,z,col,{em:col,ei:.45});cube(1.6,.4,1.6,x,2.6,z,col,{em:col,ei:.45});cube(.4,.12,.4,x+.6,2.47,z-.5,0xffffff);cube(.35,.12,.35,x-.5,2.47,z+.4,0xffffff)}
      if(it.k==='fish'){cube(3.4,.4,2.4,x,.2,z,0x8a6a4a);cube(3.2,2.2,2.2,x,1.5,z,0xbfe8f7,{op:.45});cube(3,1.6,2,x,1.2,z,0x6fb7d6,{op:.55});cube(.7,.4,.3,x+.3,1.4,z-1.15,col);cube(.3,.3,.3,x+.8,1.4,z-1.15,col);cube(.25,.6,.25,x-1,.9,z,0x6fae5c)}}});
  if(S.garland){const cs=[S.garland,'#ffd36b','#ff8fa3','#8fd3ff','#b6f09c'];for(let x=-23,i=0;x<=23;x+=1.6,i++){const sag=1.1*Math.sin((x+23)/46*Math.PI*3)**2;wb('b',x,21.4-sag,.5,.6,.5,cs[i%5],{em:cs[i%5],ei:.9},.05);wb('b',x,21.85-sag,.08,.4,.08,0x5a4a3a,{},.2)}
    for(let z=21,i=0;z>=-19;z-=1.6,i++){const sag=1.1*Math.sin((21-z)/40*Math.PI*2)**2;wb('r',z,21.4-sag,.5,.6,.5,cs[(i+2)%5],{em:cs[(i+2)%5],ei:.9},.05)}}
  if(S.shelf){wb('r',10,8.5,7,.4,1.8,0xb88a5c);wb('r',7.4,7.6,.4,1.4,.9,0x8a6a4a);wb('r',12.6,7.6,.4,1.4,.9,0x8a6a4a);wb('r',8.2,9.6,.6,1.8,1.2,S.shelf);wb('r',8.9,9.5,.5,1.6,1.2,0x8fb3c9);wb('r',9.5,9.4,.5,1.4,1.2,0xe8907a);wb('r',11.6,9.2,1.1,1,1.1,0xc9784f);wb('r',11.6,10.2,.9,.9,.9,0x6fae5c)}
  const view=S.view?W_AREAS[S.view].view:null;
  const pane=(sd,u0,u1,v0,v1,n)=>{if(!view)return;const C=16,R=13,cw=(u1-u0)/C,ch=(v1-v0)/R;for(let rr=0;rr<R;rr++){let st=0;for(let cc=1;cc<=C;cc++){const a=wViewPix(view,st,rr),b2=cc<C?wViewPix(view,cc,rr):null;if(b2!==a){const w=(cc-st)*cw;const uc=sd==='b'?u1-(st*cw)-w/2:u1-(st*cw)-w/2;wb(sd,uc,v1-rr*ch-ch/2,w,ch,.05,a,{em:a,ei:.25},n);st=cc}}}};
  if(S.sidewin){const z0=-9.5,z1=-.5,y0=8,y1=15;wb('r',(z0+z1)/2,(y0+y1)/2,z1-z0+1,y1-y0+1,.3,0xf4efe6);if(view)pane('r',z0,z1,y0,y1,.3);else wb('r',(z0+z1)/2,(y0+y1)/2,z1-z0,y1-y0,.1,0xbfe3ef,{em:0xbfe3ef,ei:.3},.3);
    wb('r',(z0+z1)/2,(y0+y1)/2,.35,y1-y0,.12,0xf4efe6,{},.36);wb('r',(z0+z1)/2,(y0+y1)/2,z1-z0,.35,.12,0xf4efe6,{},.36);wb('r',(z0+z1)/2,y0-.4,z1-z0+1.6,.5,1,0xf4efe6)}
  if(view){pane('b',-16.9,-4.1,9.1,19.9,.75);wb('b',-10.5,14.5,.55,10.8,.1,0xf4efe6,{},.8)}
  if(S.door){const x=1.5;wb('b',x,5.4,6.8,10.9,.3,0x8a6446);wb('b',x,5.2,5.8,10.3,.12,0xc98f5c,{},.3);wb('b',x,7.6,4.4,3.6,.08,0xd9a172,{},.42);wb('b',x,2.8,4.4,3.6,.08,0xd9a172,{},.42);wb('b',x-2.1,5.2,.5,.5,.25,0xf0c75a,{em:0xf0c75a,ei:.3},.42);cube(7,.15,1.4,x,.08,WB-.7,0xb57a52);
    S.areas.forEach((k,i)=>{const n=S.areas.length;const u=x+(i-(n-1)/2)*1.3;const c=W_AREAS[k].c;wb('b',u,12,1.05,1.05,.15,0xfffaf0);wb('b',u,12,.75,.75,.1,c,{em:c,ei:.3},.15)})}
  return true}
/* ---------- 地图（世界页）：像素等距画布 ---------- */
function worldHtml(){const S=worldState();if(hov.querySelector('.sc-wedit'))wEditOpen=hov.querySelector('.sc-wedit').open;const d=today();const cap=wCap(),left=Math.max(0,cap-(d.world||0));const log=D.world.log||[];
  const tl=log.map((e,i)=>({e,fr:S.frags[i]})).reverse().slice(0,30).map(({e,fr})=>{const dt=new Date(e.t);return `<li class="sc-wl ${e.tier}"><span class="sc-wt">${W_TIER[e.tier]}</span><div><b>${e.source==='native_device'?'真实吧唧':'历史原型记录'} · ${dt.getMonth()+1}/${dt.getDate()} · 和「${esc(e.name)}」${wHow(e)}</b><small>→ ${esc(fr?.t||'')}</small></div></li>`}).join('');
  const next=Object.keys(W_AREAS).filter(k=>!S.areas.includes(k)&&(!W_AREAS[k].need||(W_AREAS[k].need==='big'?S.cnt.big>=1:S.areas.includes(W_AREAS[k].need)))).map(k=>W_AREAS[k].n);
  return `<section class="sc-world"><canvas id="sc-wmap" width="680" height="460" aria-label="相遇世界地图"></canvas>
  <div class="sc-wstat"><span>🌱 种子 <b>${log.length}</b></span><span>小变化 <b>${S.cnt.small}</b></span><span>中变化 <b>${S.cnt.mid}</b></span><span>大变化 <b>${S.cnt.big}</b></span><span>今天还能长 <b>${left}</b> 次</span></div>
  <p class="lf-note">每一次确认的相遇都会种下一颗种子：老朋友带来小摆件，新朋友带来大一点的改造，缘分擦肩会长出新区域。<b>没有相遇时，房间不会变化</b>；同一个人每天只算一次，每天能长几次是随机的（${WCAP_MIN}–${WCAP_MAX} 次，今天是 ${cap} 次）。世界跟着你走，换猫、毕业都不会清空。户外的地点来自你真实去过的地方，和相遇无关。</p>
  ${S.areas.length?`<p class="lf-note">已长出：${S.areas.map(k=>W_AREAS[k].i+W_AREAS[k].n).join('、')}${S.view?` · 窗外现在是${W_AREAS[S.view].vn}`:''}</p>`:''}
  ${next.length?`<p class="lf-note">下一次缘分擦肩可能长出：${next.join('、')}${false?'':'（缘分擦肩默认关闭，采集尚未开放）'}</p>`:''}
  <div class="lf-row"><button type="button" class="g-btn" data-h="wroom">🏠 回小家看看</button>${false?'':'<button type="button" class="g-btn ghost" data-htab="settings">缘分擦肩说明</button>'}</div>
  ${worldEditHtml(S,worldApplied(S))}
  <h4>生长记录</h4>${tl?`<ol class="sc-wlog">${tl}</ol>`:'<p class="lf-note">还没有种子。去「附近」遇见一只小猫吧。</p>'}</section>`}
function drawWorldMap(){const cv=$('sc-wmap');if(!cv)return;const g=cv.getContext('2d');const S=worldApplied();const W=cv.width,H=cv.height;g.clearRect(0,0,W,H);g.imageSmoothingEnabled=false;
  const T=29,cx=W/2,cy=H/2+18;const iso=(x,y,z=0)=>[cx+(x-y)*T,cy+(x+y)*T/2-z*T];
  const sh=(c,k)=>{const n=parseInt(c.slice(1),16);let r=n>>16,gg=n>>8&255,b=n&255;r=Math.max(0,Math.min(255,r*k|0));gg=Math.max(0,Math.min(255,gg*k|0));b=Math.max(0,Math.min(255,b*k|0));return `rgb(${r},${gg},${b})`};
  const poly=(pts,f,s)=>{g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();if(f){g.fillStyle=f;g.fill()}if(s){g.strokeStyle=s;g.lineWidth=1;g.stroke()}};
  const tile=(x,y,c,z=0,alpha=1)=>{g.globalAlpha=alpha;poly([iso(x,y,z),iso(x+1,y,z),iso(x+1,y+1,z),iso(x,y+1,z)],c,'rgba(0,0,0,.06)');g.globalAlpha=1};
  const block=(x,y,w,d,z0,h,top,side)=>{const a=iso(x,y+d,z0+h),b=iso(x+w,y+d,z0+h),c=iso(x+w,y,z0+h),e=iso(x,y,z0+h);
    poly([iso(x,y+d,z0),iso(x+w,y+d,z0),b,a],sh(side,.92));poly([iso(x+w,y,z0),iso(x+w,y+d,z0),b,c],sh(side,.78));poly([e,c,b,a],top,'rgba(0,0,0,.08)')};
  const emo=(t,x,y,z=0,sz=16)=>{const [px,py]=iso(x,y,z);g.font=`${Math.round(sz*T/17)}px "Noto Color Emoji",sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillText(t,px,py)};
  const lab=(t,x,y,z=0)=>{const [px,py]=iso(x,y,z);g.font='600 15px sans-serif';g.textAlign='center';g.textBaseline='top';const w=g.measureText(t).width+10;g.fillStyle='rgba(255,255,255,.88)';g.fillRect(px-w/2,py,w,20);g.fillStyle='#4a5a55';g.fillText(t,px,py+3)};
  /* 地面 */
  for(let x=-7;x<7;x++)for(let y=-7;y<7;y++){if(Math.abs(x+.5)+Math.abs(y+.5)>9.5)continue;tile(x,y,(x+y)%2?'#e4efd2':'#dcead0')}
  /* 户外：真实去过的地点（与相遇无关） */
  let pl=[];try{pl=(L.places()||[]).filter(p=>p.kind!=='home'&&p.kind!=='work'&&p.id!=='home'&&p.id!=='work')}catch(e){}
  const home=(()=>{try{return L.places().find(p=>p.kind==='home'||p.id==='home')}catch(e){return null}})();
  pl.slice(0,8).forEach((p,i)=>{let ang=home&&p.lat!=null?Math.atan2(p.lat-home.lat,p.lon-home.lon):i*Math.PI/4+.3;const rr=7;let x=Math.round(Math.cos(ang)*rr-.5),y=Math.round(-Math.sin(ang)*rr-.5);
    tile(x,y,'#cfe2b8');emo(p.icon||'📍',x+.5,y+.5,.7,15);lab(p.name||'',x+.5,y+.5,.2)});
  /* 房间（中心）：随中变化扩建 */
  const s=2+S.expand;const ox=-Math.ceil(s/2),oy=-Math.ceil(s/2);const wall=S.paper?.c||'#a9d4cf',fl=S.floor?.cs?.[0]||'#d3a779';
  /* 区域 */
  const A=new Set(S.areas);
  const fog=(x,y,w,d)=>{g.setLineDash([3,3]);for(let i=0;i<w;i++)for(let j=0;j<d;j++)poly([iso(x+i,y+j),iso(x+i+1,y+j),iso(x+i+1,y+j+1),iso(x+i,y+j+1)],'rgba(255,255,255,.35)','rgba(90,110,100,.35)');g.setLineDash([])};
  const pos={yard:[ox,oy+s,3,3],pond:[ox+3,oy+s+1,2,2],corner:[ox+s,oy-1,2,3],beach:[ox+s+2,oy-3,2,3],balcony:[ox-2,oy,2,2]};
  const next=new Set(Object.keys(W_AREAS).filter(k=>!A.has(k)&&(!W_AREAS[k].need||(W_AREAS[k].need==='big'?S.cnt.big>=1:A.has(W_AREAS[k].need)))));
  Object.entries(pos).forEach(([k,[x,y,w,d]])=>{if(!A.has(k)&&next.has(k))fog(x,y,w,d)});
  if(A.has('yard')){const [x,y,w,d]=pos.yard;for(let i=0;i<w;i++)for(let j=0;j<d;j++)tile(x+i,y+j,(i+j)%2?'#8fcf7a':'#86c672');for(let i=0;i<w;i++)block(x+i+.1,y+d-.15,.8,.15,0,.35,'#f4efe6','#d9cbb4');
    const tr=Math.min(8,1+S.trees);for(let t=0;t<tr;t++){const tx=x+.2+(t*1.3)%w,ty=y+.2+Math.floor(t*1.3/w)*1.2%d;block(tx+.25,ty+.25,.2,.2,0,.5,'#8a6446','#8a6446');block(tx,ty,.7,.7,.5,.7,'#5f9c50','#4f8c42')}}
  if(A.has('pond')){const [x,y,w,d]=pos.pond;for(let i=0;i<w;i++)for(let j=0;j<d;j++)tile(x+i,y+j,(i+j)%2?'#6fb7d6':'#7fc2de');emo('🦆',x+1,y+1,.15,13)}
  if(A.has('corner')){const [x,y,w,d]=pos.corner;for(let i=0;i<w;i++)for(let j=0;j<d;j++)tile(x+i,y+j,'#a7a2b4');block(x+1.4,y+1.4,.15,.15,0,1.6,'#3b3b4a','#3b3b4a');block(x+1.25,y+1.25,.45,.45,1.6,.3,'#ffe08a','#f2c14e')}
  if(A.has('beach')){const [x,y,w,d]=pos.beach;for(let i=0;i<w;i++)for(let j=0;j<d;j++)tile(x+i,y+j,i===0?'#f0d9a8':'#3f8fc4');emo('🌊',x+1.5,y+1.5,.15,13)}
  if(A.has('balcony')){const [x,y,w,d]=pos.balcony;block(x,y,w,d,0,.9,'#c9b8a6','#b3a28f');for(let j=0;j<d;j++)block(x,y+j+.1,.12,.8,.9,.35,'#f4efe6','#d9cbb4');emo('🪴',x+1,y+1,1.2,13)}
  for(let b=0;b<Math.min(S.bloom,4);b++){const fx=ox-2-b%2,fy=oy+s+b;tile(fx,fy,'#f6c5d6');emo('🌸',fx+.5,fy+.5,.15,11)}
  /* 房子本体 */
  const h1=1.4;block(ox,oy,s,s,0,h1,fl,wall);
  if(S.door){const [dx,dy]=iso(ox+s,oy+s/2,0);g.fillStyle='#8a6446';g.fillRect(dx-5,dy-T*1.05,8,T*1.05)}
  let top=h1;
  if(A.has('floor2')){block(ox+.15,oy+.15,s-.3,s-.3,top,1.2,A.has('roof')?'#8fcf7a':'#e9c9a8',wall);top+=1.2;
    if(A.has('roof')){emo('🌻',ox+s*.7,oy+s*.3,top+.3,13);emo('🌼',ox+s*.75,oy+s*.75,top+.3,12)}}
  if(A.has('attic')){const t2=top;const a=iso(ox+.3,oy+.3,t2),b=iso(ox+s*.55,oy+.3,t2),c=iso(ox+s*.55,oy+s-.3,t2),e=iso(ox+.3,oy+s-.3,t2);const ap=iso(ox+s*.42,oy+s/2,t2+1.1);
    poly([e,c,ap],'#c0705a');poly([c,b,ap],'#a85e4a');emo('⭐',ox+s*.42,oy+s/2,t2+1.4,11)}
  else if(!A.has('floor2')){/* 屋顶 */const a=iso(ox,oy+s,top),b=iso(ox+s,oy+s,top),c=iso(ox+s,oy,top);const ap=iso(ox+s/2,oy+s/2,top+.9);poly([a,b,ap],'#d98a6a');poly([b,c,ap],'#c0705a')}
  emo('🐱',ox+s/2,oy+s/2,top+(A.has('attic')?2:A.has('floor2')?.5:1.2),14);
  /* 小摆件数量提示 */
  S.areas.forEach(k=>{const P2=pos[k];if(P2)lab(W_AREAS[k].n,P2[0]+P2[2]/2,P2[1]+P2[3]/2,0)});  const nDec=Object.keys(S.decor).length;{const [px,py0]=iso(ox+s/2,oy+s/2,top+(A.has('attic')?2.6:A.has('floor2')?1.3:2));const py=Math.max(6,py0-14);g.font='600 15px sans-serif';g.textAlign='center';g.textBaseline='top';const t=['我的小家',...['floor2','roof','attic'].filter(k=>A.has(k)).map(k=>W_AREAS[k].n),nDec?`摆件 ${nDec}`:''].filter(Boolean).join(' · ');const w=g.measureText(t).width+12;g.fillStyle='rgba(255,255,255,.92)';g.fillRect(px-w/2,py,w,21);g.fillStyle='#3d6b57';g.fillText(t,px,py+3)}
  if(!(D.world.log||[]).length){g.font='600 16px sans-serif';g.textAlign='center';g.textBaseline='alphabetic';g.fillStyle='#6a7a75';g.fillText('还没有相遇，世界还是原来的样子',W/2,H-18)}}
/* ---------- 社交主页：附近 / 好友 / 礼物 / 图鉴 / 设置 ---------- */
let hubTab='near',fx=null;
const hov=document.createElement('div');hov.id='sc-hub';hov.className='sc-ov';hov.setAttribute('role','dialog');hov.setAttribute('aria-modal','true');hov.setAttribute('aria-label','遇见与图鉴');
hov.innerHTML=`<div class="sc-box"><header class="lf-head"><div><b>遇见</b><small id="sc-hsub"></small></div><span class="lf-mode" id="sc-hmode"></span><button type="button" class="lf-x" data-hclose aria-label="关闭">×</button></header>
<nav class="lf-tabs" role="tablist">${[['near','附近'],['friends','好友'],['gifts','礼物'],['world','世界'],['dex','图鉴'],['settings','设置']].map(([k,n])=>`<button type="button" role="tab" data-htab="${k}">${n}<i class="sc-dot" data-dot-for="${k}"></i></button>`).join('')}</nav>
<div class="lf-body" id="sc-hbody"></div></div>`;
document.body.appendChild(hov);
function openHub(t){if(t==='nearby')t='near';if(t&&!['near','friends','gifts','world','dex','settings'].includes(t))t='near';hubTab=t||hubTab;hov.classList.add('on');renderHub();track(hubTab==='world'?'world_open':t==='dex'?'dex_open':'social_hub_open',{tab:hubTab})}
function closeHub(){hov.classList.remove('on')}
hov.addEventListener('click',e=>{if(e.target===hov||e.target.closest('[data-hclose]'))closeHub();const t=e.target.closest('[data-htab]');if(t){hubTab=t.dataset.htab;renderHub();track(hubTab==='world'?'world_open':hubTab==='dex'?'dex_open':'social_tab',{tab:hubTab})}});
addEventListener('keydown',e=>{if(e.key==='Escape'&&hov.classList.contains('on')&&!M)closeHub()});
function badgeDots(){const un=D.gifts.inbox.filter(x=>!x.open).length;hov.querySelectorAll('[data-dot-for]').forEach(i=>i.classList.toggle('on',(i.dataset.dotFor==='gifts'&&un>0)||(i.dataset.dotFor==='world'&&D.world.unseen>0)));document.querySelectorAll('[data-social="near"]').forEach(b=>b.classList.toggle('sc-has',un>0||[...peers.values()].some(p=>p.dist<=3)))}
function renderHub(){badgeDots();if(!hov.classList.contains('on'))return;const b=$('sc-hbody');if(!b)return;
  hov.querySelectorAll('[data-htab]').forEach(x=>x.setAttribute('aria-selected',String(x.dataset.htab===hubTab)));
  $('sc-hsub').textContent=`${Object.keys(D.friends).length} 位朋友 · 今日遇见 ${today().meets} 次`;$('sc-hmode').textContent=D.cfg.discover?'游戏角色开启':'游戏角色关闭';$('sc-hmode').className='lf-mode'+(D.cfg.discover?'':' demo');
  b.innerHTML=hubTab==='near'?near():hubTab==='friends'?friends():hubTab==='gifts'?gifts():hubTab==='dex'?dex():hubTab==='world'?worldHtml():settings();
  if(hubTab==='near')renderNearbyLive();if(hubTab==='world'){drawWorldMap();if(D.world.unseen){D.world.unseen=0;saveD();badgeDots()}}}
function near(){const d=today();const me=P();
  return nativeEncounterHelp()+`<details><summary>游戏角色互动（不是真实吧唧相遇）</summary><section class="sc-hero"><div class="sc-radar" id="sc-radar"></div><div class="sc-nearside"><p class="lf-note">以下是游戏角色互动，不表示附近存在真实设备，不计入真实相遇世界成长。</p>
  <div class="lf-row"><button type="button" class="g-btn" data-h="spawn">🔍 找找附近的小猫</button></div>
  
  <p class="sc-small">今日遇见提醒 ${d.alerts} / ${D.cfg.alertCap} · ${D.cfg.discover?(D.cfg.scope==='spots'?'只在外出 / 据点时可被发现':'随处可被发现'):'已隐身，不会被发现也不会提醒'}</p></div></section>
  <section class="lf-sec"><h4>附近的小猫 <small>按信号强弱估算距离</small></h4><div id="sc-plist" class="sc-plist"></div></section>
  ${echoes()}</details>`}
function renderNearbyLive(){const rd=$('sc-radar'),pl=$('sc-plist');if(!rd||!pl||!hov.classList.contains('on')||hubTab!=='near')return;const list=[...peers.values()].filter(p=>!D.blocked[p.fid]).sort((a,b)=>a.dist-b.dist);
  const R=v=>Math.min(1,Math.log10(1+v)/Math.log10(31))*92;let s=`<svg viewBox="0 0 200 200" class="sc-rsvg"><circle cx="100" cy="100" r="${R(1)}" class="r1"/><circle cx="100" cy="100" r="${R(3)}" class="r3"/><circle cx="100" cy="100" r="${R(10)}"/><circle cx="100" cy="100" r="92"/><text x="100" y="${100-R(3)-3}" text-anchor="middle">3 米</text><text x="100" y="${100-R(10)-3}" text-anchor="middle">10 米</text><circle cx="100" cy="100" r="5" class="me"/></svg>`;
  list.forEach(p=>{const a=(hash(p.fid)%360)*Math.PI/180,r=R(p.dist);s+=`<span class="sc-rp${p.dist<=3?' near':''}" style="left:${50+Math.cos(a)*r/2}%;top:${50+Math.sin(a)*r/2}%">${petImg(p.breed,p.outfit,2)}</span>`});
  rd.innerHTML=s+`<span class="sc-rme">${me()}</span>`;
  pl.innerHTML=list.length?list.map(p=>{const f=D.friends[p.fid];return `<article class="sc-peer${p.dist<=3?' near':''}">${petImg(p.breed,p.outfit,3)}<div><b>${f?`老朋友「${esc(f.petName)}」`:`${esc(BN(p.breed))}「${esc(p.petName)}」`}</b><small>${p.src==='npc'?'官方小猫':p.src==='air'?'附近的玩家':'遇见码'} · 匿名主人 · 约 ${p.dist.toFixed(1)} 米</small></div><button type="button" class="g-btn" data-meet="${esc(p.fid)}" ${p.dist<=3?'':'disabled'}>${p.dist<=3?'遇见':'再靠近点'}</button></article>`}).join(''):'<p class="lf-empty">附近暂时没有小猫。点「找找附近的小猫」等官方小猫路过，。</p>'}
function me(){const p=P();return p?petImg(p.breed,p.outfit,2):''}
/* 异步遇见：在地点留下足迹 / 回声，后来的人可以捡到 */
const EKEY='pg-air-echo';
function placeNow(){const sg=L.segAt(L.day(),L.nowMin());const p=sg.place&&L.place(sg.place);return {id:p?.name||'这附近',name:p?.name||'这附近'}}
function echoList(){const pl=placeNow();const all=load(EKEY,[]).filter(e=>Date.now()-e.at<DAY);const npc=NPCS.slice(0,2).map((n,i)=>({id:'npc-echo-'+dk(new Date())+i,owner:n.fid,pet:n.petName,breed:n.breed,outfit:n.outfit,place:pl.id,msg:i?'这里的阳光好舒服，留下一根小鱼干给后来的你':'来过这里！今天也要开心喵',at:Date.now()-(i+1)*37*6e4}));
  return [...all.filter(e=>e.owner!==D.me.id&&e.place===pl.id),...npc].filter(e=>!(D.picked||[]).includes(e.id))}
function echoes(){const pl=placeNow(),list=echoList();
  return `<section class="lf-sec"><h4>足迹 · 异步遇见 <small>在「${esc(pl.name)}」</small></h4><div class="sc-echo">${list.map(e=>`<article>${petImg(e.breed,e.outfit,2)}<div><b>${esc(e.pet)}的足迹</b><small>${ago(e.at)} · “${esc(e.msg)}”</small></div><button type="button" class="g-btn ghost" data-pick="${esc(e.id)}">捡起来</button></article>`).join('')||'<p class="lf-empty">这里还没有别人的足迹。</p>'}</div>
  <div class="lf-row"><button type="button" class="g-btn ghost" data-h="echo">🐾 在这里留下${esc(petName())}的足迹</button></div></section>`}
function leaveEcho(){const pl=placeNow(),p=P();const all=load(EKEY,[]).filter(e=>Date.now()-e.at<DAY&&!(e.owner===D.me.id&&e.place===pl.id));all.push({id:'e'+uid(),owner:D.me.id,pet:p.name,breed:p.breed,outfit:p.outfit,place:pl.id,msg:pick(['来过这里！今天也要开心喵','留下一个小爪印','这里有好闻的味道']),at:Date.now()});save(EKEY,all.slice(-100));toast('足迹留下啦，后来的人会捡到');track('echo_leave',{});renderHub()}
function pickEcho(id){const e=echoList().find(x=>x.id===id);if(!e)return;D.picked=[...(D.picked||[]),id].slice(-200);D.seen[e.breed]=D.seen[e.breed]||Date.now();saveD();ST().socialGrant({coins:2,mood:2,journal:{kind:'social',msg:`在「${placeNow().name}」捡到了${e.pet}留下的足迹。`}});toast(`捡到「${e.pet}」的足迹：喵币 +2`);track('echo_pick',{npc:e.owner.startsWith('npc')});renderHub()}
function friends(){const list=Object.values(D.friends).sort((a,b)=>b.lastAt-a.lastAt);if(!list.length)return '<p class="lf-empty">还没有朋友。去「附近」遇见一只小猫吧。</p>';
  return `<section class="lf-sec"><h4>好友 <small>新朋友收益更高；老朋友另有亲密度成长线（互访、共同任务）</small></h4><div class="sc-flist">${list.map(f=>{const l=lvl(f),open=fx===f.fid,wk=f.co?.[weekKey()]||0;const egg=eggCheck(f);
    return `<article class="sc-friend${open?' open':''}"><button type="button" class="sc-fhead" data-fx="${esc(f.fid)}">${petImg(f.breed,f.outfit,3)}<div><b>${esc(f.petName)} <small>${esc(BN(f.breed))} · ${f.src==='native_device'?'性别未交换':f.sex==='male'?'小男生':'小女生'}${f.stage==='adult'?' · 成年':''}</small></b><span class="sc-bar"><i style="width:${l.k*100}%"></i></span><small>好友 Lv${l.lv} · ${l.p} 点 · 老友亲密 Lv${bondLv(f)}（${f.bond||0}）· 上次见面 ${ago(f.lastAt)}</small></div><span class="sc-ficons">${f.rhythm?'🥁':''}${f.seal?'💮':''}${D.dex.fate.some(x=>x.fid===f.fid)?'✨':''}${f.contact?.theirs?'📇':''}</span></button>
    ${open?`<div class="sc-fbody">
      <p>${f.src==='npc'?'游戏角色':f.src==='native_device'?'真实吧唧 · 主人匿名':'历史原型记录'} · 性格：${f.persona?ptag(f.persona):'还不了解'} · 技能：${(f.skills||[]).map(s=>SKILLS[s]?SKILLS[s].i+SKILLS[s].n:'').join(' ')||'暂无'}</p>
      <p>本周共同任务：见面 ${Math.min(2,wk)} / 2 天${wk>=2?' ✅':''}${f.rhythm?` · 友谊暗号 ${rhythmGlyph(f.rhythm)}`:''}${f.seal?` · 印章 ${sealSvg(f.seal,26)}`:''}</p>
      <div class="lf-row"><button type="button" class="g-btn" data-egg="${esc(f.fid)}" ${egg?'disabled':''}>🥚 约一颗蛋</button><span class="sc-small">${esc(egg||'条件满足：两边家里各孵一只，后代可能出现稀有外观')}</span></div>
      ${P()?.family?.pair?.remote?.fid===f.fid?`<div class="lf-row"><span class="sc-small">联机蛋孵化进度 ${Math.round((P().family.pair.progress||0)*100)}%（照顾 3 次 + 陪伴 60 秒）</span>${P().family.pair.ready?'<button type="button" class="g-btn" data-claim>🐣 孵化！</button>':''}</div>`:''}
      <div class="lf-row"><button type="button" class="g-btn ghost" data-contact="${esc(f.fid)}" ${f.src==='native_device'||L.cfg.minor||f.contact?.theirs?'disabled':''}>📇 ${f.contact?.theirs?'已交换联系方式':f.contact?.mine?'等待对方同意':'申请交换联系方式'}</button>${f.contact?.theirs?`<span class="sc-small">${esc(f.contact.info)}</span>`:L.cfg.minor?'<span class="sc-small">未满 14 周岁不开放</span>':'<span class="sc-small">双方都同意才可见，真人信息后置</span>'}</div>
      <div class="lf-row"><label class="sc-small">定向交换图鉴：想要它的 <select data-want="${esc(f.fid)}"><option value="">让宠物自己决定</option>${(f.cards||NPCS.find(n=>n.fid===f.fid)&&['breed:'+f.breed,'region:'+f.region]||[]).map(c=>`<option value="${esc(c)}" ${f.want===c?'selected':''}>${esc(cardName(c))}</option>`).join('')}</select></label></div>
      <div class="lf-row">${Date.now()-f.firstAt<DAY?`<button type="button" class="g-btn ghost" data-unf="${esc(f.fid)}">解除好友（24 小时内）</button>`:''}<button type="button" class="g-btn ghost" data-block="${esc(f.fid)}">拉黑</button><button type="button" class="g-btn ghost" data-report="${esc(f.fid)}">举报</button></div>
    </div>`:''}</article>`}).join('')}</div></section>
  <section class="lf-sec"><h4>社交手记</h4><ol class="lf-list">${D.log.slice(0,10).map(l=>`<li><time>${ago(l.t)}</time><span>${l.icon}</span><p>${esc(l.msg)}</p></li>`).join('')||'<li class="lf-empty">还没有记录</li>'}</ol></section>`}
function gifts(){const p=P(),inbox=D.gifts.inbox.filter(x=>!x.open),inv=p?.inventory||{};const fl=Object.values(D.friends).filter(f=>f.src!=='native_device');
  return `<section class="lf-sec"><h4>朋友带来的礼物 <small>礼物由对方的小猫见面时“带过来”，盲盒里装什么由它自己决定 · 擦身遇见是小礼物，Fate 缘分擦肩是大礼物（馈赠限定）</small></h4><div class="sc-gifts">${inbox.map(x=>`<article class="sc-gift${x.g.big?' big':''}"><span class="sc-box3">${x.g.big?'🎀':'🎁'}</span><div><b>「${esc(x.fname)}」带来的${x.g.big?'大礼物':'小礼物'}</b><small>${ago(x.at)}</small></div><button type="button" class="g-btn" data-open="${x.id}">拆开</button></article>`).join('')||'<p class="lf-empty">还没有待拆的礼物。</p>'}</div><div id="sc-openmsg" class="sc-openmsg" hidden></div></section>
  <section class="lf-sec"><h4>给游戏角色准备礼物 <small>交给${esc(petName())}，下次见面时由它带过去 · 给予者也有奖励</small></h4>
  <div class="sc-prep"><select id="sc-pitem">${Object.entries(ITEMS).map(([k,v])=>`<option value="${k}" ${(inv[k]||0)<1?'disabled':''}>${v.i}${v.n}（有 ${inv[k]||0}）</option>`).join('')}</select><select id="sc-pn">${[1,2,3].map(n=>`<option>${n}</option>`).join('')}</select><select id="sc-pto"><option value="">下一个遇见的朋友</option>${fl.map(f=>`<option value="${esc(f.fid)}">${esc(f.petName)}</option>`).join('')}</select><button type="button" class="g-btn" data-prep>交给${esc(petName())}</button></div>
  ${D.gifts.prepared.length?`<p class="sc-small">${esc(petName())}正带着：${D.gifts.prepared.map(x=>`${x.gift.label} → ${x.to?esc(D.friends[x.to]?.petName||'朋友'):'下一个朋友'}`).join('；')}</p>`:''}
  <div class="sc-gen"><div><b>${D.gifts.gen}</b><small>慷慨值</small></div><div><b>${esc(title())}</b><small>赠礼称号</small></div><div><b>${D.gifts.given}</b><small>送出礼物</small></div><div><b>${D.gifts.crit}</b><small>回礼暴击</small></div></div></section>
  <section class="lf-sec"><h4>馈赠限定家具 <small>商店买不到，只在 Fate 缘分擦肩的大礼物里出现；摆进小家后在 3D 房间里可见</small></h4><div class="sc-furn">${Object.entries(FURN).map(([k,v])=>`<article class="${D.furn.owned[k]?'':'lock'}"><span>${D.furn.owned[k]?v.i:'？'}</span><b>${D.furn.owned[k]?v.n:'未获得'}</b><small>${D.furn.owned[k]?v.d:'缘分擦肩的大礼物里可能出现'}</small>${D.furn.owned[k]?`<label class="sc-small"><input type="checkbox" data-place="${k}" ${D.furn.placed[k]?'checked':''}> 摆在小家</label>`:''}</article>`).join('')}</div></section>
  <section class="lf-sec"><h4>礼物记录</h4><ol class="lf-list">${D.gifts.log.slice(0,10).map(l=>`<li><time>${ago(l.t)}</time><span>${l.dir==='in'?'📥':'📤'}</span><p>${l.dir==='in'?'收到':'送给'}「${esc(l.who)}」：${esc(l.label)}</p></li>`).join('')||'<li class="lf-empty">还没有记录</li>'}</ol></section>`}
function dex(){const p=P();if(!p)return '';const br=BREEDS(),cats=p.cats||[],grads=p.graduates||[];
  const owned=new Set([...cats.map(c=>c.breed),...grads.map(g=>g.breed).filter(Boolean)]);
  const stamps=(p.goals||[]).filter(g=>g.claimed||g.completed);const qb=L.quirk?.book||{},ql=L.quirk?.list||[];
  const events=[...stamps.map(g=>({i:'🏅',n:g.title,d:'愿望印章'})),...cats.flatMap(c=>{const out=[{i:'🐣',n:`${c.name}来到家里`,d:c.lineage?'联机后代':'家庭成员'}];if(c.stage==='adult')out.push({i:'🌱',n:`${c.name}长大成年`,d:'成长阶段'});const days=c.joinedAt?Math.floor((Date.now()-c.joinedAt)/DAY):0;if(days>=7)out.push({i:'🎂',n:`${c.name}陪伴 ${days>=30?'30':'7'} 天`,d:'纪念日'});return out}),...Object.values(D.dex.firsts).map(x=>({i:'⭐',n:x.label,d:'第一次'}))];
  const cards=Object.entries(D.dex.cards);const kids=cats.filter(c=>c.lineage);const regs=Object.entries(D.dex.regions);
  const total=br.length+ql.length+Object.keys(REGIONS).length+4,got=[...owned].length+Object.keys(qb).length+regs.filter(([k])=>REGIONS[k]).length+Object.keys(D.furn.owned).length;
  return `<section class="lf-sec"><h4>图鉴 <small>收集进度 ${got} / ${total} · 养成、社交、生蛋、毕业都会写进来</small></h4><div class="sc-prog"><i style="width:${Math.min(100,got/total*100)}%"></i></div></section>
  <section class="lf-sec"><h4>品种 <small>${[...owned].length} / ${br.length} 已拥有 · ${br.filter(b=>!owned.has(b.id)&&D.seen[b.id]).length} 种见过</small></h4><div class="sc-dexg">${br.map(b=>{const o=owned.has(b.id),s=D.seen[b.id];return `<article class="${o?'':s?'seen':'lock'}">${o||s?petImg(b.id,'none',3):'<span class="q">？</span>'}<b>${o||s||!b.rare?esc(b.name):'？？？'}</b><small>${o?'已拥有':s?'在遇见 / 交换中见过':b.rare?'联机生蛋限定':'未拥有'}${b.rare?' · 稀有':''}</small></article>`}).join('')}</div></section>
  ${window.CatOfflineDeviceEvents?.dexHtml?.(D)||""}
  <section class="lf-sec"><h4>养成事件 <small>不社交也有的收集进度</small></h4><div class="sc-ev">${events.map(e=>`<span>${e.i} <b>${esc(e.n)}</b><small>${esc(e.d)}</small></span>`).join('')||'<p class="lf-empty">照顾小猫、领取愿望印章会解锁</p>'}</div></section>
  <section class="lf-sec"><h4>怪行为 <small>${Object.keys(qb).length} / ${ql.length}</small></h4><div class="sc-ev">${ql.map(q=>`<span class="${qb[q.id]?'':'lock'}">${qb[q.id]?q.icon:'？'} <b>${qb[q.id]?esc(q.name):'未发现'}</b></span>`).join('')}</div></section>
  <section class="lf-sec"><h4>交换卡 <small>遇见时双方各出一张非锁定卡；锁定的卡不会被拿去交换</small></h4><div class="sc-cards">${giveableCards().concat(Object.keys(D.dex.locked)).filter((c,i,a)=>a.indexOf(c)===i).map(c=>{const r=D.dex.cards[c];return `<article><span>${cardIcon(c)}</span><b>${esc(cardName(c))}</b><small>${r?`来自「${esc(r.from)}」${r.n>1?' ×'+r.n:''}`:'自己的'}</small><label class="sc-small"><input type="checkbox" data-lock="${esc(c)}" ${D.dex.locked[c]?'checked':''}> 锁定</label></article>`}).join('')}</div></section>
  <section class="lf-sec"><h4>联机后代 <small>稀有外观只出现在联机生蛋后代里</small></h4><div class="sc-ev">${kids.map(c=>`<span>${petImg(c.breed,'none',2)} <b>${esc(c.name)}</b><small>${esc(c.lineage.parentName)} × 「${esc(c.lineage.partnerName)}」${c.lineage.rare?' · 稀有 '+esc(BN(c.breed)):''}</small></span>`).join('')||'<p class="lf-empty">和好友约一颗蛋，孵出来的幼猫会记在这里</p>'}</div></section>
  <section class="lf-sec"><h4>友谊印章 · 友谊暗号 · 缘分 <small>${D.dex.seals.length} 枚印章 · ${D.dex.rhythms.length} 段暗号 · ${D.dex.fate.length} 次缘分</small></h4><div class="sc-ev">${D.dex.seals.map(s=>`<span>${sealSvg(s.seq,30)} <b>${esc(D.friends[s.fid]?.petName||'朋友')}</b><small>${s.egg==='heart'?'爱心彩蛋':s.egg==='star'?'星星彩蛋':'友谊印章'}</small></span>`).join('')}${D.dex.rhythms.map(r=>`<span>🥁 <b>${esc(D.friends[r.fid]?.petName||'朋友')}</b><small>${rhythmGlyph(r.r)}</small></span>`).join('')}${D.dex.fate.map(x=>`<span>✨ <b>${esc(x.name)}</b><small>${x.source==='native_device'?'真实缘分擦肩':'历史原型记录 · 非真实吧唧擦肩'}</small></span>`).join('')||''}</div></section>
  <section class="lf-sec"><h4>社团 / 地域 <small>跨据点连接才能拿到对方的特产</small></h4><div class="sc-ev">${Object.entries(REGIONS).map(([k,r])=>{const g=D.dex.regions[k];return `<span class="${g?'':'lock'}">${g?r.i:'？'} <b>${g?esc(r.sp):'未获得'}</b><small>${esc(r.n)}${g?' · 来自「'+esc(g.from)+'」':''}</small></span>`}).join('')}${regs.filter(([k])=>!REGIONS[k]).map(([k,r])=>`<span>${r.i||'🏷️'} <b>${esc(r.sp)}</b><small>${esc(r.n)} · 来自「${esc(r.from)}」</small></span>`).join('')}</div></section>
  <section class="lf-sec"><h4>毕业谱系 <small>毕业的猫咪写进图鉴，成为世代谱系</small></h4><div class="sc-line">${grads.map(g=>`<span>${petImg(g.breed||'orange','none',2)}<b>${esc(g.name||'')}</b><small>第 ${g.generation||1} 代${g.heirName?' → '+esc(g.heirName):''}</small></span>`).join('<i>→</i>')||'<p class="lf-empty">还没有猫咪毕业。成年满 7 天后可以举行毕业仪式。</p>'}${grads.length?`<i>→</i><span>${petImg(p.breed,p.outfit,2)}<b>${esc(p.name)}</b><small>现在</small></span>`:''}</div></section>
  <section class="lf-sec"><h4>${esc(petName())}的性格 <small>孵化时随机，在相处、遇见、收礼中慢慢变化</small></h4><div class="sc-persona">${DIMS.map(([k,a,b])=>`<div><small>${b}</small><span><i style="left:${persona()[k]}%"></i></span><small>${a}</small></div>`).join('')}</div><p class="sc-small">技能：${ownSkills().map(s=>SKILLS[s].i+SKILLS[s].n).join(' ')||'还没有（'+Object.values(SKILLS).map(s=>s.n+'：'+s.d).join('；')+'）'}</p></section>`}
function settings(){const c=D.cfg,sel=(k,opts)=>`<select data-scfg="${k}">${opts.map(([v,n])=>`<option value="${v}" ${String(c[k])===String(v)?'selected':''}>${n}</option>`).join('')}</select>`;
  const tg=(k,t,d,dis)=>`<label class="lf-tg ${dis?'dis':''}"><input type="checkbox" data-scfg="${k}" ${c[k]?'checked':''} ${dis?'disabled':''}><span class="sw"></span><div><b>${t}</b><small>${d}</small></div></label>`;
  return `<section class="lf-sec"><h4>遇见设置</h4>
  ${tg('discover','游戏角色来访','只控制下方游戏角色互动；真实吧唧仅在主人主动进入对暗号时发现和配对')}
  <label class="lf-sel">游戏角色出现范围 ${sel('scope',[['any','随处'],['spots','只在外出 / 据点时（地理围栏）']])}</label>
  <label class="lf-sel">每天遇见提醒上限 ${sel('alertCap',[[3,'3 次'],[6,'6 次'],[10,'10 次']])}</label>
  ${tg('tone','游戏角色提示音','手机游戏角色来访时提示，不配置吧唧音频')}${tg('vib','手机提示振动','仅手机支持时生效，不表示吧唧有马达')}
  <label class="lf-tg dis"><input type="checkbox" disabled><span class="sw"></span><div><b>缘分擦肩（独立开关 · 关闭）</b><small>默认关闭；需吧唧后台感知同步走过的晃动，不是当面连接后晃一晃。采集授权、广播对时和独立功耗确认前不开放。</small></div></label><p class="sc-small">敲暗号：固件间隔误差初值15%，总时长差30%；手机设置不改变吧唧阈值。</p>
  
  
  <label class="lf-sel">小猫主动说话 ${sel('voice',[[0,'关闭'],[1,'偶尔（默认）'],[2,'经常']])}</label>
  <label class="lf-sel">我的社团 / 据点 <input data-scfg="club" maxlength="12" placeholder="例如：动漫社" value="${esc(c.club||'')}"></label>
  <label class="lf-sel">愿意交换的联系方式 <input data-scfg="contact" maxlength="40" placeholder="${L.cfg.minor?'未满 14 周岁不开放':'例如：微信 xxx（双方同意后才可见）'}" value="${esc(c.contact||'')}" ${L.cfg.minor?'disabled':''}></label>
  <p class="lf-note">安全：默认匿名、模糊定位；联系方式双方同意才解锁；成为朋友后 24 小时内可解除；支持拉黑与举报。未满 14 周岁的设置在「今日生活 → 授权与隐私」。</p></section>
  <section class="lf-sec"><h4>黑名单 <small>${Object.keys(D.blocked).length} 个</small></h4>${Object.entries(D.blocked).map(([k,v])=>`<div class="lf-row"><span>${esc(v.name||k)}</span><button type="button" class="g-btn ghost" data-unblock="${esc(k)}">移出</button></div>`).join('')||'<p class="lf-empty">没有拉黑任何人</p>'}</section>
  <section class="lf-sec"><div class="lf-row"><button type="button" class="g-btn ghost" data-h="wipe">清除全部社交数据</button></div><p class="sc-small">我的匿名 ID：${esc(D.me.id)}${window.__pgSlot?` · 当前是玩家 ${esc(window.__pgSlot)} 的存档`:''}</p></section>`}
hov.addEventListener('click',async e=>{if(worldEditClick(e))return;const t=e.target;const h=t.closest('[data-h]')?.dataset.h;if(t.closest('[data-native-device]')){closeHub();window.CatOfflineHost?.openDevice();return;}
  if(h==='wroom'){closeHub();document.querySelector('[data-view="home"]')?.click()}
  if(h==='spawn'){const n=spawnNpc();toast(n?`「${n.petName}」正在走过来…`:'官方小猫都在忙');}
  if(h==='code'){peers.set('?code',{fid:'?code',petName:'对方',breed:'orange',outfit:'none',src:'code',dist:1});closeHub();openMeet('?code','qr')}
  if(h==='slotb'){const u=new URL(location.href);u.searchParams.set('slot',window.__pgSlot==='B'?'A':'B');u.hash='';if(!window.__pgSlot){toast('提示：当前窗口用的是默认存档，相当于玩家 A');}window.open(u.toString(),'_blank');track('social_dual',{})}
  if(h==='echo')leaveEcho();
  if(h==='wipe'){if(!confirm('清除好友、礼物、图鉴里的社交记录？游戏存档不受影响。'))return;localStorage.removeItem(KEY);location.reload()}
  const pk=t.closest('[data-pick]');if(pk)pickEcho(pk.dataset.pick);
  const m=t.closest('[data-meet]');if(m){closeHub();openMeet(m.dataset.meet)}
  const f=t.closest('[data-fx]');if(f){fx=fx===f.dataset.fx?null:f.dataset.fx;renderHub()}
  const eg=t.closest('[data-egg]');if(eg)askEgg(eg.dataset.egg);
  if(t.closest('[data-claim]'))claimEgg();
  const ct=t.closest('[data-contact]');if(ct)askContact(ct.dataset.contact);
  const un=t.closest('[data-unf]');if(un){const fr=D.friends[un.dataset.unf];if(fr&&confirm(`解除和「${fr.petName}」的好友关系？友谊暗号和印章会一起删除。`)){delete D.friends[un.dataset.unf];D.dex.rhythms=D.dex.rhythms.filter(x=>x.fid!==fr.fid);D.dex.seals=D.dex.seals.filter(x=>x.fid!==fr.fid);saveD();send('unfriend',{to:fr.fid});track('social_unfriend',{});renderHub()}}
  const bl=t.closest('[data-block]');if(bl){const fr=D.friends[bl.dataset.block];if(fr&&confirm(`拉黑「${fr.petName}」？之后不会再遇见它，也不会收到它的消息。`)){D.blocked[fr.fid]={name:fr.petName,at:Date.now()};delete D.friends[fr.fid];peers.delete(fr.fid);saveD();track('social_block',{});renderHub()}}
  const rp=t.closest('[data-report]');if(rp){const fr=D.friends[rp.dataset.report];const why=prompt('举报原因（例如：骚扰、冒充、不当内容）','');if(why!=null){D.reports.push({fid:fr?.fid,why:why.slice(0,60),at:Date.now()});saveD();toast('已提交举报，正式版由安全团队 24 小时内处理（原型仅本机记录）');track('social_report',{})}}
  const ub=t.closest('[data-unblock]');if(ub){delete D.blocked[ub.dataset.unblock];saveD();renderHub()}
  const op=t.closest('[data-open]');if(op){const box=op.closest('.sc-gift');box?.classList.add('opening');setTimeout(()=>{const msg=openGift(op.dataset.open);renderHub();const mm=$('sc-openmsg');if(mm&&msg){mm.hidden=false;mm.innerHTML=`<span>🎉</span>${esc(msg)}`}},700)}
  if(t.closest('[data-prep]'))prepareGift($('sc-pitem').value,+$('sc-pn').value,$('sc-pto').value||null);
});
hov.addEventListener('change',e=>{if(worldEditChange(e))return;const t=e.target;const k=t.dataset.scfg;if(k){D.cfg[k]=t.type==='checkbox'?t.checked:['alertCap','tol','dur','voice'].includes(k)?+t.value:t.value.trim();saveD();track('social_cfg',{k,v:t.type==='checkbox'?t.checked:k==='contact'||k==='club'?!!t.value:t.value});if(t.type!=='text'&&t.tagName!=='INPUT'||t.type==='checkbox')renderHub();return}
  const lk=t.dataset.lock;if(lk){if(t.checked)D.dex.locked[lk]=Date.now();else delete D.dex.locked[lk];saveD();track('dex_lock',{on:t.checked})}
  const w=t.dataset.want;if(w){D.friends[w].want=t.value||null;saveD();toast(t.value?'下次见面时会请它带这张卡':'交给宠物自己决定');track('dex_card_want',{})}
  const pl=t.dataset.place;if(pl){D.furn.placed[pl]=t.checked;saveD();placeFurniture();track('furniture_place',{id:pl,on:t.checked})}});
/* ---------- 入口：移动端右侧栏 + 桌面导航 ---------- */
const rail=$('m-rail');
if(rail){[['dex','▦','图鉴'],['near','◎','遇见']].forEach(([k,i,n])=>{const b=document.createElement('button');b.type='button';b.dataset.social=k;b.innerHTML=`<span aria-hidden="true">${i}</span>${n}`;rail.prepend(b);b.addEventListener('click',()=>openHub(k))})}
const nav=document.querySelector('.town-nav');
if(nav){[['near','◎','遇见'],['dex','▦','图鉴']].forEach(([k,i,n])=>{const b=document.createElement('button');b.type='button';b.className='pg-navsocial';b.dataset.social=k;b.innerHTML=`<span class="nav-symbol" aria-hidden="true">${i}</span>${n}`;nav.insertBefore(b,nav.querySelector('.town-edition'));b.addEventListener('click',()=>openHub(k))})}
/* ---------- 馈赠限定家具：摆进 3D 小家 ---------- */
const FPOS={lamp:[-21,0,20],plant:[-4.5,0,20.5],scratch:[-3,0,8],yarn:[7,0,-6]};
let furnG=null;
function placeFurniture(){const r=window.__pgRoom;if(!r?.scene)return false;let Mesh,Box,Mat,Grp;r.scene.traverse(o=>{if(!Mesh&&o.isMesh&&o.geometry?.type==='BoxGeometry'&&o.material&&!Array.isArray(o.material)&&o.material.type==='MeshStandardMaterial'){Mesh=o.constructor;Box=o.geometry.constructor;Mat=o.material.constructor}if(!Grp&&o.type==='Group')Grp=o.constructor});
  if(!Mesh||!Box)return false;Grp=Grp||r.scene.constructor.prototype.constructor;
  if(!furnG){furnG=new (Grp||Mesh)();furnG.name='pg-furniture';r.scene.add(furnG)}
  while(furnG.children.length){const c=furnG.children.pop();c.traverse?.(x=>{x.geometry?.dispose();x.material?.dispose?.()})}
  const cube=(g,w,h,d,x,y,z,col,em)=>{const m=new Mesh(new Box(w,h,d),new Mat({color:col,roughness:1,flatShading:true,...(em?{emissive:em,emissiveIntensity:.8}:{})}));m.position.set(x,y+h/2,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m};
  const S=2.1;
  Object.keys(FURN).forEach(k=>{if(!D.furn.owned[k]||!D.furn.placed[k])return;const g=new Grp();g.name='furn:'+k;const [x,y,z]=FPOS[k];g.position.set(x,y,z);g.scale.setScalar(S);furnG.add(g);
    if(k==='lamp'){cube(g,1.4,.3,1.4,0,0,0,0x6b5a4a);cube(g,.3,2.6,.3,0,.3,0,0x8a7560);cube(g,1.6,1.2,1.6,0,2.9,0,0xffe7a0,0xffc84a)}
    if(k==='plant'){cube(g,1.6,1.4,1.6,0,0,0,0xc9784f);cube(g,1.7,.25,1.7,0,1.4,0,0xb56a44);cube(g,.9,1.1,.9,0,1.6,0,0x6fae5c);cube(g,.6,.8,.6,.5,2.4,.2,0x86c27e);cube(g,.6,.7,.6,-.45,2.3,-.3,0x5f9c50)}
    if(k==='scratch'){cube(g,3.2,.3,1.6,0,0,0,0x8a6a4a);cube(g,2.8,.5,1.2,0,.3,0,0xd6b88c);cube(g,.4,.4,.4,1.1,.8,0,0xe8907a)}
    if(k==='yarn'){cube(g,2.2,1,1.6,0,0,0,0xb8925f);cube(g,.8,.8,.8,-.5,1,0,0xe8907a);cube(g,.8,.8,.8,.45,1,.2,0x9bb8cc);cube(g,.7,.7,.7,0,1.5,-.2,0xf0bf73)}});
  return true}
/* ---------- 性格 · 主动表达（带护栏：羡慕每天最多 1 次、可关闭、不出现在购买入口前后） ---------- */
document.addEventListener('click',e=>{if(e.target.closest('[data-outfit],[data-breed],#outfit-list,#breed-list,.shop,[data-sell]'))D.lastShop=Date.now()},true);
function shopVisible(){return ['outfit-list','breed-list'].some(id=>{const el=$(id);if(!el)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden'&&el.offsetParent!==null})}
function say(){if(window.CatOfflineDurable?.transactionPaused)return;const lv=+D.cfg.voice;if(!lv||document.visibilityState!=='visible')return;if(hov.classList.contains('on')||M||document.querySelector('#life-ov.on'))return;if(document.body.dataset.view==='world')return;
  if(Math.random()>(lv===2?.7:.35))return;const p=P();if(!p||p.busy)return;const ps=persona(),d=today();const nm=p.name;const cand=[];
  const lastF=Object.values(D.friends).sort((a,b)=>b.lastAt-a.lastAt)[0];
  const shopNear=Date.now()-D.lastShop<3*6e4||shopVisible();
  if(lastF&&!shopNear&&d.envy<1&&Date.now()-lastF.lastAt<6*H&&lastF.outfit&&lastF.outfit!=='none'&&!p.wardrobe.includes(lastF.outfit)&&ON(lastF.outfit))cand.push(['envy','👀',`${lastF.petName}的${ON(lastF.outfit)}好好看，但是宝宝懂事，一点都不羡慕`]);
  if(D.lastFail&&Date.now()-D.lastFail<20*6e4)cand.push(['fail','🥁','刚才没对上暗号……下次我们先练练']);
  if(p.stats&&p.stats.mood<40)cand.push(['lonely','🥺','你是不是好久没摸我了']);
  if(ps.ext>=60)cand.push(['p','🌤️','想出门交新朋友！']);if(ps.curious>=60)cand.push(['p','🔍','今天会遇到什么样的猫呢？']);if(ps.greedy>=60)cand.push(['p','🐟','闻到小鱼干的味道了……']);if(ps.clingy>=60)cand.push(['p','💗',`${nm}要一直跟着你`]);if(ps.show>=60)cand.push(['p','✨','你看我今天的毛是不是特别亮']);
  if(ps.ext<=40)cand.push(['p','🫧','今天想安安静静待在家']);
  if(D.gifts.inbox.some(x=>!x.open))cand.push(['gift','🎁','有朋友带礼物来了，快拆开看看！']);
  if(!cand.length)return;const c=cand.find(x=>x[0]==='gift'||x[0]==='fail')||pick(cand);if(c[0]==='envy'){d.envy++;saveD()}
  try{L.quirk?.react(c[1],c[2])}catch(e){}track('persona_say',{kind:c[0]});if(c[0]==='fail')D.lastFail=0}
setInterval(say,75e3);
/* ---------- 启动 ---------- */
setInterval(tickPeers,2000);setTimeout(tickPeers,600);
setInterval(watchHatch,1500);
const tryPlace=()=>{if(!placeFurniture())setTimeout(tryPlace,1500);else try{buildWorld3D()}catch(e){console.warn(e)}};setTimeout(tryPlace,2500);
if(/^#meet=/.test(location.hash))history.replaceState(null,'',location.href.split('#')[0]);
window.__pgSocial={D,hostPlanDeviceEncounter,hostRefresh:renderHub,peers,NPCS,openHub,openMeet,closeMeet,completeMeet,useCode,myCode,parseCode,spawnNpc,judge,shapeEgg,lvl,placeFurniture,celebrate,worldState,worldApplied,worldGrow,buildWorld3D,drawWorldMap,rareRoll,eggCheck,openGift,prepareGift,persona,ownSkills,saveD,get M(){return M},onMinor(){renderHub()},drawPet};
})();
