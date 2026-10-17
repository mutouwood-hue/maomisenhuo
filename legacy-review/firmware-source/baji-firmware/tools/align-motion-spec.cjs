const fs=require('fs');
const base='_ref/baji-spec/吧唧交互规范/';
const p=base+'badge_spec.json',h=base+'吧唧渲染参考.html';
const s=JSON.parse(fs.readFileSync(p,'utf8'));
const centers=[132,112,93,74,54];
s.screens.main_a.els.filter(e=>e.t==='arc').forEach((e,i)=>{e.w=7;e.a0=centers[i]-15;e.a1=centers[i]+15;});
const xs=[101,189,277,365];
s.screens.care_menu.els.filter(e=>e.t==='btn').forEach((e,i)=>{e.x=xs[i];e.r=38;});
s.screens.care_menu.els.filter(e=>e.care&&e.t==='label').forEach((e,i)=>e.x=xs[i]);
fs.writeFileSync(p,JSON.stringify(s,null,1)+'\n');
let t=fs.readFileSync(h,'utf8');
t=t.replace('const carePos=[[105,252],[190,252],[276,252],[361,252]];', 'const carePos=[[101,252],[189,252],[277,252],[365,252]];');
t=t.replace("x,y,r:36,icon:careIco[k]", "x,y,r:38,icon:careIco[k]");
// Preserve the reference as received outside the layout table; generator/checker
// detect any remaining layout discrepancy instead of suppressing it.
fs.writeFileSync(h,t);
