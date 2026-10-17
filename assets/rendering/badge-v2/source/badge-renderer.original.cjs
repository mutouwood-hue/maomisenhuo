'use strict';
/* =====================================================================
   吧唧 3D 渲染参考实现（电脑端）
   - 读取与固件相同的 PCAT 资产（由 pcat-export 从 .bbmodel 导出）
   - 按固件方案逐步模拟：骨骼动画 → 顶点变换 → 背面剔除 → 条带分箱
     → 条带光栅化（定点边函数 + 16 位深度 + 4bpp 调色板贴图最近邻采样 + 每面平光照 LUT）
     → RGB565 条带送屏（只送脏矩形）→ 466×466 圆形 AMOLED
   - 统计每帧三角形 / 像素 / 送屏字节，并按成本模型粗估 ESP32-S3 耗时
   写法刻意贴近 C：类型化数组、整数边函数、无对象分配，便于逐行移植固件。
   ===================================================================== */
const SCR=466, STRIP_H=32;

/* ---------- 1. PCAT 解析 ---------- */
function parsePCAT(u8){
  const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);
  const tag=o=>String.fromCharCode(u8[o],u8[o+1],u8[o+2],u8[o+3]);
  if(tag(0)!=='PCAT') throw new Error('不是 PCAT 资产');
  const n=dv.getUint32(4,true); let o=8; const C={};
  for(let i=0;i<n;i++){const id=tag(o),sz=dv.getUint32(o+4,true);C[id]={o:o+8,sz};o+=8+sz+(sz&1);}
  let p=0; const r={u8:()=>u8[p++],u16:()=>{const v=dv.getUint16(p,true);p+=2;return v},i16:()=>{const v=dv.getInt16(p,true);p+=2;return v},
    str:()=>{const l=u8[p++];const s=new TextDecoder().decode(u8.subarray(p,p+l));p+=l;return s}};
  const at=id=>{if(!C[id])throw new Error('缺少块 '+id);p=C[id].o;};
  at('HEAD'); const ver=r.u16(),TW=r.u16(),TH=r.u16(),P=r.u16(),RS=r.u16(),SS=r.u16(),PS=r.u16();
  const v3=s=>[r.i16()/s,r.i16()/s,r.i16()/s];
  at('BONE'); const bones=[];for(let i=r.u16();i--;){bones.push({parent:r.i16(),pivot:v3(P),rot:v3(RS),name:r.str()});}
  at('CUBE'); const cubes=[];for(let i=r.u16();i--;){const c={bone:r.u8(),flags:r.u8(),from:v3(P),to:v3(P),origin:v3(P),rot:v3(RS),faces:[]};for(let f=0;f<6;f++)c.faces.push({u0:r.u8(),v0:r.u8(),u1:r.u8(),v1:r.u8(),fl:r.u8()});cubes.push(c);}
  at('OUTF'); const outfits={};for(let i=r.u16();i--;){const id=r.str(),bone=r.u8(),parts=[];for(let k=r.u16();k--;)parts.push({size:v3(P),pos:v3(P),color:r.u16()});outfits[id]={bone,parts};}
  at('ANIM'); const anims={};for(let i=r.u16();i--;){const name=r.str(),len=r.u16()/1000,loop=r.u8(),tracks=[];for(let t=r.u16();t--;){const bone=r.u8(),ch=r.u8(),keys=[];const sc=[PS,RS,SS][ch];for(let k=r.u16();k--;){const t_=r.u16()/1000,interp=r.u8();r.u8();keys.push({t:t_,interp,v:v3(sc)});}tracks.push({bone,ch,keys});}anims[name]={len,loop,tracks};}
  at('TEX4'); const tw=r.u16(),th=r.u16(),texs={};for(let i=r.u16();i--;){const id=r.str(),ncol=r.u8(),pal=new Uint16Array(16);for(let k=0;k<16;k++)pal[k]=r.u16();const nib=u8.slice(p,p+tw*th/2);p+=tw*th/2;texs[id]={ncol,pal,nib};}
  return {ver,TW:tw,TH:th,bones,cubes,outfits,anims,texs,bytes:u8.length};
}

