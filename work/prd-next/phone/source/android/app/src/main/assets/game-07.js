
/* 40-blocks-lib.js */
/* ===== v6 积木场景：组件库 + 配方校验 + 搭建（AI 只挑积木、摆位置，画风由组件库统一） ===== */
(()=>{
const BK=window.__pgBlocks={};
/* ---------- 调色板：AI 只能用这些颜色名 ---------- */
const PAL={'奶油':'#f0deac','米白':'#eee3c8','白':'#f7f2e8','杏黄':'#e8d59b','土黄':'#d3bd8e','金黄':'#e7bd64','木色':'#bd9271','深木':'#9c7656',
 '砖红':'#d4917e','珊瑚':'#e98a7a','桃粉':'#edb0ab','薄荷':'#a5c3a3','草绿':'#81aa8d','青绿':'#729981','深绿':'#5f8574',
 '湖蓝':'#83b6c0','雾蓝':'#9fb4cc','淡紫':'#b9a7c9','石灰':'#cfc8b8','炭灰':'#77706a'};
const GROUND={'草地':'#93b898','嫩草':'#a3bd9b','深草':'#89af91','广场':'#d9cfba','沙地':'#e3d2ad'};
const LIGHT={'晴天':{h:1,s:1},'午后':{h:1.05,s:1.12,bg:'#f2e6cf',tint:'#ffe7c2'},'黄昏':{h:.82,s:.78,bg:'#efc9ad',tint:'#ffc79e'},'阴天':{h:.96,s:.42,bg:'#d3d9d6'}};
const hex2=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const mix=(a,b,k)=>'#'+hex2(a).map((v,i)=>Math.round(v+(hex2(b)[i]-v)*k).toString(16).padStart(2,'0')).join('');
const lt=(h,k=.14)=>mix(h,'#ffffff',k),dk=(h,k=.14)=>mix(h,'#3b2a20',k);
const G={trunk:'#b0916b',wood:PAL['木色'],dwood:PAL['深木'],glass:'#cfe3e6',stone:PAL['石灰'],dark:PAL['炭灰'],white:PAL['白'],gold:PAL['金黄'],leaf:PAL['草绿'],spray:'#c3e0df'};
/* ---------- 组件库：每个组件 = 一组方块 [宽,高,深, x,底部y,z, 颜色, 选项]，正面朝 +z ---------- */
const C={};
const def=(id,o)=>{C[id]={id,size:1,collide:0,walk:false,thin:false,slots:{},...o};};
def('tree',{name:'圆冠树',cat:'自然',collide:4,slots:{main:'草绿'},b:c=>[[1.8,8,1.8,0,0,0,G.trunk],[7.5,5,7.5,0,7,0,c.main],[5.6,3.6,5.6,-.3,11.6,.2,lt(c.main,.12)],[3.4,2.4,3.4,.3,14.8,-.2,lt(c.main,.24)]]});
def('pine',{name:'松树',cat:'自然',collide:3.5,slots:{main:'青绿'},b:c=>[[1.4,4,1.4,0,0,0,G.trunk],[7,3,7,0,3.4,0,c.main],[5.4,3,5.4,0,6.2,0,lt(c.main,.08)],[3.8,3,3.8,0,9,0,lt(c.main,.16)],[2,2.4,2,0,11.8,0,lt(c.main,.24)]]});
def('sapling',{name:'小树',cat:'自然',collide:2.5,thin:true,slots:{main:'薄荷'},b:c=>[[1.2,5,1.2,0,0,0,G.trunk],[5,4,5,0,4.4,0,c.main],[3.2,2,3.2,0,8.2,0,lt(c.main,.15)]]});
def('bush',{name:'灌木',cat:'自然',collide:2.5,slots:{main:'青绿'},b:c=>[[4.6,2.6,3.8,0,0,0,c.main],[3.2,1.4,2.8,.4,2.4,-.1,lt(c.main,.15)]]});
def('flowers',{name:'花丛',cat:'自然',walk:true,slots:{main:'桃粉',accent:'金黄'},b:c=>[[3.8,.5,2.8,0,0,0,G.leaf],[1,1,1,-1.1,.5,-.5,c.main],[1,1,1,1,.6,.5,c.main],[1,1,1,.1,.9,-.2,c.accent],[.8,.8,.8,-.2,.5,.9,lt(c.main,.2)]]});
def('grass',{name:'草丛',cat:'自然',walk:true,slots:{main:'草绿'},b:c=>[[.4,1.6,.4,-.8,0,-.3,c.main],[.4,2.1,.4,0,0,.2,lt(c.main,.1)],[.4,1.3,.4,.8,0,-.1,lt(c.main,.2)],[.4,1.1,.4,.3,0,-.8,c.main],[.4,1.4,.4,-.4,0,.7,lt(c.main,.15)]]});
def('rock',{name:'石头',cat:'自然',walk:true,slots:{main:'石灰'},b:c=>[[2.8,1.4,2.2,0,0,0,c.main],[1.6,1,1.4,.4,1.4,.1,lt(c.main,.15)]]});
def('reeds',{name:'芦苇',cat:'自然',slots:{main:'草绿'},b:c=>[[.3,2.6,.3,-.8,0,0,c.main],[.3,3.1,.3,0,0,.4,c.main],[.3,2.3,.3,.8,0,-.3,c.main],[.6,1,.6,-.8,2.6,0,G.dwood],[.6,1,.6,0,3.1,.4,G.dwood],[.6,1,.6,.8,2.3,-.3,G.dwood]]});
def('pond',{name:'小池塘',cat:'自然',size:2,collide:6,slots:{main:'湖蓝'},b:c=>[[12,.6,1.4,0,0,-5.3,G.stone],[12,.6,1.4,0,0,5.3,G.stone],[1.4,.6,9.2,-5.3,0,0,G.stone],[1.4,.6,9.2,5.3,0,0,G.stone],[9.2,.3,9.2,0,.1,0,c.main,{o:.88}],[1.6,.12,1.6,-2,.42,1.5,'#8fb98f'],[1.2,.12,1.2,2.2,.42,-1.8,'#8fb98f'],[.5,.4,.5,-2,.5,1.5,PAL['桃粉']]]});
def('lamp',{name:'路灯',cat:'街道',collide:1.5,thin:true,slots:{main:'炭灰'},b:c=>[[1.6,.8,1.6,0,0,0,c.main],[.6,6.4,.6,0,.8,0,c.main],[1.4,1.2,1.4,0,7.2,0,'#f6e3a0'],[2,.4,2,0,7,0,c.main],[2.4,.5,2.4,0,8.4,0,c.main],[.6,.5,.6,0,8.9,0,c.main]]});
def('bench',{name:'长椅',cat:'街道',collide:3,slots:{main:'木色'},b:c=>[[.6,1.8,.6,-2.4,0,-.7,G.dark],[.6,1.8,.6,2.4,0,-.7,G.dark],[.6,1.8,.6,-2.4,0,.7,G.dark],[.6,1.8,.6,2.4,0,.7,G.dark],[6,.5,2.2,0,1.8,0,c.main],[6,1.8,.5,0,2.3,-.9,c.main]]});
def('sign',{name:'木牌',cat:'街道',collide:1,thin:true,slots:{main:'奶油',accent:'青绿'},b:c=>[[.7,5.4,.7,0,0,0,G.dwood],[5,2.6,.5,0,4.4,0,c.main],[3.6,1.4,.14,0,5,.3,c.accent]]});
def('mailbox',{name:'邮筒',cat:'街道',collide:1.4,slots:{main:'青绿'},b:c=>[[1.8,3.4,1.8,0,0,0,c.main],[2,.6,2,0,3.4,0,dk(c.main)],[1.1,.24,.12,0,2.5,.92,G.dark],[.8,.8,.12,0,1.2,.92,G.gold]]});
def('bin',{name:'垃圾桶',cat:'街道',collide:1.3,slots:{main:'草绿'},b:c=>[[1.8,2.2,1.8,0,0,0,c.main],[2,.3,2,0,2.2,0,dk(c.main)],[.6,.3,.3,0,2.5,0,dk(c.main)]]});
def('bike',{name:'自行车',cat:'街道',collide:2,slots:{main:'珊瑚'},b:c=>[[1.8,1.8,.3,-1.7,0,0,G.dark],[1.8,1.8,.3,1.7,0,0,G.dark],[.8,.8,.34,-1.7,.5,0,G.stone],[.8,.8,.34,1.7,.5,0,G.stone],[3.2,.3,.3,0,1.3,0,c.main],[.3,.9,.3,-.9,1.3,0,c.main],[1,.3,.7,-.9,2.2,0,G.dark],[.3,1.4,.3,1.5,.9,0,c.main],[.3,.3,1.6,1.5,2.3,0,G.dark],[1,.8,1,2.3,1.3,0,G.wood]]});
def('vending',{name:'自动售货机',cat:'街道',collide:2.2,slots:{main:'珊瑚'},b:c=>{const d=[PAL['金黄'],PAL['湖蓝'],PAL['桃粉'],PAL['薄荷'],PAL['奶油'],PAL['雾蓝']],P=[[3.8,6.4,2.6,0,0,0,c.main],[2.8,3.2,.2,-.3,2.6,1.35,G.glass],[2.6,.8,.2,-.3,.8,1.35,G.dark],[.4,2.6,.18,1.45,2.9,1.36,G.white],[4,.4,2.8,0,6.4,0,dk(c.main)]];[-1.1,-.3,.5].forEach((x,i)=>[4.2,3].forEach((y,j)=>P.push([.5,.9,.12,x,y,1.47,d[i*2+j]])));return P}});
def('busstop',{name:'公交站',cat:'街道',collide:3,slots:{main:'湖蓝',accent:'金黄'},b:c=>[[.4,6,.4,-2.8,0,-.9,G.dark],[.4,6,.4,2.8,0,-.9,G.dark],[7,.5,3,0,6,0,c.main],[6,3.2,.2,0,1.8,-1,G.glass,{o:.8}],[5,.4,1.1,0,1.5,-.4,G.wood],[.4,1.5,.4,-2,0,-.4,G.dark],[.4,1.5,.4,2,0,-.4,G.dark],[.3,6.6,.3,3.6,0,.9,G.dark],[1.6,1.6,.25,3.6,6.4,.9,c.accent]]});
def('hydrant',{name:'消防栓',cat:'街道',slots:{main:'砖红'},b:c=>[[1.1,2,1.1,0,0,0,c.main],[1.8,.45,.6,0,1.2,0,c.main],[1.3,.4,1.3,0,2,0,dk(c.main)],[.5,.4,.5,0,2.4,0,dk(c.main)]]});
def('cone',{name:'路锥',cat:'街道',slots:{main:'珊瑚'},b:c=>[[1.8,.3,1.8,0,0,0,c.main],[1.1,1,1.1,0,.3,0,c.main],[.8,.7,.8,0,1.3,0,G.white],[.5,.7,.5,0,2,0,c.main]]});
def('house',{name:'小房子',cat:'建筑',size:2,collide:7,slots:{main:'米白',accent:'砖红'},b:c=>[[10.4,.6,9.4,0,0,0,dk(c.main,.1)],[10,8.4,9,0,.6,0,c.main],[11.4,1.4,10.4,0,9,0,c.accent],[8.6,1.4,10.4,0,10.4,0,lt(c.accent,.06)],[5.8,1.4,10.4,0,11.8,0,lt(c.accent,.12)],[3,1.4,10.4,0,13.2,0,lt(c.accent,.18)],[2.4,4.4,.3,0,.6,4.6,G.wood],[2.2,2.4,.3,-3.1,4.4,4.6,G.glass],[2.2,2.4,.3,3.1,4.4,4.6,G.glass],[2.6,.3,.5,-3.1,4.1,4.8,G.white],[2.6,.3,.5,3.1,4.1,4.8,G.white],[2.4,.6,.6,-3.1,3.5,4.9,PAL['桃粉']],[1.4,3,1.4,3.2,11.8,-2,dk(c.accent,.2)]]});
def('shop',{name:'小店铺',cat:'建筑',size:2,collide:7,slots:{main:'奶油',accent:'珊瑚',sign:'金黄'},b:c=>{const P=[[11,10,8,0,0,-1,c.main],[5.6,4.2,.3,-2,1.4,3.1,G.glass],[6,.5,.4,-2,1,3.2,G.white],[2.4,5,.3,3.4,0,3.1,G.wood],[11,.8,.3,0,6.8,5.9,c.accent],[7,2,.4,0,8.4,3.2,G.dwood],[11.6,.8,8.6,0,10,-1,dk(c.main,.15)],[1.3,1.3,.2,-2,8.75,3.45,c.sign],[1.3,1.3,.2,0,8.75,3.45,G.white],[1.3,1.3,.2,2,8.75,3.45,c.sign]];[-4.4,-2.2,0,2.2,4.4].forEach((x,i)=>P.push([2.2,.5,3.2,x,7.2,4.4,i%2?G.white:c.accent]));return P}});
def('office',{name:'办公楼',cat:'建筑',size:2,collide:7,slots:{main:'雾蓝',accent:'奶油'},b:c=>{const P=[[10,22,9,0,0,0,c.main],[3,3.4,.3,0,0,4.6,G.dark],[4.2,.4,1.4,0,3.6,5,c.accent],[10.6,.8,9.6,0,22,0,dk(c.main,.15)],[3,2,3,2,22.8,-1.5,G.stone]];for(let y=5;y<21;y+=3.4){P.push([8.4,1.4,.3,0,y,4.6,G.glass]);P.push([.3,1.4,7.4,5.05,y,0,G.glass])}return P}});
def('stall',{name:'小摊',cat:'建筑',collide:3,slots:{main:'奶油',accent:'珊瑚'},b:c=>[[5,2.6,2.6,0,0,0,G.wood],[5.4,.4,3,0,2.6,0,c.main],[.3,5,.3,-2.4,3,-1.2,G.dwood],[.3,5,.3,2.4,3,-1.2,G.dwood],[5.8,.6,3.6,0,8,0,c.accent],[5.8,.5,.3,0,7.5,1.8,G.white],[1,.8,1,-1.4,3,.4,PAL['金黄']],[1,.8,1,0,3,.4,PAL['桃粉']],[1,.8,1,1.4,3,.4,PAL['薄荷']],[.9,1.2,.9,2.2,6.2,1.3,PAL['砖红']]]});
def('kiosk',{name:'报刊亭',cat:'建筑',collide:3,slots:{main:'青绿',accent:'奶油'},b:c=>[[4.6,6,4,0,0,0,c.main],[3.4,2.2,.2,0,2.6,2.05,G.glass],[4.6,.4,1,0,2.4,2.3,G.white],[.8,.9,.2,-1.3,2.8,2.6,PAL['珊瑚']],[.8,.9,.2,0,2.8,2.6,PAL['金黄']],[.8,.9,.2,1.3,2.8,2.6,PAL['湖蓝']],[5.4,.8,4.8,0,6,0,c.accent],[3.4,.6,2.8,0,6.8,0,c.accent]]});
def('cathouse',{name:'猫屋',cat:'建筑',collide:2.6,slots:{main:'奶油',accent:'砖红'},b:c=>[[4,3,3.6,0,0,0,c.main],[4.6,.8,4.2,0,3,0,c.accent],[3.2,.8,4.2,0,3.8,0,lt(c.accent,.08)],[1.8,.8,4.2,0,4.6,0,lt(c.accent,.16)],[1.6,1.8,.2,0,.4,1.82,G.dark],[1,.4,.12,0,2.3,1.85,G.gold]]});
def('pavilion',{name:'凉亭',cat:'建筑',size:2,collide:6,slots:{main:'砖红'},b:c=>[[10,.6,10,0,0,0,G.stone],[.9,7,.9,-4,.6,-4,G.wood],[.9,7,.9,4,.6,-4,G.wood],[.9,7,.9,-4,.6,4,G.wood],[.9,7,.9,4,.6,4,G.wood],[6,.5,1.4,0,1.6,-3,G.wood],[11.6,1,11.6,0,7.6,0,c.main],[8.4,1,8.4,0,8.6,0,lt(c.main,.08)],[5.2,1,5.2,0,9.6,0,lt(c.main,.16)],[2,1.2,2,0,10.6,0,G.gold]]});
def('fountain',{name:'喷泉',cat:'建筑',size:2,collide:6,slots:{main:'湖蓝'},b:c=>[[10,1.4,10,0,0,0,G.stone],[8.4,.3,8.4,0,1.2,0,c.main,{o:.9}],[1.6,3,1.6,0,1.4,0,G.stone],[3.8,.6,3.8,0,4.4,0,G.stone],[.8,1.6,.8,0,5,0,G.spray,{o:.85}],[.5,.5,.5,1.5,3.4,1.5,G.spray],[.5,.5,.5,-1.5,3,-1.5,G.spray],[.5,.5,.5,1.5,2.6,-1.5,G.spray],[.5,.5,.5,-1.5,3.6,1.5,G.spray]]});
def('parasol',{name:'遮阳伞桌',cat:'摆件',collide:2.5,slots:{main:'珊瑚',accent:'白'},b:c=>[[.4,2.3,.4,0,0,0,G.dark],[2.6,.3,2.6,0,2.3,0,G.white],[1.3,1.4,1.3,-2.4,0,0,G.wood],[1.3,1.4,1.3,2.4,0,0,G.wood],[.3,1.6,1.3,-3,1.4,0,G.wood],[.3,1.6,1.3,3,1.4,0,G.wood],[.3,4.6,.3,0,2.6,0,G.dark],[6,.5,6,0,7.1,0,c.main],[3.6,.5,3.6,0,7.6,0,c.accent],[.6,.5,.6,0,8.1,0,c.main]]});
def('crate',{name:'木箱堆',cat:'摆件',collide:2,slots:{main:'木色'},b:c=>[[2.6,2.6,2.6,-.8,0,0,c.main],[2.7,.3,2.7,-.8,1.2,0,dk(c.main)],[2.1,2.1,2.1,1.5,0,.5,dk(c.main,.1)],[1.6,1.6,1.6,-.5,2.6,.1,lt(c.main,.1)]]});
def('pot',{name:'花盆',cat:'摆件',collide:1.2,slots:{main:'砖红',accent:'桃粉'},b:c=>[[1.8,1.6,1.8,0,0,0,c.main],[2,.3,2,0,1.6,0,dk(c.main)],[1.2,1.6,1.2,0,1.9,0,G.leaf],[.8,.7,.8,.3,3.5,.2,c.accent]]});
def('lantern',{name:'灯笼柱',cat:'摆件',collide:1,thin:true,slots:{main:'砖红'},b:c=>[[.5,6,.5,0,0,0,G.dwood],[2.2,.3,.3,1,5.7,0,G.dwood],[.12,.4,.12,1.8,5.3,0,G.dark],[1,.3,1,1.8,5,0,G.gold],[1.5,1.6,1.5,1.8,3.4,0,c.main],[.6,.3,.6,1.8,3.1,0,G.gold]]});
def('slide',{name:'滑梯',cat:'摆件',collide:2.6,slots:{main:'金黄',accent:'湖蓝'},b:c=>[[.3,5,.3,-1,0,-2.6,G.dark],[.3,5,.3,1,0,-2.6,G.dark],[2,.25,.25,0,1.2,-2.6,G.dark],[2,.25,.25,0,2.4,-2.6,G.dark],[2,.25,.25,0,3.6,-2.6,G.dark],[2.6,.4,2.6,0,4.8,-1.6,c.main],[.3,1.2,2.6,-1.2,5.2,-1.6,c.main],[.3,1.2,2.6,1.2,5.2,-1.6,c.main],[2,.3,6,0,2.4,1.5,c.accent,{rx:.62}]]});
def('swing',{name:'秋千',cat:'摆件',collide:3,slots:{main:'珊瑚'},b:c=>[[.6,8,.6,-3.2,0,0,G.wood],[.6,8,.6,3.2,0,0,G.wood],[7,.6,.6,0,8,0,G.dwood],[.15,4.4,.15,-1,3.6,0,G.dark],[.15,4.4,.15,1,3.6,0,G.dark],[2.6,.35,1.1,0,3.3,0,c.main]]});
def('picnic',{name:'野餐垫',cat:'摆件',walk:true,slots:{main:'珊瑚'},b:c=>{const P=[[5.4,.12,4.4,0,0,0,c.main]];for(let i=0;i<4;i++)for(let j=0;j<4;j++)if((i+j)%2)P.push([1.35,.14,1.1,-2.025+i*1.35,0,-1.65+j*1.1,G.white]);P.push([1.4,1,1,1.6,.12,1,G.wood],[1.4,.3,.3,1.6,1.12,1,G.dwood]);return P}});
/* 线条 / 区域类 */
def('path',{name:'小路',cat:'地面',line:true,slots:{main:'土黄'}});
def('tiles',{name:'石板地',cat:'地面',area:true,slots:{main:'石灰'}});
def('fence',{name:'栅栏',cat:'地面',line:true,fence:true,slots:{main:'米白'}});
def('custom',{name:'自定义积木',cat:'自定义',slots:{}});
Object.values(C).forEach(d=>{if(d.b){const P=d.b(Object.fromEntries(Object.entries(d.slots).map(([k,v])=>[k,PAL[v]])));d.top=Math.max(...P.map(p=>p[4]+p[1]));d.cls=d.top<=4.3?'low':d.top<=11.6?'mid':'tall'}});
BK.C=C;BK.PAL=PAL;BK.GROUND=GROUND;BK.LIGHT=LIGHT;
/* ---------- 场景网格：15 列 × 13 行，每格 6 单位 ---------- */
const COLS=15,ROWS=13,CELL=6,cx=c=>-42+CELL*c,cz=r=>36-CELL*r;
const NODES=[[-17,-6],[3,13],[19,-2],[-18,-7],[15,-8],[18,11],[-15,12],[0,5],[-9,-10]];
const NSET=new Set(NODES.map(([x,z])=>`${Math.round((x+42)/6)},${Math.round((36-z)/6)}`));
function zone(c,r,river){
  if(c<0||r<0||c>=COLS||r>=ROWS)return null;
  if(river&&r>=11)return '~';
  if(c>=3&&c<=11&&r>=3&&r<=9)return NSET.has(`${c},${r}`)?'N':'W';
  if(c<=2||r<=2)return 'B';
  if(c>=12&&r>=10)return 'L';
  return 'S';
}
const LIMIT={B:99,S:7.6,L:4.3,W:2.6,N:0,'~':0};
function fits(d,z,top){if(!z||z==='~'||z==='N')return false;if(z==='W')return !!d.walk;if(z==='S')return top<=LIMIT.S||(d.thin&&top<=9.6);return top<=LIMIT[z]}
BK.grid={COLS,ROWS,CELL,cx,cz,zone,NODES};
function zoneMap(river){let s='r\\c'+[...Array(COLS).keys()].map(c=>String(c).padStart(3)).join('')+'\n';for(let r=0;r<ROWS;r++){s+=String(r).padStart(3)+' '+[...Array(COLS).keys()].map(c=>'  '+zone(c,r,river)).join('')+'\n'}return s}
BK.zoneMap=zoneMap;
/* ---------- 配方校验：不认识的组件丢掉、颜色只能用色板、超区自动挪位 ---------- */
const colorOf=(v,fb)=>PAL[v]?v:fb;
const int=(v,a,b,fb)=>{v=Math.round(Number(v));return Number.isFinite(v)?Math.max(a,Math.min(b,v)):fb};
const cellOf=a=>Array.isArray(a)&&a.length>=2?[Math.round(+a[0]),Math.round(+a[1])]:null;
BK.validate=function(raw){
  const fix=[],out={title:'',ground:'草地',light:'晴天',river:false,items:[],lines:[]};
  let R=raw;if(typeof R==='string'){try{R=BK.parse(R)}catch(e){return {ok:false,error:'不是有效的 JSON：'+e.message}}}
  if(!R||typeof R!=='object')return {ok:false,error:'配方为空'};
  out.title=String(R.title||'').slice(0,20);
  out.ground=GROUND[R.ground]?R.ground:(R.ground&&fix.push(`地面「${R.ground}」不在可选范围，改成草地`),'草地');
  out.light=LIGHT[R.light]?R.light:(R.light&&fix.push(`光线「${R.light}」不在可选范围，改成晴天`),'晴天');
  out.river=!!R.river;
  out.lines=(Array.isArray(R.lines)?R.lines:[]).map(s=>String(s).slice(0,40)).filter(Boolean).slice(0,3);
  const occ=new Map();const items=Array.isArray(R.items)?R.items:[];
  if(items.length>48)fix.push(`组件超过 48 个，只保留前 48 个`);
  const near=(c,r,sz,d,top)=>{for(let k=0;k<=14;k++){const cand=[];for(let dc=-k;dc<=k;dc++)for(let dr=-k;dr<=k;dr++)if(Math.max(Math.abs(dc),Math.abs(dr))===k)cand.push([c+dc,r+dr]);
      cand.sort((a,b)=>Math.hypot(a[0]-c,a[1]-r)-Math.hypot(b[0]-c,b[1]-r));for(const [a,b] of cand)if(free(a,b,sz,d,top))return [a,b]}return null};
  const cells=(c,r,sz)=>{const o=[];for(let i=0;i<sz;i++)for(let j=0;j<sz;j++)o.push([c+i,r+j]);return o};
  const free=(c,r,sz,d,top)=>cells(c,r,sz).every(([a,b])=>!occ.has(`${a},${b}`)&&fits(d,zone(a,b,out.river),top));
  let customN=0;
  items.slice(0,48).forEach((it,i)=>{
    if(!it||typeof it!=='object')return;const id=String(it.c||it.id||it.type||'');const d=C[id];
    const nm=d?.name||id||'未知组件';
    if(!d){fix.push(`不认识组件「${id}」，已丢掉`);return}
    const cols={};Object.entries(d.slots).forEach(([k,v])=>{const want=it.color?.[k]??(k==='main'&&typeof it.color==='string'?it.color:undefined);cols[k]=colorOf(want,v);if(want&&!PAL[want])fix.push(`「${nm}」颜色「${want}」不在色板，用默认「${v}」`)});
    if(d.line||d.area){const a=cellOf(it.from),b=cellOf(it.to);if(!a||!b){fix.push(`「${nm}」缺少起点或终点，已丢掉`);return}
      const cl=([x,y])=>[int(x,0,COLS-1),int(y,0,ROWS-1)];const A=cl(a),Bb=cl(b);
      if(d.fence){const pts=[];if(A[0]!==Bb[0]&&A[1]!==Bb[1]){fix.push(`「栅栏」只能横平竖直，按 L 形处理`)}
        const seg=(p,q)=>{const dc=Math.sign(q[0]-p[0]),dr=Math.sign(q[1]-p[1]);let [x,y]=p;pts.push([x,y]);while(x!==q[0]||y!==q[1]){x+=dc;y+=dr;pts.push([x,y]);}};
        seg(A,[Bb[0],A[1]]);seg([Bb[0],A[1]],Bb);const uniq=[...new Map(pts.map(p=>[p.join(),p])).values()];const ok=uniq.filter(([x,y])=>{const z=zone(x,y,out.river);return z&&z!=='W'&&z!=='N'&&z!=='~'&&!occ.has(`${x},${y}`)});
        if(ok.length<uniq.length)fix.push(`「栅栏」有 ${uniq.length-ok.length} 格压到小猫活动区或其它组件，已截掉`);
        if(!ok.length)return;ok.forEach(([x,y])=>occ.set(`${x},${y}`,'fence'));out.items.push({c:id,cells:ok,color:cols});return}
      if(d.area){const c0=Math.min(A[0],Bb[0]),c1=Math.max(A[0],Bb[0]),r0=Math.min(A[1],Bb[1]),r1=Math.max(A[1],Bb[1]);out.items.push({c:id,from:[c0,r0],to:[c1,r1],color:cols});return}
      out.items.push({c:id,from:A,to:Bb,color:cols});return}
    let c0=cellOf(it.at);if(!c0){fix.push(`「${nm}」缺少位置 at，已丢掉`);return}
    let sz=d.size,blocks=null,top=d.top;
    if(id==='custom'){if(++customN>3){fix.push('自定义积木最多 3 个，多出的已丢掉');return}
      sz=it.size==2?2:1;const span=CELL*sz;let cut=0;
      blocks=(Array.isArray(it.blocks)?it.blocks:[]).slice(0,64).map(b=>{if(!Array.isArray(b)||b.length<6){cut++;return null}
        let [x,y,z,w,h,dd,col]=b;x=int(x,0,span-1,0);z=int(z,0,span-1,0);y=int(y,0,30,0);w=int(w,1,span-x,1);dd=int(dd,1,span-z,1);h=int(h,1,30-y,1);
        if(col&&!PAL[col])cut++;return [x,y,z,w,h,dd,PAL[col]?col:'奶油']}).filter(Boolean);
      if((it.blocks||[]).length>64)fix.push(`「${it.name||'自定义积木'}」超过 64 块，只保留前 64 块`);
      if(cut)fix.push(`「${it.name||'自定义积木'}」有 ${cut} 块格式或颜色不对，已修正`);
      if(!blocks.length){fix.push(`「${it.name||'自定义积木'}」没有有效方块，已丢掉`);return}
      top=Math.max(...blocks.map(b=>b[1]+b[4]))}
    const dm={walk:id==='custom'?top<=2:d.walk,thin:d.thin};
    let [c,r]=[int(c0[0],0,COLS-sz,0),int(c0[1],0,ROWS-sz,0)];
    if(!free(c,r,sz,dm,top)){const z0=zone(c,r,out.river);const n2=near(c,r,sz,dm,top);
      const why=occ.has(`${c},${r}`)?'和别的组件重叠':z0==='W'||z0==='N'?'压到小猫活动区':z0==='~'?'在河里':'对这个位置太高了';
      if(!n2){fix.push(`「${it.name||nm}」${why}，附近找不到空位，已丢掉`);return}
      fix.push(`「${it.name||nm}」${why}，从 (${c},${r}) 挪到 (${n2[0]},${n2[1]})`);[c,r]=n2}
    cells(c,r,sz).forEach(([a,b])=>occ.set(`${a},${b}`,id));
    const x=(cx(c)+cx(c+sz-1))/2,z=(cz(r)+cz(r+sz-1))/2;
    let rot=it.rot;rot=[0,90,180,270].includes(+rot)?+rot:null;
    if(rot===null){const a=Math.atan2(-x,-z);rot=((Math.round(a/(Math.PI/2))*90)%360+360)%360}
    out.items.push({c:id,at:[c,r],size:sz,x,z,rot,color:cols,name:it.name?String(it.name).slice(0,12):undefined,blocks,top});
  });
  out.grassHex=GROUND[out.ground];
  const n=out.items.filter(i=>i.c!=='path'&&i.c!=='tiles').length;
  return {ok:true,recipe:out,fix,stats:{items:n,custom:customN,blocks:out.items.reduce((s,i)=>s+(i.blocks?.length||0),0)}};
};
BK.parse=s=>{s=String(s).trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a<0||b<a)throw new Error('没有找到 { }');return JSON.parse(s.slice(a,b+1))};
/* ---------- 把配方变成方块（由户外场景在搭建时调用） ---------- */
function partsOf(it){
  const d=C[it.c];const col=Object.fromEntries(Object.entries(it.color||{}).map(([k,v])=>[k,PAL[v]||v]));
  if(it.c==='custom'){const s=CELL*it.size/2;return it.blocks.map(([x,y,z,w,h,dd,cn])=>[w,h,dd,x+w/2-s,y,z+dd/2-s,PAL[cn]])}
  return d.b(col);
}
BK.partsOf=partsOf;
let base=null;
function applyLight(w,R){
  if(!w)return;if(!base)base={h:w.hemi.intensity,s:w.sun.intensity,bg:w.scene.background?.clone?.(),fog:w.scene.fog?.color?.clone?.(),sc:w.sun.color.clone(),fn:w.scene.fog?.near,ff:w.scene.fog?.far};
  const L0=LIGHT[R?.light]||LIGHT['晴天'];w.hemi.intensity=base.h*L0.h;w.sun.intensity=base.s*L0.s;
  if(base.bg)w.scene.background.copy(base.bg);if(base.fog&&w.scene.fog)w.scene.fog.color.copy(base.fog);w.sun.color.copy(base.sc);
  if(L0.bg){w.scene.background.set(L0.bg);w.scene.fog?.color.set(L0.bg)}if(L0.tint)w.sun.color.set(L0.tint);
  if(w.scene.fog&&base.fn!=null){if(R){const p=w.cam.position,d=Math.hypot(p.x,p.y-6.5,p.z);w.scene.fog.near=Math.max(base.fn,d+22);w.scene.fog.far=Math.max(base.ff,d+115)}else{w.scene.fog.near=base.fn;w.scene.fog.far=base.ff}}
}
const anim={list:[],raf:0};
function tickAnim(){const t=performance.now();let live=0;
  anim.list.forEach(a=>{const k=Math.max(0,Math.min(1,(t-a.t0)/420));if(k<1)live++;a.g.visible=t>=a.t0;const e=k<1?1+2.2*Math.pow(k-1,3)+1.2*Math.pow(k-1,2):1;
    a.g.position.y=(1-Math.min(1,k*1.15))*16;a.g.scale.setScalar(.35+.65*Math.min(1.08,e))});
  BK.onAnim?.(anim.list.filter(a=>performance.now()>=a.t0+420).length,anim.list.length);
  if(live)anim.raf=requestAnimationFrame(tickAnim);else{anim.list.forEach(a=>{a.g.position.y=0;a.g.scale.setScalar(1)});anim.list=[];anim.raf=0}}
window.__pgBuild=({group,box,Group,obstacles,loc,mode})=>{
  const w=window.__pgWorld;const R=window.__pgRecipe;applyLight(w,R);if(!R)return;
  const stagger=R.__anim?Math.max(35,Math.min(90,2600/Math.max(1,R.items.length))):0;R.__anim=false;
  cancelAnimationFrame(anim.raf);anim.list=[];const t0=performance.now()+250;let k=0;
  const add=(g,parts)=>parts.forEach(p=>{const [wd,h,d,x,y,z,col,o]=p;const m=box(g,[wd,h,d],[x,y+h/2,z],col,o?.o?{transparent:true,opacity:o.o,depthWrite:false}:{});if(o?.rx)m.rotation.x=o.rx;if(o?.rz)m.rotation.z=o.rz});
  const mk=(x,z,rot)=>{const g=new Group();g.position.set(x,0,z);g.rotation.y=rot*Math.PI/180;group.add(g);if(stagger){anim.list.push({g,t0:t0+k*stagger});g.visible=false}k++;return g};
  R.items.forEach(it=>{
    if(it.c==='path'||it.c==='tiles'){const g=mk(0,0,0);const col=PAL[it.color.main];
      if(it.c==='tiles'){for(let c=it.from[0];c<=it.to[0];c++)for(let r=it.from[1];r<=it.to[1];r++)box(g,[5.6,.06,5.6],[cx(c),.15,cz(r)],(c+r)%2?col:lt(col,.1))}
      else{const [a,b]=[it.from,it.to];const x0=cx(a[0]),z0=cz(a[1]),x1=cx(b[0]),z1=cz(b[1]);
        if(x0!==x1)box(g,[Math.abs(x1-x0)+4.8,.04,4.8],[(x0+x1)/2,.16,z0],col);if(z0!==z1)box(g,[4.8,.04,Math.abs(z1-z0)+4.8],[x1,.161,(z0+z1)/2],col);if(x0===x1&&z0===z1)box(g,[4.8,.04,4.8],[x0,.16,z0],col)}
      return}
    if(it.c==='fence'){const g=mk(0,0,0);const col=PAL[it.color.main];const set=new Set(it.cells.map(p=>p.join()));
      it.cells.forEach(([c,r])=>{const x=cx(c),z=cz(r);box(g,[.7,3.6,.7],[x,1.8,z],col);
        if(set.has(`${c+1},${r}`)){box(g,[6,.5,.4],[x+3,1.4,z],dk(col,.06));box(g,[6,.5,.4],[x+3,2.7,z],dk(col,.06));box(g,[.6,3,.6],[x+3,1.5,z],col)}
        if(set.has(`${c},${r+1}`)){box(g,[.4,.5,6],[x,1.4,z-3],dk(col,.06));box(g,[.4,.5,6],[x,2.7,z-3],dk(col,.06));box(g,[.6,3,.6],[x,1.5,z-3],col)}});return}
    const g=mk(it.x,it.z,it.rot);add(g,partsOf(it));
    const d=C[it.c];const rad=it.c==='custom'?(it.top>2?CELL*it.size*.42:0):d.collide;
    if(rad){let r2=rad;NODES.forEach(([nx,nz])=>{r2=Math.min(r2,Math.hypot(nx-it.x,nz-it.z)-12.5)});if(r2>.5)obstacles.push({x:it.x,z:it.z,radius:r2,name:it.name||d.name})}
  });
  if(stagger){BK.onAnim?.(0,anim.list.length);anim.raf=requestAnimationFrame(tickAnim)}
};
/* ---------- 给大模型的提示词 ---------- */
BK.prompt=function(place,extra=''){
  const rows=Object.values(C).filter(d=>d.b).map(d=>`${d.id}｜${d.name}｜${d.size===2?'2×2 格':'1 格'}｜高 ${d.top.toFixed(1)}${d.walk?'｜可放活动区':''}｜颜色槽 ${Object.entries(d.slots).map(([k,v])=>`${k}=${v}`).join(' ')||'无'}`).join('\n');
  const sys=`你是「暖爪小镇」的积木场景设计师。用现成的 3D 方块组件，为小猫搭一个主人常去地点的「小镇版」场景。你只负责挑组件、选颜色、摆位置，不画图。
【网格】地面 15 列（c=0..14）× 13 行（r=0..12），每格 6 单位。镜头在地图右下角外侧，斜着朝左上看：左上最远，右下最近。
【分区】每格一个字母：
B 远处带：任何组件，适合放建筑、大树
S 近处带：只放高度 ≤7.6 的组件（路灯、小树、木牌这类细高的 ≤9.6 也行）
L 镜头前角：只放高度 ≤4.3 的矮组件
W 小猫活动区：只能放「可放活动区」的组件（花丛、草丛、石头、野餐垫）以及 path / tiles
N 玩法路标：什么都不能放（path / tiles 可以经过）
~ 河：什么都不能放（只有 river=true 时出现）
无河时的分区图：
${zoneMap(false)}
有河（river=true）时第 11、12 行变成河。
【组件库】id｜名称｜占地｜高度｜颜色槽（默认）
${rows}
path｜小路｜from→to 两格之间画一条地面小路（先横后竖）｜颜色槽 main=土黄
tiles｜石板地｜from→to 两格围成的矩形铺石板｜颜色槽 main=石灰
fence｜栅栏｜from→to 一条横或竖的栅栏，不能进 W/N｜颜色槽 main=米白
custom｜自定义积木｜在 1 格（6×6）或 2 格（12×12）内用小方块拼新东西，最多 3 个、每个 ≤64 块
【颜色】只能用这些颜色名：${Object.keys(PAL).join('、')}
【地面】ground 可选：${Object.keys(GROUND).join('、')}　【光线】light 可选：${Object.keys(LIGHT).join('、')}
【规则】
1. 2×2 组件的 at 是左上角那格；1 格组件 at 就是它所在格。不写 rot 时自动朝向场景中心；rot 可选 0/90/180/270。
2. 组件 10–36 个为宜；地点特色放在 B 区最显眼处（第 0–2 行或第 0–2 列）；W 区稀疏点缀，留出小猫走动空间。
3. 自定义积木 blocks 每项 [x,y,z,宽,高,深,"颜色名"]，整数，x/z 在 0..5（2 格时 0..11），y 从 0 起；用它做组件库里没有的地点标志物（如巨大咖啡杯、面碗招牌）。
4. 不要写真实店名、门牌、人名；lines 是小猫的见闻，2–3 句，每句 ≤20 字，口吻可爱。
5. 只输出一个 JSON 对象，不要解释。
【输出格式】
{"title":"场景名","ground":"草地","light":"晴天","river":false,
 "items":[{"c":"shop","at":[5,0],"color":{"main":"奶油","accent":"珊瑚"}},{"c":"tree","at":[0,3]},{"c":"path","from":[7,2],"to":[7,10]},
  {"c":"custom","name":"咖啡杯","at":[10,1],"size":1,"blocks":[[1,0,1,4,3,4,"白"],[2,3,2,2,1,2,"深木"]]}],
 "lines":["橱窗里的蛋糕好香","我在门口等你"]}`;
  const h=new Date().getHours();
  const user=`地点类型：${({work:'公司 / 写字楼',food:'小吃店 / 面馆',cafe:'咖啡店',park:'公园 / 河边步道',home:'家'})[place?.kind]||place?.kind||'街区'}
主人给它起的名字：${place?.name||'常去的地方'}
小猫会待在：${place?.catSpot||'附近'}
现在：${h<6?'凌晨':h<11?'上午':h<14?'中午':h<17?'下午':h<19?'傍晚':'晚上'}
${place?.base==='river'||/河|江|湖|海/.test(place?.name||'')?'这里有河，请设 river=true。':''}${extra?'\n主人的要求：'+extra:''}
请搭建这个地点的小镇版场景。`;
  return {system:sys,user};
};
BK.generate=async function(place,{key,model='step-3.5-flash',extra=''}={}){
  if(!key)throw new Error('请先填写 API Key');const p=BK.prompt(place,extra);
  const body={model,messages:[{role:'system',content:p.system},{role:'user',content:p.user}],temperature:.85,max_tokens:4000};
  const call=async b=>{const r=await fetch('https://api.stepfun.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(b)});
    const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j?.error?.message||('请求失败 '+r.status));return j};
  const t0=performance.now();let j;
  try{j=await call({...body,response_format:{type:'json_object'}})}catch(e){if(/response_format|json/i.test(e.message))j=await call(body);else throw e}
  const txt=j.choices?.[0]?.message?.content||'';return {text:txt,ms:Math.round(performance.now()-t0),usage:j.usage};
};
})();

