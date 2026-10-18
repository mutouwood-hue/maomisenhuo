/* Original social-v7 UI functions, explicit in-memory peers/graphics stand-ins.
   No original transaction, grant, timing or phone save is executed. */
const fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),original=fs.readFileSync(root+'/original/game.html','utf8'),social=fs.readFileSync(root+'/android/app/src/main/assets/game-08.js','utf8');
function fixture({keyInput=false}={}){
 const dom=new JSDOM(fs.readFileSync(root+'/android/app/src/main/assets/index.html','utf8'),{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 const section=social.slice(social.indexOf('let M=null;'),social.indexOf('/* ---------- 敲暗号 ---------- */'));
 const rUI=social.slice(social.indexOf('function rUI(){'),social.indexOf('function pulse('));
 const input=social.slice(social.indexOf('let M=null;'),social.indexOf('function tap(){'));
 w.CatOfflineMeetKey=require('../web/offline-meet-key.js');
 const npc=social.slice(social.indexOf('const NPCS=['),social.indexOf('/* ---------- 性格：'));
 w.eval(`const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
 const P=()=>({breed:'orange',outfit:'none'}),D={friends:{},cfg:{fate:false}},REGIONS={};
 const BN=id=>({ragdoll:'布偶猫',siamese:'暹罗猫',blue:'英短蓝猫',tuxedo:'奶牛猫'}[id]||id);
 const petImg=()=>'<span class="original-art-placeholder" aria-label="原像素猫未替换">原头像</span>',track=()=>{},send=()=>{},toast=()=>{},lvl=()=>({lv:1}),ago=()=>'',stopFate=()=>{},stopScan=()=>{},vib=()=>{},tone=()=>{};
 ${npc}
 const peers=new Map(NPCS.map(n=>[n.fid,{...n,src:'npc',dist:1.2}]));
 const banner=document.createElement('div');banner.id='sc-banner';banner.hidden=true;document.body.append(banner);
 ${keyInput?input:'const keyControl={cancel(){}};\n'+section+'\n'+rUI}
 function tap(){window.__unexpectedTaps=(window.__unexpectedTaps||0)+1;}
 window.__pgSocial={NPCS,peers,openMeet,closeMeet,resetGame,get M(){return M}};
 `);
 const rail=d.getElementById('m-rail');
 for(const [attr,value,label]of [['data-life','1','◔生活'],['data-social','dex','▦图鉴'],['data-social','near','◎遇见']]){const b=d.createElement('button');b.type='button';b.setAttribute(attr,value);b.innerHTML='<span aria-hidden="true">'+label[0]+'</span>'+label.slice(1);rail.prepend(b);}
 const badge=d.createElement('button');badge.textContent='吧唧';rail.append(badge);
 w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollIntoView=()=>{};w.requestAnimationFrame=fn=>{queueMicrotask(fn);return 1;};
 w.eval(fs.readFileSync(root+'/web/offline-layout.js','utf8'));
 const ui=require('../web/offline-encounter-ui.js');
 return {w,d,ui,original,social,open(){w.__pgSocial.openMeet('npc-pudding');ui.decorate(w);},close(){w.dispatchEvent(new w.Event('pagehide'));dom.window.close();}};
}
module.exports={fixture,root};