/* ---------- 2. 数学（3×4 仿射矩阵，行主序） ---------- */
const D2R=Math.PI/180;
function m34(){return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0]);}
function mMul(a,b,o){ // o = a·b
  const r=new Float32Array(12);
  for(let i=0;i<3;i++){const a0=a[i*4],a1=a[i*4+1],a2=a[i*4+2],a3=a[i*4+3];
    r[i*4]=a0*b[0]+a1*b[4]+a2*b[8]; r[i*4+1]=a0*b[1]+a1*b[5]+a2*b[9]; r[i*4+2]=a0*b[2]+a1*b[6]+a2*b[10]; r[i*4+3]=a0*b[3]+a1*b[7]+a2*b[11]+a3;}
  o.set(r); return o;
}
function mTRS(o,t,rdeg,s){ // T·Rz·Ry·Rx·S（与 App 的 Euler "ZYX" 一致）
  const x=rdeg[0]*D2R,y=rdeg[1]*D2R,z=rdeg[2]*D2R;
  const cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
  const m00=cz*cy, m01=cz*sy*sx-sz*cx, m02=cz*sy*cx+sz*sx;
  const m10=sz*cy, m11=sz*sy*sx+cz*cx, m12=sz*sy*cx-cz*sx;
  const m20=-sy,   m21=cy*sx,          m22=cy*cx;
  o[0]=m00*s[0];o[1]=m01*s[1];o[2]=m02*s[2];o[3]=t[0];
  o[4]=m10*s[0];o[5]=m11*s[1];o[6]=m12*s[2];o[7]=t[1];
  o[8]=m20*s[0];o[9]=m21*s[1];o[10]=m22*s[2];o[11]=t[2];
  return o;
}

/* ---------- 3. 网格预处理（与 Three.js BoxGeometry 顶点 / UV 布局一致） ---------- */
// 面顺序 east(+x) west(-x) up(+y) down(-y) south(+z) north(-z)
const PLANES=[['z','y','x',-1,-1,1],['z','y','x',1,-1,-1],['x','z','y',1,1,1],['x','z','y',1,-1,-1],['x','y','z',1,-1,1],['x','y','z',-1,-1,-1]];
const AX={x:0,y:1,z:2};
const FACE_N=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const UVROT=[[0,1,2,3],[2,0,3,1],[3,2,1,0],[1,3,0,2]];
function faceCorners(f){ // 返回该面 4 个顶点对应的立方体角编号（bit2=x+ bit1=y+ bit0=z+）
  const [u,v,w,ud,vd,ws]=PLANES[f],out=[];
  for(let iy=0;iy<2;iy++)for(let ix=0;ix<2;ix++){const s=[0,0,0];s[AX[u]]=(ix-.5)*ud;s[AX[v]]=(iy-.5)*vd;s[AX[w]]=.5*ws;out.push((s[0]>0?4:0)|(s[1]>0?2:0)|(s[2]>0?1:0));}
  return out;
}
const FC=[0,1,2,3,4,5].map(faceCorners);
function buildMesh(A){
  // 每个方块：所属骨骼、相对骨骼的枢轴矩阵、8 个角（局部）、6 个面（角索引、UV、钳制矩形）
  const parts=[];
  const add=(bone,pivotLocal,center,size,faces,solid)=>{
    const corners=new Float32Array(24);
    for(let c=0;c<8;c++){corners[c*3]=center[0]+(c&4?.5:-.5)*size[0];corners[c*3+1]=center[1]+(c&2?.5:-.5)*size[1];corners[c*3+2]=center[2]+(c&1?.5:-.5)*size[2];}
    parts.push({bone,pivotLocal,corners,faces,solid});
  };
  for(const c of A.cubes){
    const bp=A.bones[c.bone].pivot, pl=mTRS(m34(),[c.origin[0]-bp[0],c.origin[1]-bp[1],c.origin[2]-bp[2]],c.rot,[1,1,1]);
    const size=[c.to[0]-c.from[0],c.to[1]-c.from[1],c.to[2]-c.from[2]];
    const center=[(c.from[0]+c.to[0])/2-c.origin[0],(c.from[1]+c.to[1])/2-c.origin[1],(c.from[2]+c.to[2])/2-c.origin[2]];
    const faces=[];
    c.faces.forEach((f,i)=>{ if(!(f.fl&0x80)) return;
      const Q=[[f.u0,f.v0],[f.u1,f.v0],[f.u0,f.v1],[f.u1,f.v1]],perm=UVROT[f.fl&3];
      faces.push({fi:i,corners:FC[i],uv:[0,1,2,3].map(k=>Q[perm[k]]),clamp:[Math.min(f.u0,f.u1),Math.min(f.v0,f.v1),Math.max(f.u0,f.u1)-1,Math.max(f.v0,f.v1)-1]});
    });
    add(c.bone,pl,center,size,faces,null);
  }
  return parts;
}
function outfitParts(A,id){
  const o=A.outfits[id]; if(!o) return [];
  return o.parts.map(p=>({bone:o.bone,pivotLocal:m34(),corners:(()=>{const c=new Float32Array(24);for(let k=0;k<8;k++){c[k*3]=p.pos[0]+(k&4?.5:-.5)*p.size[0];c[k*3+1]=p.pos[1]+(k&2?.5:-.5)*p.size[1];c[k*3+2]=p.pos[2]+(k&1?.5:-.5)*p.size[2];}return c})(),
    faces:[0,1,2,3,4,5].map(i=>({fi:i,corners:FC[i]})),solid:p.color}));
}