/* 41-blocks-presets.js */
/* ===== v6 积木场景：示例配方（与大模型输出同一格式，人工按组件库编写） ===== */
(()=>{const BK=window.__pgBlocks;BK.PRESETS={
cafe:{title:'街角咖啡·午后',ground:'嫩草',light:'午后',items:[
 {c:'shop',at:[4,0],color:{main:'奶油',accent:'珊瑚',sign:'深木'}},
 {c:'custom',name:'大咖啡杯',at:[7,0],size:2,blocks:[[1,0,1,10,1,10,'白'],[3,1,3,6,5,6,'白'],[3,6,3,6,1,1,'白'],[3,6,8,6,1,1,'白'],[3,6,4,1,1,4,'白'],[8,6,4,1,1,4,'白'],[4,6,4,4,1,4,'深木'],[9,2,5,2,1,2,'白'],[10,3,5,1,2,2,'白'],[9,5,5,2,1,2,'白'],[5,8,5,1,2,1,'米白'],[6,10,6,1,2,1,'米白'],[5,12,6,1,1,1,'米白'],[0,0,0,12,1,1,'珊瑚'],[0,0,11,12,1,1,'珊瑚']]},
 {c:'house',at:[10,0],color:{main:'杏黄',accent:'青绿'}},
 {c:'parasol',at:[3,2],color:{main:'珊瑚',accent:'白'}},{c:'parasol',at:[9,2],color:{main:'湖蓝',accent:'白'}},
 {c:'tree',at:[1,0]},{c:'tree',at:[13,1],color:{main:'青绿'}},{c:'sapling',at:[12,2]},
 {c:'bench',at:[1,5]},{c:'lamp',at:[2,3]},{c:'lamp',at:[2,8]},{c:'bike',at:[1,10],color:{main:'湖蓝'}},{c:'vending',at:[0,7],color:{main:'珊瑚'}},
 {c:'pot',at:[6,2]},{c:'pot',at:[8,2],color:{main:'青绿',accent:'金黄'}},
 {c:'tiles',from:[3,3],to:[11,3],color:{main:'石灰'}},{c:'path',from:[7,3],to:[7,12]},
 {c:'flowers',at:[4,9]},{c:'flowers',at:[11,8],color:{main:'淡紫',accent:'白'}},{c:'grass',at:[9,7]},{c:'grass',at:[3,6]},
 {c:'bin',at:[12,6]},{c:'lamp',at:[12,8]},{c:'cone',at:[13,11]},{c:'mailbox',at:[3,11]},{c:'bush',at:[9,11]},{c:'bush',at:[5,11]}],
 lines:['橱窗里的蛋糕好香','我在遮阳伞下等你','店员姐姐冲我笑了']},
work:{title:'公司楼下·小花坛',ground:'广场',light:'晴天',items:[
 {c:'office',at:[2,0],color:{main:'雾蓝',accent:'奶油'}},{c:'office',at:[9,0],color:{main:'石灰',accent:'珊瑚'}},
 {c:'custom',name:'小花坛',at:[5,1],size:2,blocks:[[0,0,0,12,1,12,'石灰'],[1,1,1,10,1,10,'深木'],[2,2,2,3,2,3,'青绿'],[7,2,2,3,2,3,'青绿'],[2,2,7,3,2,3,'草绿'],[7,2,7,3,2,3,'草绿'],[5,2,5,2,3,2,'桃粉'],[3,4,3,1,1,1,'金黄'],[8,4,8,1,1,1,'珊瑚'],[8,4,3,1,1,1,'白'],[3,4,8,1,1,1,'淡紫'],[5,5,5,2,1,2,'金黄']]},
 {c:'pine',at:[0,0]},{c:'tree',at:[13,0]},{c:'sapling',at:[7,0]},{c:'sapling',at:[12,2]},
 {c:'busstop',at:[1,6],color:{main:'湖蓝',accent:'金黄'}},{c:'bench',at:[1,4]},{c:'vending',at:[0,9],color:{main:'雾蓝'}},
 {c:'bike',at:[2,10]},{c:'bike',at:[1,11],color:{main:'金黄'}},{c:'lamp',at:[2,3]},{c:'lamp',at:[12,3]},{c:'lamp',at:[12,8]},
 {c:'flowers',at:[4,9]},{c:'flowers',at:[11,3],color:{main:'金黄',accent:'白'}},{c:'pot',at:[12,5]},{c:'pot',at:[12,6],color:{main:'青绿',accent:'金黄'}},
 {c:'bin',at:[13,7]},{c:'cone',at:[13,10]},{c:'hydrant',at:[12,10]},{c:'mailbox',at:[3,10]},{c:'sign',at:[8,10],color:{main:'奶油',accent:'雾蓝'}},
 {c:'tiles',from:[3,3],to:[11,3],color:{main:'米白'}}],
 lines:['你在楼上忙吗？','花坛里有只小蜜蜂','我在楼下等你下班']},
noodle:{title:'巷口面馆·傍晚',ground:'草地',light:'黄昏',items:[
 {c:'shop',at:[4,0],color:{main:'米白',accent:'砖红',sign:'金黄'}},
 {c:'custom',name:'大面碗招牌',at:[6,0],size:2,blocks:[[2,0,2,8,1,8,'砖红'],[1,1,1,10,3,10,'砖红'],[0,4,0,12,1,12,'白'],[1,5,1,10,1,10,'金黄'],[3,6,3,6,1,6,'杏黄'],[7,6,7,2,1,2,'白'],[4,7,4,1,1,1,'草绿'],[6,7,5,1,1,1,'草绿'],[9,6,2,1,8,1,'深木'],[10,6,3,1,8,1,'深木']]},
 {c:'house',at:[9,0],color:{main:'杏黄',accent:'深绿'}},{c:'tree',at:[0,0]},{c:'pine',at:[12,0]},{c:'tree',at:[13,2],color:{main:'青绿'}},
 {c:'stall',at:[2,2],color:{main:'奶油',accent:'砖红'}},{c:'lantern',at:[3,2]},{c:'lantern',at:[8,2]},{c:'bench',at:[11,2]},
 {c:'crate',at:[1,4]},{c:'bike',at:[1,6],color:{main:'青绿'}},{c:'cathouse',at:[2,9],color:{main:'奶油',accent:'砖红'}},{c:'bin',at:[0,8]},
 {c:'kiosk',at:[0,10],color:{main:'深绿',accent:'奶油'}},{c:'mailbox',at:[12,4]},{c:'pot',at:[12,7]},{c:'hydrant',at:[12,9]},{c:'lamp',at:[2,4]},
 {c:'path',from:[7,2],to:[7,12]},{c:'tiles',from:[3,3],to:[11,3],color:{main:'土黄'}},
 {c:'grass',at:[4,8]},{c:'flowers',at:[10,9],color:{main:'金黄',accent:'珊瑚'}},{c:'cone',at:[13,11]}],
 lines:['汤的香味飘出来了','老板给了我一小块鱼','我在台阶上等你吃完']},
river:{title:'河边步道·微风',ground:'嫩草',light:'晴天',river:true,items:[
 {c:'path',from:[0,9],to:[14,9],color:{main:'杏黄'}},
 {c:'bench',at:[4,10],rot:180},{c:'bench',at:[9,10],rot:180},{c:'lamp',at:[6,10]},{c:'lamp',at:[11,10]},
 {c:'reeds',at:[3,10]},{c:'reeds',at:[8,10]},{c:'reeds',at:[12,10]},{c:'reeds',at:[1,10]},
 {c:'pavilion',at:[5,1],color:{main:'青绿'}},{c:'house',at:[9,0],color:{main:'米白',accent:'湖蓝'}},
 {c:'tree',at:[0,0]},{c:'tree',at:[3,0],color:{main:'青绿'}},{c:'pine',at:[12,0]},{c:'sapling',at:[8,2]},{c:'tree',at:[14,2]},
 {c:'fence',from:[2,3],to:[2,8],color:{main:'米白'}},{c:'sign',at:[1,4],color:{main:'奶油',accent:'湖蓝'}},{c:'bike',at:[1,8]},
 {c:'flowers',at:[4,5]},{c:'flowers',at:[10,8],color:{main:'淡紫',accent:'白'}},{c:'rock',at:[7,7]},{c:'grass',at:[5,9]},{c:'picnic',at:[8,6],color:{main:'湖蓝'}},
 {c:'bush',at:[12,5]},{c:'bush',at:[12,7],color:{main:'草绿'}}],
 lines:['河面上有亮晶晶的光','芦苇里藏着小鸭子','我们沿着步道慢慢走']},
park:{title:'街心公园·晴',ground:'深草',light:'晴天',items:[
 {c:'fountain',at:[6,0]},{c:'pavilion',at:[10,0],color:{main:'砖红'}},{c:'slide',at:[2,1]},{c:'swing',at:[4,1]},
 {c:'tree',at:[0,0]},{c:'tree',at:[13,0],color:{main:'青绿'}},{c:'tree',at:[0,4]},{c:'pine',at:[12,2]},{c:'pine',at:[1,7]},{c:'pine',at:[0,11]},
 {c:'pond',at:[1,9]},{c:'bench',at:[9,2]},{c:'bench',at:[5,2]},{c:'lamp',at:[3,2]},{c:'lamp',at:[8,2]},
 {c:'path',from:[7,2],to:[7,12]},{c:'path',from:[0,6],to:[14,6]},
 {c:'flowers',at:[5,5]},{c:'flowers',at:[9,8],color:{main:'金黄',accent:'白'}},{c:'flowers',at:[4,9],color:{main:'淡紫',accent:'金黄'}},{c:'grass',at:[6,3]},
 {c:'rock',at:[11,9]},{c:'picnic',at:[9,4]},{c:'bush',at:[4,10]},{c:'bush',at:[8,10],color:{main:'草绿'}},
 {c:'sign',at:[12,4],color:{main:'奶油',accent:'草绿'}},{c:'cathouse',at:[12,8]},{c:'bin',at:[13,9]}],
 lines:['草坪软软的好舒服','喷泉溅到我胡子了','秋千好像在等你']}
};})();

