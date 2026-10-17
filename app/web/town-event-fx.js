/* Original v5 courtyard rain/props/poses adapted to the existing town scene; no own RAF or rewards. */
window.CatTownEventFx={create({view,parent}){

const Wd=()=>view;
const L=window.__pgLife=window.__pgLife||{};
const track=(n,p)=>{try{window.__petAnalytics?.track(n,p)}catch(e){}};
const ease=t=>{t=t<0?0:t>1?1:t;return t*t*(3-2*t)};
const ev={type:null,t0:0,choice:null,tc:0,props:[],saved:null,bfFrom:null};
const scene=parent;
/* 2D 叠加层：雨丝 / 闪光 / 头顶图标 */
const cv=document.createElement('canvas');cv.className='town-world-fx';scene.appendChild(cv);
const g=cv.getContext('2d');
const emo=document.createElement('div');emo.className='town-world-emo';emo.hidden=true;scene.appendChild(emo);
let clock=0;function now(){return clock}
function V3(x,y,z){const C=Wd().cat.position.constructor;return new C(x,y,z)}
function fwd(){const y=Wd().cat.rotation.y;return V3(-Math.sin(y),0,-Math.cos(y))}
/* 方块小道具：借用户外场景已有网格的构造器 */
function boxSrc(){let s=null;Wd().scene.traverse(o=>{if(!s&&o.isMesh&&o.geometry?.type==='BoxGeometry'&&o.material?.color)s=o});return s}
function vox(parts){
  const w=Wd(),src=boxSrc();if(!src)return null;
  const grp=new w.cat.constructor();
  parts.forEach(([sx,sy,sz,x,y,z,col])=>{const m=new src.constructor(new src.geometry.constructor(sx,sy,sz),src.material.clone());m.material.color.set(col);m.position.set(x,y,z);m.castShadow=true;grp.add(m)});
  grp.scale.setScalar(.42);w.scene.add(grp);ev.props.push(grp);return grp;
}
function flower(){return vox([[.28,1.7,.28,0,.85,0,'#6fa66a'],[.7,.22,.7,.55,1.75,0,'#f2a7b5'],[.7,.22,.7,-.55,1.75,0,'#f2a7b5'],[.7,.22,.7,0,1.75,.55,'#f2a7b5'],[.7,.22,.7,0,1.75,-.55,'#f2a7b5'],[.5,.3,.5,0,1.82,0,'#f6d36b'],[.7,.16,.4,.4,.6,0,'#7fb873']])}
function pouch(){return vox([[1.5,1.1,1.1,0,.55,0,'#b9824f'],[1.1,.35,.85,0,1.25,0,'#a06b3d'],[.35,.5,.35,0,1.6,0,'#e3b65a'],[.5,.3,.12,0,.7,.56,'#e8d1a6']])}
function cleanup(){
  ev.props.forEach(p=>{p.parent?.remove(p);p.traverse(o=>{o.geometry?.dispose();o.material?.dispose?.()})});ev.props=[];
  const w=Wd();if(ev.saved&&w){w.hemi.intensity=ev.saved.h;w.sun.intensity=ev.saved.s;(w.scene.background||w.scene.fog.color).copy(ev.saved.bg);w.scene.fog?.color.copy(ev.saved.fog)}
  ev.saved=null;ev.type=null;ev.choice=null;emo.hidden=true;drops.length=0;g.clearRect(0,0,cv.width,cv.height);
}
/* 事件开始：由游戏偶遇逻辑调用 */
const start=type=>{
  const w=Wd();if(!w)return;cleanup();
  ev.type=type;ev.t0=now();ev.choice=null;
  const c=w.cat.position,f=fwd(),side=V3(-f.z,0,f.x);
  if(type==='butterfly'){ev.flower=flower();ev.flower.position.copy(c).addScaledVector(f,1.4).addScaledVector(side,1);ev.flower.position.y=c.y;ev.bfFrom=w.bf.position.clone()}
  if(type==='lost-pouch'){ev.pouch=pouch();ev.pouch.position.copy(c).addScaledVector(f,1.8).addScaledVector(side,-1.1);ev.pouch.position.y=c.y;ev.pouch.rotation.y=.5}
  if(type==='rain'){ev.saved={h:w.hemi.intensity,s:w.sun.intensity,bg:(w.scene.background||w.scene.fog.color).clone(),fog:(w.scene.fog?.color||w.scene.background||w.scene.fog.color).clone()}}
  emo.textContent={butterfly:'🦋','lost-pouch':'❗',rain:'💧'}[type]||'❗';emo.hidden=false;emo.classList.add('pop');
  track('world_event_fx',{type});
};
/* 记录玩家选择，播放结果 */
const choose=choice=>{if(!ev.type)return;ev.choice=choice;ev.tc=now();emo.textContent={butterfly:{care:'💗',safe:'🍃',coins:'💨'},'lost-pouch':{care:'💗',safe:'👀',coins:'✨'},rain:{safe:'🌳',care:'🧣',coins:'💦'}}[ev.type]?.[choice]||'💗';};
/* 蝴蝶：飞来 → 停在花上 → 根据选择飞走 */
const moveButterfly=(E,cat,t)=>{
  if(ev.type!=='butterfly'||!ev.flower)return false;
  const top=ev.flower.position.clone();top.y+=.9;
  const T=now()-ev.t0;
  if(!ev.choice){
    const k=ease(T/2.4);E.position.lerpVectors(ev.bfFrom,top,k);E.position.y+=Math.sin(k*Math.PI)*.7+(k>=1?Math.abs(Math.sin(t*2))*.12:0);
    return true;
  }
  const C=now()-ev.tc,head=cat.position.clone();head.y+=1.6;
  if(ev.choice==='care'){const a=C*2.2,r=.8;E.position.set(head.x+Math.cos(a)*r,head.y+1+Math.sin(C*3)*.6+C*.4,head.z+Math.sin(a)*r)}
  else if(ev.choice==='coins'){E.position.copy(top).add(V3(C*2,C*C*.7+C*.6,-C*1.5))}
  else{E.position.copy(top).add(V3(C*.7,C*.8,C*.4))}
  return C<4.4;
};
/* 户外小猫的反应姿态 */
const pose=(model,cat,t,walking)=>{
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
function frame(dt){
  clock+=Math.min(.05,Math.max(0,dt));
  const w=Wd();if(!w||!ev.type)return;
  if(w.canvas.hidden){cleanup();return}
  const r=w.canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);
  if(cv.width!==Math.round(r.width*dpr)||cv.height!==Math.round(r.height*dpr)){cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr)}
  g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,r.width,r.height);
  const T=now()-ev.t0,C=ev.choice?now()-ev.tc:0,P=v=>{const s=w.proj(v);return{x:s.x*r.width,y:s.y*r.height}};
  const head=w.cat.position.clone();head.y+=2.4;const hp=P(head);
  emo.style.left=hp.x+'px';emo.style.top=hp.y+'px';
  if(ev.type==='rain'){
    const k=ev.choice==='safe'?Math.max(0,1-C/3):ev.choice?Math.max(.25,1-C/5):Math.min(1,T/1.2);
    if(ev.saved){const s=ev.saved,m=Math.min(1,T/1.2)*(ev.choice?Math.max(0,1-C/4):1);w.hemi.intensity=s.h*(1-.38*m);w.sun.intensity=s.s*(1-.6*m);(w.scene.background||w.scene.fog.color).copy(s.bg).lerp({r:.6,g:.68,b:.72,isColor:true},.55*m);w.scene.fog?.color.copy(w.scene.background||w.scene.fog.color)}
    g.fillStyle='rgba(70,91,108,'+(.11*k)+')';g.fillRect(0,0,r.width,r.height);
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
    const pp=ev.pouch.position.clone();pp.y+=.9;const s=P(pp);
    ev.pouch.position.y=w.cat.position.y+(ev.choice?0:Math.abs(Math.sin(T*2.4))*.12);
    if(ev.choice&&ev.choice!=='safe'){const k=ease(C/1.2);ev.pouch.scale.setScalar(Math.max(.001,.42*(1-k)))}
    for(let i=0;i<5;i++){const ph=(T*.8+i/5)%1,a=i*1.26;g.fillStyle=`rgba(255,226,140,${(1-ph)*.95})`;star(s.x+Math.cos(a)*(14+ph*16),s.y-8-ph*20+Math.sin(a)*6,3+2*(1-ph))}
  }
  if(ev.type==='butterfly'&&ev.flower){
    const fp=ev.flower.position.clone();fp.y+=.9;const s=P(fp);
    ev.flower.rotation.z=Math.sin(T*1.6)*.05;
    if(!ev.choice&&T>2.4){for(let i=0;i<4;i++){const ph=(T*.6+i/4)%1;g.fillStyle=`rgba(255,240,180,${(1-ph)*.8})`;star(s.x+Math.sin(i*2+T)*14,s.y-ph*22,2.4)}}
    if(ev.choice==='care'&&C<3.5){const ph=C/3.5;g.font='16px system-ui';g.globalAlpha=1-ph;g.fillText('💗',hp.x+10,hp.y-10-ph*30);g.globalAlpha=1}
  }
}
function star(x,y,r){g.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,R=i%2?r*.4:r;g.lineTo(x+Math.cos(a)*R,y+Math.sin(a)*R)}g.closePath();g.fill()}
return{start,choose,pose,moveButterfly,frame,cleanup,dispose(){cleanup();cv.remove();emo.remove()},get active(){return !!ev.type},get type(){return ev.type}};

}};
