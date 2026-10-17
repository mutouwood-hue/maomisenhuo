/* Decorative page actions only. No store, permissions, timers or device calls. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.CatOfflinePageIcons=api;api.install(root);}})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const rules=[
  ['#offline-world-home,#world-home,.world-return','home'],['#offline-world-options','trip'],['.world-roam',b=>b.getAttribute('aria-pressed')==='true'?'recall':'roam'],
  ['#world-panel [data-location]','globe'],['#world-panel [data-world-mode]',b=>({walk:'walk',explore:'explore',fish:'fish'}[b.dataset.worldMode])],['#world-bag button','coin'],
  ['#pg-think [data-a="view"]','camera'],['#pg-think [data-a="rest"],#cancel-interaction','rest'],
  ['#visit-clinic','clinic'],
  ['.world-fishing button','fish'],
  ['#offline-device-primary,#offline-v2-scan','search'],['#offline-device-start','start'],['#offline-device-disconnect,#offline-v2-disconnect','disconnect'],['#offline-v2-retry','reset'],['#offline-device-list button,#offline-v2-list button','link'],
  ['#sc-hub button[data-htab]',b=>({near:'meet',friends:'friend',gifts:'gift',world:'globe',dex:'dex',settings:'settings'}[b.dataset.htab])],
  ['#sc-hub button[data-h]',b=>({spawn:'search',code:'qr',slotb:'players',echo:'footprint',wroom:'home',wipe:'shield'}[b.dataset.h])],
  ['#sc-hub [data-meet],#offline-notifications #sc-banner [data-bmeet]','meet'],['#sc-hub [data-pick]','pickup'],
  ['#sc-hub [data-egg],#sc-hub [data-claim]','egg'],['#sc-hub [data-contact]','friend'],['#sc-hub [data-unf],#sc-hub [data-block],#sc-hub [data-report],#sc-hub [data-unblock]','shield'],
  ['#sc-hub [data-open],#sc-hub [data-prep]','gift'],['#sc-hub button[data-we]',b=>({shuf:'shuffle',reset:'reset',hide:'trip'}[b.dataset.we])]
 ];
 const leading=/^\s*(?:🔍|📷|👥|⌂|🎥|🏠|🐾|🥚|🐣|📇|🎲|↺)\s*/u;
 function decorate(w){const d=w.document,icons=w.CatOfflineIcons;if(!icons)return;
  const seen=new Set();
  function add(node,key,{status=false,slot=null}={}){if(!node||!key||seen.has(node))return;seen.add(node);
   if(slot){if(slot.dataset.pageIcon!==key){slot.innerHTML=icons.svg(key,26);slot.dataset.pageIcon=key;}if(node.matches('#m-rail button,.town-nav button')){if(!slot.classList.contains('offline-icon-slot'))slot.classList.add('offline-icon-slot');if(node.dataset.offlineIcon!==key)node.dataset.offlineIcon=key;}return;}
   if(node.matches('.world-roam,.world-return,.world-rod')){
    if(!node.classList.contains('offline-persistent-icon')){
     node.querySelector(':scope > .offline-action-icon')?.remove();
     node.classList.add('offline-page-action','offline-persistent-icon');
     const cssImage=name=>'url("data:image/svg+xml,'+encodeURIComponent(icons.svg(name,24))+'")';
     if(node.matches('.world-roam')){node.style.setProperty('--offline-roam-image',cssImage('roam'));node.style.setProperty('--offline-recall-image',cssImage('recall'));}
     else node.style.setProperty('--offline-action-image',cssImage(key));
    }
    return;
   }
   let glyph=node.querySelector(':scope > .offline-action-icon');if(glyph?.dataset.pageIcon===key){return;}
   if(!glyph){glyph=d.createElement('span');glyph.className='offline-action-icon';glyph.setAttribute('aria-hidden','true');node.prepend(glyph);}
   glyph.innerHTML=icons.svg(key,24);glyph.dataset.pageIcon=key;
   node.classList.add(status?'offline-page-status':'offline-page-action');
   for(const child of node.childNodes){if(child.nodeType===3&&child.textContent.trim()){child.textContent=child.textContent.replace(leading,'');break;}}
   if(node.matches('#pg-think [data-a="view"]')){node.setAttribute('aria-label','换个视角');if(![...node.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))node.append(d.createTextNode('视角'));}
  }
  for(const node of d.querySelectorAll('.world-event-actions button,#clinic-dialog .clinic-instruments button,#sc-hub button[data-we]'))if(!node.classList.contains('offline-page-action'))node.classList.add('offline-page-action');
  for(const [selector,value]of rules)for(const node of d.querySelectorAll(selector))add(node,typeof value==='function'?value(node):value);
  for(const node of d.querySelectorAll('#m-rail button,.town-nav button')){const key=node.matches('[data-v="clinic"],[data-view="clinic"]')?'clinic':node.matches('[data-v="journal"],[data-view="journal"]')?'dex':node.textContent.trim().replace(/^▣/,'')==='吧唧'?'link':null;if(key)add(node,key,{slot:node.querySelector('span[aria-hidden="true"]')});}
  for(const node of d.querySelectorAll('#clinic-panel .clinic-sign'))add(node,'health',{slot:node});
  const label=d.querySelector('.offline-device-mode');if(label){const text=[...label.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());if(text&&!label.querySelector(':scope > .offline-mode-label')){const line=d.createElement('span');line.className='offline-mode-label';text.before(line);line.append(text);add(line,'link',{status:true});}}
  for(const node of d.querySelectorAll('#offline-device-status,#offline-v2-status')){const text=node.textContent.trim();if(!text)continue;const key=/未连接|尚未|未就绪|断开|不可用/.test(text)?'link':/失败|错误|拒绝|权限/.test(text)?'shield':/正在|寻找|准备|等待/.test(text)?'search':/已连接|本地控制就绪/.test(text)?'check':'link';add(node,key,{status:true});}
 }
 function install(w){if(!w.document||w.__catPageIconsInstalled)return;w.__catPageIconsInstalled=true;let pending=false;const relevant='button,#offline-device-status,#offline-v2-status,.clinic-sign,.offline-device-mode';
  const update=()=>{pending=false;decorate(w);};
  const observer=new w.MutationObserver(records=>{if(pending)return;const needed=records.some(r=>r.target.nodeType===1&&r.target.closest(relevant)||r.target.parentElement?.closest(relevant)||[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches(relevant)||n.querySelector(relevant))));if(needed){pending=true;w.requestAnimationFrame(update);}});
  observer.observe(w.document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','aria-pressed','aria-selected']});w.addEventListener('pagehide',()=>observer.disconnect(),{once:true});update();
 }
 return{rules,decorate,install};
});