/* 42-blocks-ui.js */
/* ===== v6 积木场景工坊：示例配方 / 大模型生成 / 粘贴 JSON → 校验 → 搭建 ===== */
(()=>{
const BK=window.__pgBlocks,L=window.__pgLife||{};const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const track=(n,p)=>{try{window.__petAnalytics?.track(n,p)}catch(e){}};
const petName=()=>{try{return window.__petGame.state().pet.name}catch{return '小橘'}};
const toast=m=>L.toast?L.toast(m):console.log(m);
/* ---------- 本机缓存：每个地点只生成一次 ---------- */
const KEY='pg_bk_v1',KK='pg_bk_key';
const st=(()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch{return {}}})();st.r=st.r||{};
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st))}catch{}};
const KIND2PRE={work:'work',food:'noodle',cafe:'cafe',park:'park'};
const places=()=>(L.places?L.places():[]).filter(p=>p.id!=='home');
const placeOf=id=>places().find(p=>p.id===id)||{id,name:id,kind:'park'};
function entry(id){const e=st.r[id];if(e)return e;const p=placeOf(id);const pre=BK.PRESETS[id]||BK.PRESETS[KIND2PRE[p.kind]]||BK.PRESETS.park;return {raw:pre,src:'preset'}}
BK.recipeFor=id=>BK.validate(entry(id).raw);
/* ---------- 去地点时按配方搭建 ---------- */
let cur=null;
document.addEventListener('click',e=>{const g=e.target.closest('[data-go]');if(!g)return;const v=BK.recipeFor(g.dataset.go);
  if(v.ok){window.__pgRecipe=v.recipe;v.recipe.__anim=true;cur={id:g.dataset.go,v};hud._said=0}
  const sh=$('m-sheet');if(sh&&sh.dataset.mode==='world'&&!sh.classList.contains('m-collapsed')&&g.closest('#m-sheet'))setTimeout(()=>$('m-sheet-close')?.click(),60)},true);
