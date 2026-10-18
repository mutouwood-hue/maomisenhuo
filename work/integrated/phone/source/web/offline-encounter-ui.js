/* Presentation only for the original social-v7 DOM; no store, radio or gameplay calls. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.CatOfflineEncounterUI=api;api.install(root);}})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const copy=Object.freeze({
  '双方长按实体键 1 秒进入「对暗号」（15 秒内有效），轻点圆屏就是敲':'长按右侧「键」1 秒进入，再轻点圆屏敲暗号。15 秒内有效。',
  '一人敲、一人跟：先敲的人敲 4–8 下，停 1.2 秒算敲完；跟的人 5 秒内跟上。电脑可按空格键敲。':'一人先敲 4–8 下，停 1.2 秒即结束；另一方在 5 秒内跟上。电脑可用空格键。',
  '钟面 8 个点 + 中心 1 个点，顺序一致即匹配，至少 4 个点。连出爱心 / 星星有彩蛋。':'连接至少 4 个点，顺序相同即可匹配。圆屏有 8 个边点和 1 个中心点；爱心、星星有彩蛋。'
 });
 function decorate(w){
  const d=w.document,social=w.__pgSocial,banner=d.getElementById('sc-banner');
  if(banner&&!banner.hidden){
   const peer=social?.peers?.get(banner.dataset.fid)||social?.NPCS?.find(p=>p.fid===banner.dataset.fid);
   if(peer&&(peer.src==='npc'||social?.NPCS?.some(p=>p.fid===peer.fid))){
    const title=banner.querySelector('b'),small=banner.querySelector('div > small:not(.offline-test-mode)');
    if(title?.textContent.startsWith('附近 3 米内有一只'))title.textContent=title.textContent.replace('附近 3 米内有一只','附近来了一只');
    if(small&&/^约 [\d.]+ 米 · /.test(small.textContent))small.textContent=small.textContent.replace(/^约 ([\d.]+) 米 · /,'游戏内约 $1 米 · ');
   }
  }
  const meet=d.getElementById('sc-meet');if(!meet)return;
  const hint=d.getElementById('sc-hint');meet.setAttribute('aria-describedby','sc-hint');
  const npc=social?.M?.peer?.src==='npc';
  if(npc){
   for(const node of meet.querySelectorAll('#sc-hint,#sc-mact > .sc-small'))if(copy[node.textContent])node.textContent=copy[node.textContent];
  }
  // Wrap the original result text nodes, without re-parsing their content or
  // changing any button, pet art, friend, gift, or confirmation state.
  for(const li of meet.querySelectorAll('.sc-res li')){
   if(li.querySelector('.offline-result-copy'))continue;
   const icon=li.firstElementChild,span=d.createElement('span');span.className='offline-result-copy';
   for(const child of [...li.childNodes])if(child!==icon)span.append(child);
   li.append(span);
  }
  if(hint){const empty=!hint.textContent.trim();if(hint.hidden!==empty)hint.hidden=empty;}
 }
 function install(w){
  if(!w.document||w.__catEncounterUIInstalled)return;w.__catEncounterUIInstalled=true;let pending=false;
  const update=()=>{pending=false;decorate(w);};
  const observer=new w.MutationObserver(()=>{if(!pending){pending=true;w.requestAnimationFrame(update);}});
  observer.observe(w.document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','hidden','data-fid']});
  w.addEventListener('pagehide',()=>observer.disconnect(),{once:true});update();
 }
 return {copy,decorate,install};
});