/* ---------- 4. 动画采样（线性 / 阶跃，与 App 相同） ---------- */
function sample(keys,t,def){
  if(!keys.length) return def;
  if(t<=keys[0].t) return keys[0].v; const L=keys[keys.length-1]; if(t>=L.t) return L.v;
  let i=1; while(i<keys.length&&t>keys[i].t) i++;
  const a=keys[i-1],b=keys[i],k=a.interp?0:(t-a.t)/(b.t-a.t);
  return [a.v[0]+(b.v[0]-a.v[0])*k,a.v[1]+(b.v[1]-a.v[1])*k,a.v[2]+(b.v[2]-a.v[2])*k];
}

/* ---------- 5. 渲染器 ---------- */
class BadgeRenderer{
  constructor(A){
    this.A=A; this.mesh=buildMesh(A); this.extra=[];
    this.boneW=A.bones.map(()=>m34()); this.tmp=m34();
    this.fb=new Uint16Array(SCR*SCR);              // 模拟屏幕 GRAM（RGB565）
    this.stripC=new Uint16Array(SCR*STRIP_H);      // 条带颜色缓冲 466×32×2B
    this.stripZ=new Uint16Array(SCR*STRIP_H);      // 条带深度缓冲 466×32×2B
    const maxT=(A.cubes.length+64)*12;
    this.tv=new Float32Array(maxT*3*5);            // 每个三角形 3 顶点 × (sx,sy,invW,u/w,v/w)
    this.tinfo=new Int32Array(maxT*4);             // 颜色/纹理模式、光照级、钳制矩形索引、包围盒
    this.tbox=new Int16Array(maxT*4);
    this.tclamp=new Uint8Array(maxT*4);
    this.prevDirty=null; this.opt={half:false,persp:true,ground:true,breed:'orange',outfit:'none'};
    this.setBreed('orange');
    this.ground=this.makeGround();
  }
  setBreed(id){
    const t=this.A.texs[id]; this.tex=t; this.opt.breed=id;
    // 16 级光照 × 16 色 LUT（RGB565），固件预计算后常驻内存 512B
    this.lut=new Uint16Array(256);
    for(let l=0;l<16;l++){const k=0.45+l*(0.65/15);for(let c=0;c<16;c++)this.lut[l*16+c]=shade565(t.pal[c],k);}
  }
  setOutfit(id){this.opt.outfit=id;this.extra=outfitParts(this.A,id);}
  makeGround(){ // 地面柔光：y=0 平面上的 16 边形，暗灰，可关
    const n=16,pts=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2;pts.push([Math.cos(a)*7.5,0.01,Math.sin(a)*9+2.5]);}return pts;
  }
  pose(anim,t,look){
    const A=this.A,an=A.anims[anim];
    const pos=A.bones.map(()=>[0,0,0]),rot=A.bones.map(b=>[...b.rot]),scl=A.bones.map(()=>[1,1,1]);
    if(an){const tt=an.loop?t%an.len:Math.min(t,an.len);
      for(const tr of an.tracks){const v=sample(tr.keys,tt,tr.ch===2?[1,1,1]:[0,0,0]);
        if(tr.ch===0){pos[tr.bone]=v;} else if(tr.ch===1){rot[tr.bone]=[rot[tr.bone][0]+v[0],rot[tr.bone][1]+v[1],rot[tr.bone][2]+v[2]];} else scl[tr.bone]=v;}}
    /* 扩展：rootYaw 整体转身（度）、rootY 整体上下（模型单位），用于怪行为与桌面走动 */
    if(this.opt.rootYaw||this.opt.rootY){rot[0]=[rot[0][0],rot[0][1]+(this.opt.rootYaw||0),rot[0][2]];pos[0]=[pos[0][0],pos[0][1]+(this.opt.rootY||0),pos[0][2]];}
    if(look){const h=A.bones.findIndex(b=>b.name==='head');if(h>=0){rot[h][0]+=look[1];rot[h][1]+=look[0];}}
    A.bones.forEach((b,i)=>{const pp=b.parent>=0?A.bones[b.parent].pivot:[0,0,0];
      mTRS(this.tmp,[b.pivot[0]-pp[0]+pos[i][0],b.pivot[1]-pp[1]+pos[i][1],b.pivot[2]-pp[2]+pos[i][2]],rot[i],scl[i]);
      if(b.parent>=0) mMul(this.boneW[b.parent],this.tmp,this.boneW[i]); else this.boneW[i].set(this.tmp);});
  }
  camera(yaw,pitch,dist){
    const T=[0,8.6,2.2],D=dist||62,cy=Math.cos(yaw*D2R),sy=Math.sin(yaw*D2R),cp=Math.cos(pitch*D2R),sp=Math.sin(pitch*D2R);
    const e=[T[0]+D*sy*cp,T[1]+D*sp,T[2]-D*cy*cp];
    let f=[T[0]-e[0],T[1]-e[1],T[2]-e[2]];const fl=Math.hypot(...f);f=f.map(v=>v/fl);
    let r=[f[2],0,-f[0]];const rl=Math.hypot(...r);r=r.map(v=>v/rl); // r = up × f（左手：x 右 y 上 z 前）
    const u=[f[1]*r[2]-f[2]*r[1],f[2]*r[0]-f[0]*r[2],f[0]*r[1]-f[1]*r[0]];
    this.view=new Float32Array([r[0],r[1],r[2],-(r[0]*e[0]+r[1]*e[1]+r[2]*e[2]), u[0],u[1],u[2],-(u[0]*e[0]+u[1]*e[1]+u[2]*e[2]), f[0],f[1],f[2],-(f[0]*e[0]+f[1]*e[1]+f[2]*e[2])]);
    this.light=norm([-0.35,0.8,-0.6]);
  }
  /* 一帧：返回统计 */
  frame(){
    const half=this.opt.half,R=half?233:SCR,F=(R/2)/Math.tan(13.5*D2R),cx=R/2+(this.opt.ox||0)*R/SCR,cy=R/2+(this.opt.oy||0)*R/SCR; /* 扩展：ox/oy = 小猫中心在屏幕上的偏移（466 像素坐标） */
    const st={verts:0,tris:0,culled:0,binned:0,tested:0,inside:0,written:0,clear:0,strips:0,bytes:0};
    const V=this.view,tv=this.tv,ti=this.tinfo,tb=this.tbox,tc=this.tclamp;
    let nt=0,minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9,invMin=1e9,invMax=-1e9;
    const sv=new Float32Array(8*4),M=this.tmp2||(this.tmp2=m34()),wn=[0,0,0];
    const parts=this.mesh.concat(this.extra);
    // —— 顶点变换 + 三角形组装 ——
    for(const p of parts){
      mMul(this.boneW[p.bone],p.pivotLocal,M);
      const MV=mMul(V,M,this.tmp3||(this.tmp3=m34()));
      for(let c=0;c<8;c++){const x=p.corners[c*3],y=p.corners[c*3+1],z=p.corners[c*3+2];
        const X=MV[0]*x+MV[1]*y+MV[2]*z+MV[3],Y=MV[4]*x+MV[5]*y+MV[6]*z+MV[7],Z=MV[8]*x+MV[9]*y+MV[10]*z+MV[11];
        const iw=1/Z; sv[c*4]=cx+F*X*iw; sv[c*4+1]=cy-F*Y*iw; sv[c*4+2]=iw; sv[c*4+3]=Z;}
      st.verts+=8;
      for(const f of p.faces){
        const k=f.corners; // 两个三角形 (0,2,1) (2,3,1)
        // 面法线（世界空间）→ 光照级
        const n=FACE_N[f.fi];wn[0]=M[0]*n[0]+M[1]*n[1]+M[2]*n[2];wn[1]=M[4]*n[0]+M[5]*n[1]+M[6]*n[2];wn[2]=M[8]*n[0]+M[9]*n[1]+M[10]*n[2];
        const L=this.light,nl=Math.hypot(wn[0],wn[1],wn[2])||1,d=Math.max(0,(wn[0]*L[0]+wn[1]*L[1]+wn[2]*L[2])/nl);
        const lvl=Math.min(15,Math.round((0.62+0.45*d-0.45)/(0.65/15)));
        for(const tri of [[0,2,1],[2,3,1]]){
          const a=k[tri[0]],b=k[tri[1]],c=k[tri[2]];
          st.tris++;
          if(sv[a*4+3]<1||sv[b*4+3]<1||sv[c*4+3]<1){st.culled++;continue;}
          const area=(sv[b*4]-sv[a*4])*(sv[c*4+1]-sv[a*4+1])-(sv[c*4]-sv[a*4])*(sv[b*4+1]-sv[a*4+1]);
          if(area>=0){st.culled++;continue;}               // 背面（屏幕 y 向下，正面为负面积）
          const o=nt*15,ord=[a,c,b];                        // 交换为正向绕序
          for(let q=0;q<3;q++){const s=ord[q]*4,iw=sv[s+2];tv[o+q*5]=sv[s];tv[o+q*5+1]=sv[s+1];tv[o+q*5+2]=iw;
            if(!p.solid){const uv=f.uv[tri[[0,2,1][q]]];tv[o+q*5+3]=uv[0]*iw;tv[o+q*5+4]=uv[1]*iw;}
            if(iw<invMin)invMin=iw;if(iw>invMax)invMax=iw;}
          const x0=Math.floor(Math.min(tv[o],tv[o+5],tv[o+10])),x1=Math.ceil(Math.max(tv[o],tv[o+5],tv[o+10]));
          const y0=Math.floor(Math.min(tv[o+1],tv[o+6],tv[o+11])),y1=Math.ceil(Math.max(tv[o+1],tv[o+6],tv[o+11]));
          tb[nt*4]=Math.max(0,x0);tb[nt*4+1]=Math.max(0,y0);tb[nt*4+2]=Math.min(R,x1);tb[nt*4+3]=Math.min(R,y1);
          if(x0<minX)minX=x0;if(y0<minY)minY=y0;if(x1>maxX)maxX=x1;if(y1>maxY)maxY=y1;
          ti[nt*4]=p.solid?1:0; ti[nt*4+1]=lvl; ti[nt*4+2]=p.solid?shade565(p.solid,0.45+lvl*(0.65/15)):0;
          if(!p.solid){tc[nt*4]=f.clamp[0];tc[nt*4+1]=f.clamp[1];tc[nt*4+2]=f.clamp[2];tc[nt*4+3]=f.clamp[3];}
          nt++;
        }
      }
    }
    // 地面柔光（不写深度，先画）
    const gnd=[];if(this.opt.ground){for(const g of this.ground){const X=V[0]*g[0]+V[1]*g[1]+V[2]*g[2]+V[3],Y=V[4]*g[0]+V[5]*g[1]+V[6]*g[2]+V[7],Z=V[8]*g[0]+V[9]*g[1]+V[10]*g[2]+V[11];gnd.push([cx+F*X/Z,cy-F*Y/Z]);}
      for(const g of gnd){minX=Math.min(minX,g[0]|0);maxX=Math.max(maxX,Math.ceil(g[0]));minY=Math.min(minY,g[1]|0);maxY=Math.max(maxY,Math.ceil(g[1]));}}
    st.tris+=0; st.drawn=nt;
    // —— 脏矩形（本帧 ∪ 上一帧，2 像素对齐：CO5300 要求列/行起止为偶数）——
    const sc=half?2:1;
    let d=[Math.max(0,minX*sc-2)&~1,Math.max(0,minY*sc-2)&~1,Math.min(SCR,(maxX*sc+3)&~1),Math.min(SCR,(maxY*sc+3)&~1)];
    const cur=d.slice(); if(this.prevDirty){const q=this.prevDirty;d=[Math.min(d[0],q[0]),Math.min(d[1],q[1]),Math.max(d[2],q[2]),Math.max(d[3],q[3])];}
    this.prevDirty=cur; this.dirty=d;
    const zs=65000/Math.max(1e-6,invMax-invMin);
    // —— 条带渲染（在渲染分辨率下）——
    const dx0=Math.floor(d[0]/sc),dy0=Math.floor(d[1]/sc),dx1=Math.ceil(d[2]/sc),dy1=Math.ceil(d[3]/sc);
    const SH=half?STRIP_H/2:STRIP_H; // 半分辨率时条带行数减半，放大后仍是 32 行
    const C=this.stripC,Zb=this.stripZ,tex=this.tex,nib=tex.nib,TW=this.A.TW,lut=this.lut,persp=this.opt.persp;
    for(let s0=Math.floor(dy0/SH)*SH;s0<dy1;s0+=SH){
      const sy0=Math.max(s0,dy0),sy1=Math.min(s0+SH,dy1,R); if(sy1<=sy0) continue; st.strips++;
      // 清屏（背景纯黑：AMOLED 不发光）
      for(let y=sy0;y<sy1;y++){const row=(y-s0)*SCR;for(let x=dx0;x<dx1;x++){C[row+x]=0;Zb[row+x]=0;}}
      st.clear+=(sy1-sy0)*(dx1-dx0);
      if(gnd.length) this.fillPoly(gnd,s0,sy0,sy1,dx0,dx1,shade565(0x2a2622,1),st);
      for(let t=0;t<nt;t++){
        const by0=Math.max(tb[t*4+1],sy0),by1=Math.min(tb[t*4+3],sy1); if(by1<=by0) continue;
        const bx0=Math.max(tb[t*4],dx0),bx1=Math.min(tb[t*4+2],dx1); if(bx1<=bx0) continue;
        st.binned++;
        const o=t*15;
        // 定点 28.4 顶点
        const X0=Math.round(tv[o]*16),Y0=Math.round(tv[o+1]*16),X1=Math.round(tv[o+5]*16),Y1=Math.round(tv[o+6]*16),X2=Math.round(tv[o+10]*16),Y2=Math.round(tv[o+11]*16);
        const area=(X1-X0)*(Y2-Y0)-(X2-X0)*(Y1-Y0); if(area<=0) continue;
        // 边函数 E_ab(p) = (Xb-Xa)(py-Ya) - (Yb-Ya)(px-Xa)；左上填充规则用偏置
        const A01=Y0-Y1,B01=X1-X0,A12=Y1-Y2,B12=X2-X1,A20=Y2-Y0,B20=X0-X2;
        const bias0=(A12>0||(A12===0&&B12<0))?0:-1,bias1=(A20>0||(A20===0&&B20<0))?0:-1,bias2=(A01>0||(A01===0&&B01<0))?0:-1;
        const px=bx0*16+8,py=by0*16+8;
        let w0r=A12*(px-X1)+B12*(py-Y1), w1r=A20*(px-X2)+B20*(py-Y2), w2r=A01*(px-X0)+B01*(py-Y0);
        const inv=1/area, solid=ti[t*4]===1, col=ti[t*4+2], lv=ti[t*4+1]*16;
        const i0=tv[o+2],i1=tv[o+7],i2=tv[o+12],u0=tv[o+3],u1=tv[o+8],u2=tv[o+13],v0=tv[o+4],v1=tv[o+9],v2=tv[o+14];
        const cu0=tc[t*4],cv0=tc[t*4+1],cu1=tc[t*4+2],cv1=tc[t*4+3];
        for(let y=by0;y<by1;y++){
          let w0=w0r,w1=w1r,w2=w2r; const row=(y-s0)*SCR;
          for(let x=bx0;x<bx1;x++){
            st.tested++;
            if(((w0+bias0)|(w1+bias1)|(w2+bias2))>=0){
              st.inside++;
              const b0=w0*inv,b1=w1*inv,b2=w2*inv,iw=b0*i0+b1*i1+b2*i2;
              const z=((iw-invMin)*zs)|0, zi=row+x;
              if(z>=Zb[zi]){
                let c;
                if(solid) c=col;
                else{
                  let u,v; if(persp){const r=1/iw;u=(b0*u0+b1*u1+b2*u2)*r;v=(b0*v0+b1*v1+b2*v2)*r;}
                  else{u=(b0*u0/i0+b1*u1/i1+b2*u2/i2);v=(b0*v0/i0+b1*v1/i1+b2*v2/i2);}
                  let tx=u|0,ty=v|0; if(tx<cu0)tx=cu0;else if(tx>cu1)tx=cu1; if(ty<cv0)ty=cv0;else if(ty>cv1)ty=cv1;
                  const by=nib[(ty*TW+tx)>>1],ix=(tx&1)?by&15:by>>4;
                  if(ix===0){w0+=A12*16;w1+=A20*16;w2+=A01*16;continue;} // 透明像素：不写颜色和深度
                  c=lut[lv+ix];
                }
                C[zi]=c;Zb[zi]=z;st.written++;
              }
            }
            w0+=A12*16;w1+=A20*16;w2+=A01*16;
          }
          w0r+=B12*16;w1r+=B20*16;w2r+=B01*16;
        }
      }
      // —— 送屏：条带 → GRAM（半分辨率时 2× 最近邻放大），只送脏列 ——
      const fb=this.fb;
      if(!half){for(let y=sy0;y<sy1;y++){const row=(y-s0)*SCR,fr=y*SCR;for(let x=dx0;x<dx1;x++)fb[fr+x]=C[row+x];}st.bytes+=(sy1-sy0)*(dx1-dx0)*2;}
      else{for(let y=sy0;y<sy1;y++){const row=(y-s0)*SCR;for(let k=0;k<2;k++){const Y=y*2+k;if(Y>=SCR)break;const fr=Y*SCR;for(let x=dx0;x<dx1;x++){const c=C[row+x],X=x*2;fb[fr+X]=c;if(X+1<SCR)fb[fr+X+1]=c;}}}st.bytes+=(sy1-sy0)*2*(dx1-dx0)*2*2;}
    }
    st.dirtyPct=(d[2]-d[0])*(d[3]-d[1])/(SCR*SCR)*100;
    return st;
  }
  fillPoly(pts,s0,y0,y1,x0,x1,col,st){ // 扫描线凸多边形（地面柔光）
    const C=this.stripC,n=pts.length;
    for(let y=y0;y<y1;y++){const py=y+.5;let a=1e9,b=-1e9;
      for(let i=0;i<n;i++){const p=pts[i],q=pts[(i+1)%n];if((p[1]<=py&&q[1]>py)||(q[1]<=py&&p[1]>py)){const x=p[0]+(py-p[1])/(q[1]-p[1])*(q[0]-p[0]);if(x<a)a=x;if(x>b)b=x;}}
      if(a>b) continue; const xa=Math.max(x0,Math.ceil(a-.5)),xb=Math.min(x1,Math.floor(b-.5)+1),row=(y-s0)*SCR;for(let x=xa;x<xb;x++)C[row+x]=col;}
  }
}
function shade565(c,k){let r,g,b;if(c>0xffff){r=c>>16&255;g=c>>8&255;b=c&255;}else{r=(c>>11)<<3;g=(c>>5&63)<<2;b=(c&31)<<3;r|=r>>5;g|=g>>6;b|=b>>5;}
  r=Math.min(255,r*k);g=Math.min(255,g*k);b=Math.min(255,b*k);return ((r>>3)<<11)|((g>>2)<<5)|(b>>3);}
function norm(v){const l=Math.hypot(...v);return v.map(x=>x/l);}
/* ---------- 6. ESP32-S3 成本模型（粗估，需上板实测校准）---------- */
const COST={vert:90,tri:350,bin:120,test:8,persp:40,affine:22,write:10,clear:2,mhz:240,qspiMBs:20};
function estimate(st,persp){
  const cyc=st.verts*COST.vert+st.drawn*COST.tri+st.binned*COST.bin+st.tested*COST.test+st.inside*(persp?COST.persp:COST.affine)+st.written*COST.write+st.clear*COST.clear;
  const renderMs=cyc/(COST.mhz*1000), txMs=st.bytes/(COST.qspiMBs*1000);
  // 双条带缓冲 + DMA：送屏与下一条带渲染重叠，帧时间 ≈ max(渲染, 送屏) + 一条带的尾巴
  const frameMs=Math.max(renderMs,txMs)+Math.min(renderMs,txMs)/Math.max(1,st.strips);
  return {cycles:cyc,renderMs,txMs,frameMs,fps:1000/frameMs};
}
if(typeof module!=='undefined'&&module.exports) module.exports={parsePCAT,BadgeRenderer,SCR,STRIP_H,estimate,COST};