document.addEventListener('click',e=>{const b=e.target.closest('[data-location]');if(b&&e.isTrusted&&!b.dataset.bk){window.__pgRecipe=null;cur=null;hud.hidden=true;fab.hidden=true}},true);
new MutationObserver(()=>{if(document.body.dataset.view!=='world'&&window.__pgRecipe){window.__pgRecipe=null;cur=null;hud.hidden=true;fab.hidden=true}}).observe(document.body,{attributes:true,attributeFilter:['data-view']});
const ws=$('world-scene');
const hud=document.createElement('div');hud.id='bk-hud';hud.hidden=true;ws?.appendChild(hud);
const fab=document.createElement('button');fab.type='button';fab.id='bk-fab';fab.hidden=true;fab.innerHTML='🧱 换个搭法';ws?.appendChild(fab);
fab.addEventListener('click',()=>openW(cur?.id));
BK.onAnim=(n,tot)=>{if(!cur||!window.__pgRecipe)return;hud.hidden=false;fab.hidden=false;
  if(n<tot){hud.innerHTML=`<b>🧱 正在用积木搭「${esc(window.__pgRecipe.title||'小镇一角')}」</b><span>${n} / ${tot}</span><i style="--k:${(n/tot).toFixed(3)}"></i>`;hud.classList.remove('done')}
  else{hud.innerHTML=`<b>🧱 ${esc(window.__pgRecipe.title||'搭好啦')}</b><span>${tot} 个组件</span>`;hud.classList.add('done');clearTimeout(hud._t);hud._t=setTimeout(()=>hud.hidden=true,2600);
    const ln=window.__pgRecipe.lines?.[0];if(ln&&!hud._said){hud._said=1;setTimeout(()=>toast(`${petName()}：${ln}`),600)}}};
/* ---------- 工坊浮层 ---------- */
const ov=document.createElement('div');ov.id='bk-ov';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','积木场景工坊');
ov.innerHTML=`<div class="bk-box"><header class="bk-head"><div><b>🧱 积木场景工坊</b><small>AI 只挑积木、摆位置，画风由组件库统一</small></div><button type="button" class="bk-x" aria-label="关闭">×</button></header>
<div class="bk-places" id="bk-places"></div>
<div class="bk-main"><div class="bk-mapwrap"><canvas id="bk-map" width="450" height="390" aria-label="场景俯视图"></canvas><div class="bk-legend"><span><i class="z-B"></i>远处带</span><span><i class="z-S"></i>近处带</span><span><i class="z-W"></i>小猫活动区</span><span><i class="z-N"></i>玩法路标</span></div></div>
<div class="bk-info" id="bk-info"></div></div>
<nav class="bk-tabs"><button type="button" data-src="ai">让 AI 生成</button><button type="button" data-src="paste">粘贴配方</button><button type="button" data-src="preset">示例配方</button><button type="button" data-src="lib">组件库</button></nav>
<div class="bk-pane" id="bk-pane"></div></div>`;
document.body.appendChild(ov);
let pid='cafe',pane='ai',busy=false;
const close=()=>ov.classList.remove('on');
ov.querySelector('.bk-x').addEventListener('click',close);
ov.addEventListener('click',e=>{if(e.target===ov)close()});
addEventListener('keydown',e=>{if(e.key==='Escape'&&ov.classList.contains('on'))close()});
function openW(id){const ps=places();pid=id&&ps.some(p=>p.id===id)?id:(ps.some(p=>p.id===pid)?pid:ps[0]?.id||'cafe');ov.classList.add('on');render();track('blocks_open',{id:pid})}
BK.open=openW;
const SRC={preset:'示例配方',ai:'AI 生成',paste:'粘贴配方'};
function render(){
  $('bk-places').innerHTML=places().map(p=>`<button type="button" data-pid="${p.id}" aria-pressed="${p.id===pid}">${p.icon||'📍'} ${esc(p.name)}${st.r[p.id]?'<i>✦</i>':''}</button>`).join('');
  const e=entry(pid),v=BK.validate(e.raw);drawMap(v);
  const info=$('bk-info');
  if(!v.ok){info.innerHTML=`<p class="bk-err">${esc(v.error)}</p>`;}
  else{const R=v.recipe;info.innerHTML=`<div class="bk-title"><b>${esc(R.title||'未命名场景')}</b><span class="bk-src ${e.src}">${SRC[e.src]||e.src}${e.model?' · '+esc(e.model):''}</span></div>
    <div class="bk-meta">${R.ground} · ${R.light}${R.river?' · 有河':''} · ${v.stats.items} 个组件${v.stats.custom?` · 自定义 ${v.stats.custom} 个（${v.stats.blocks} 块）`:''}${e.ms?` · 用时 ${(e.ms/1000).toFixed(1)} 秒`:''}</div>
    ${R.lines.length?`<ul class="bk-lines">${R.lines.map(l=>`<li>🐾 ${esc(l)}</li>`).join('')}</ul>`:''}
    <details class="bk-fix" ${v.fix.length?'':'hidden'}><summary>自动修正 ${v.fix.length} 处</summary><ul>${v.fix.map(f=>`<li>${esc(f)}</li>`).join('')}</ul></details>
    ${v.fix.length?'':'<p class="bk-ok">✓ 校验通过，无需修正</p>'}
    <div class="bk-row"><button type="button" class="g-btn" data-act="go">带${esc(petName())}去看看</button>${st.r[pid]?'<button type="button" class="g-btn ghost" data-act="reset">恢复示例</button>':''}</div>`}
  ov.querySelectorAll('[data-src]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.src===pane)));
  renderPane();
}
function renderPane(){const P=$('bk-pane');const key=sessionStorage.getItem(KK)||localStorage.getItem(KK)||'';
  if(pane==='ai')P.innerHTML=`<div class="bk-form"><label>模型<select id="bk-model">${['step-3.5-flash','step-3.7-flash','step-5-preview'].map(m=>`<option ${m===(st.model||'step-3.5-flash')?'selected':''}>${m}</option>`).join('')}</select></label>
    <label>API Key<input id="bk-key" type="password" autocomplete="off" placeholder="阶跃星辰开放平台的 Key" value="${esc(key)}"></label>
    <label class="bk-chk"><input type="checkbox" id="bk-remember" ${localStorage.getItem(KK)?'checked':''}> 记住在本机浏览器</label>
    <label class="bk-wide">想要的感觉（可选）<input id="bk-extra" placeholder="例如：下过雨、樱花季、像宫崎骏的小镇" maxlength="40"></label></div>
    <div class="bk-row"><button type="button" class="g-btn" data-act="gen" ${busy?'disabled':''}>${busy?'生成中…':'✨ 生成场景'}</button><button type="button" class="g-btn ghost" data-act="copy">复制提示词</button></div>
    <p class="bk-note" id="bk-status">只发送地点类型、你起的名字和时间段，不发送坐标。生成结果会缓存在本机，同一地点不用重复调用。</p>`;
  if(pane==='paste')P.innerHTML=`<textarea id="bk-json" spellcheck="false" placeholder='把模型输出的 JSON 粘贴到这里，例如 {"title":"…","items":[…]}'></textarea>
    <div class="bk-row"><button type="button" class="g-btn" data-act="apply">校验并使用</button><button type="button" class="g-btn ghost" data-act="copy">复制提示词</button><button type="button" class="g-btn ghost" data-act="export">导出当前配方</button></div>
    <p class="bk-note">也可以把「复制提示词」贴到阶跃星辰网页版对话里，再把回复粘贴回来。</p>`;
  if(pane==='preset')P.innerHTML=`<p class="bk-note">示例配方和大模型输出是同一种格式，由人工按组件库编写，用来对照模型效果。</p><div class="bk-pre">${Object.entries(BK.PRESETS).map(([k,r])=>`<button type="button" data-pre="${k}">${esc(r.title)}</button>`).join('')}</div>`;
  if(pane==='lib'){const g={};Object.values(BK.C).forEach(d=>(g[d.cat]=g[d.cat]||[]).push(d));
    P.innerHTML=`<div class="bk-lib">${Object.entries(g).map(([k,a])=>`<div><b>${k}</b>${a.map(d=>`<span title="${d.id}">${d.name}<small>${d.id}</small></span>`).join('')}</div>`).join('')}</div>
    <div class="bk-row"><button type="button" class="g-btn ghost" data-act="catalog">在户外看全部组件</button></div><p class="bk-note">颜色只能从 ${Object.keys(BK.PAL).length} 个色板颜色里选，地面 ${Object.keys(BK.GROUND).length} 种、光线 ${Object.keys(BK.LIGHT).length} 种。</p>`}
}
ov.addEventListener('click',async e=>{
  const pb=e.target.closest('[data-pid]');if(pb){pid=pb.dataset.pid;render();return}
  const sb=e.target.closest('[data-src]');if(sb){pane=sb.dataset.src;render();return}
  const pr=e.target.closest('[data-pre]');if(pr){st.r[pid]={raw:BK.PRESETS[pr.dataset.pre],src:'preset',t:Date.now()};save();render();return}
  const a=e.target.closest('[data-act]')?.dataset.act;if(!a)return;
  if(a==='go'){close();goTo(pid)}
  if(a==='reset'){delete st.r[pid];save();render()}
  if(a==='copy'){const p=BK.prompt(placeOf(pid),$('bk-extra')?.value||'');const t=`【系统】\n${p.system}\n\n【用户】\n${p.user}`;try{await navigator.clipboard.writeText(t);toast('提示词已复制')}catch{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('提示词已复制')}}
  if(a==='export'){$('bk-json').value=JSON.stringify(entry(pid).raw,null,1)}
  if(a==='apply'){const v=BK.validate($('bk-json').value);if(!v.ok){toast(v.error);return}st.r[pid]={raw:BK.parse($('bk-json').value),src:'paste',t:Date.now()};save();render();toast('配方已保存，可以带小猫去看看');track('blocks_paste',{id:pid,fix:v.fix.length})}
  if(a==='gen'){const key=$('bk-key').value.trim();const model=$('bk-model').value;st.model=model;save();
    if($('bk-remember').checked)localStorage.setItem(KK,key);else{localStorage.removeItem(KK);sessionStorage.setItem(KK,key)}
    busy=true;renderPane();$('bk-status').textContent=`正在请 ${model} 搭场景…`;
    try{const r=await BK.generate(placeOf(pid),{key,model,extra:$('bk-extra')?.value||''});const v=BK.validate(r.text);
      if(!v.ok)throw new Error('模型输出无法解析：'+v.error);
      st.r[pid]={raw:BK.parse(r.text),src:'ai',model,ms:r.ms,t:Date.now(),usage:r.usage};save();busy=false;render();
      toast(`生成完成，用时 ${(r.ms/1000).toFixed(1)} 秒${v.fix.length?`，自动修正 ${v.fix.length} 处`:''}`);track('blocks_gen',{id:pid,model,ms:r.ms,fix:v.fix.length,items:v.stats.items})}
    catch(err){busy=false;renderPane();$('bk-status').textContent='生成失败：'+err.message;track('blocks_gen_fail',{model,msg:String(err.message).slice(0,60)})}}
  if(a==='catalog'){close();catalog()}
});
function goTo(id){const btn=document.querySelector(`#pg-wplaces [data-go="${id}"]`);
  if(btn){if(document.body.dataset.view!=='world'){document.querySelector('.town-nav button[data-view="world"]')?.click();setTimeout(()=>btn.click(),600)}else btn.click()}
  else{const v=BK.recipeFor(id);window.__pgRecipe=v.recipe;v.recipe.__anim=true;cur={id,v};document.querySelector('[data-location="garden"]')?.click()}}
BK.goTo=goTo;
/* ---------- 俯视图 ---------- */
const ZC={B:'#efe4cf',S:'#f3ecdc',L:'#f6f1e6',W:'#e3eedb',N:'#f6d9b8','~':'#cfe3e6'};
function drawMap(v){const cv=$('bk-map'),g=cv.getContext('2d'),{COLS,ROWS}=BK.grid,s=30;g.clearRect(0,0,cv.width,cv.height);
  const R=v.ok?v.recipe:{river:false,items:[]};
  for(let c=0;c<COLS;c++)for(let r=0;r<ROWS;r++){g.fillStyle=ZC[BK.grid.zone(c,r,R.river)];g.fillRect(c*s+.5,r*s+.5,s-1,s-1)}
  R.items.forEach(it=>{const col=BK.PAL[it.color?.main]||'#cbb89a';
    if(it.c==='tiles'){g.fillStyle=col+'cc';g.fillRect(it.from[0]*s+3,it.from[1]*s+3,(it.to[0]-it.from[0]+1)*s-6,(it.to[1]-it.from[1]+1)*s-6);return}
    if(it.c==='path'){g.strokeStyle=col;g.lineWidth=12;g.lineCap='round';g.beginPath();g.moveTo(it.from[0]*s+s/2,it.from[1]*s+s/2);g.lineTo(it.to[0]*s+s/2,it.from[1]*s+s/2);g.lineTo(it.to[0]*s+s/2,it.to[1]*s+s/2);g.stroke();return}});
  R.items.forEach(it=>{if(it.c==='tiles'||it.c==='path')return;const col=BK.PAL[it.color?.main]||'#cbb89a';
    if(it.c==='fence'){g.fillStyle=col;it.cells.forEach(([c,r])=>g.fillRect(c*s+11,r*s+11,8,8));return}
    const x=it.at[0]*s+3,y=it.at[1]*s+3,w=it.size*s-6;g.fillStyle=col;g.strokeStyle='#5b4632aa';g.lineWidth=1.5;g.beginPath();g.roundRect?g.roundRect(x,y,w,w,6):g.rect(x,y,w,w);g.fill();g.stroke();
    g.fillStyle='#4a3a2a';g.font=`${it.size===2?13:11}px sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillText((it.name||BK.C[it.c].name).slice(0,it.size===2?4:2),x+w/2,y+w/2)});
  g.fillStyle='#8a6a4a';g.font='11px sans-serif';g.textAlign='right';g.fillText('镜头 ↘',cv.width-4,cv.height-6);
}
/* ---------- 组件库一览（开发用） ---------- */
function catalog(){const ids=Object.values(BK.C).filter(d=>d.b);const big=ids.filter(d=>d.size===2),small=ids.filter(d=>d.size===1);
  const items=[];big.forEach((d,i)=>items.push({c:d.id,at:[1+i*2+(i>2?1:0),0],rot:180}));let k=0;
  for(let r=3;r<=11&&k<small.length;r+=2)for(let c=1;c<=13&&k<small.length;c+=2)items.push({c:small[k++].id,at:[c,r],rot:180});
  const R={title:'组件库一览',ground:'草地',light:'晴天',river:false,lines:[],items:items.map(it=>{const d=BK.C[it.c];const sz=d.size;const x=(BK.grid.cx(it.at[0])+BK.grid.cx(it.at[0]+sz-1))/2,z=(BK.grid.cz(it.at[1])+BK.grid.cz(it.at[1]+sz-1))/2;
    return {...it,size:sz,x,z,rot:180,color:Object.fromEntries(Object.entries(d.slots)),top:d.top}}),grassHex:BK.GROUND['草地'],__anim:true,__catalog:true};
  const go=()=>{window.__pgRecipe=R;window.__pgPlace={id:'catalog',name:'组件库一览'};cur={id:'catalog'};document.querySelector('[data-location="garden"]')?.dispatchEvent(new MouseEvent('click',{bubbles:true}))};
  if(document.body.dataset.view!=='world'){document.querySelector('.town-nav button[data-view="world"]')?.click();setTimeout(go,600)}else go();}
BK.catalog=catalog;
/* ---------- 入口：出门面板 + 常去地点卡片 ---------- */
const wp=$('world-panel');
if(wp){const b=document.createElement('button');b.type='button';b.id='bk-entry';b.className='g-btn ghost';b.innerHTML='🧱 积木场景工坊 · AI 搭场景';(($('pg-wplaces'))||wp.querySelector('.location-tabs'))?.after(b);b.addEventListener('click',()=>openW())}
const lov=$('life-ov');
if(lov){new MutationObserver(()=>{lov.querySelectorAll('[data-go]').forEach(g=>{if(g.nextElementSibling?.dataset?.bkp||g.closest('#pg-wplaces'))return;const b=document.createElement('button');b.type='button';b.className='g-btn ghost';b.dataset.bkp=g.dataset.go;b.textContent='🧱 场景';g.after(b)})}).observe(lov,{childList:true,subtree:true});
  lov.addEventListener('click',e=>{const b=e.target.closest('[data-bkp]');if(b){lov.classList.remove('on');openW(b.dataset.bkp)}})}
})();
