/* Presentation only. Preview changes the existing adoption form, never the pet store. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root?.document){root.CatOfflineFamilyUI=api;api.install(root);}})(typeof window==='undefined'?null:window,function(){
 'use strict';
 function install(w){
  const d=w.document,shop=d.getElementById('shop-panel'),old=d.getElementById('breed-list'),select=d.getElementById('adopt-breed'),controls=d.querySelector('#family-panel .adopt-controls');
  if(!shop||!old||!select||!controls||d.getElementById('offline-adopt-preview'))return null;
  select.hidden=true;select.inert=true;select.setAttribute('aria-hidden','true');
  old.hidden=true;old.inert=true;old.setAttribute('aria-hidden','true');
  shop.setAttribute('aria-label','小猫衣柜');
  for(const button of d.querySelectorAll('button[data-view=shop],button[data-v=shop]')){button.setAttribute('aria-label','小猫衣柜');for(const node of button.childNodes)if(node.nodeType===3)node.textContent=node.textContent.replace('品种与衣柜','小猫衣柜');}
  const sheetTitle=d.getElementById('m-sheet-tt');
  shop.querySelector('h2').textContent='小猫衣柜';
  shop.querySelector('.life-heading small').textContent='衣服与配饰';
  shop.querySelector('.life-copy').textContent='为正在陪伴的小猫搭配衣服与配饰。想迎接另一只小猫，可以到「猫咪家庭」挑选。';
  const note=d.createElement('p');note.id='offline-adopt-note';note.className='family-note';note.textContent='先看看新伙伴的模样。选择这里只预览待领养的品种，确认领养后才会迎来新猫；现在的小猫不会改变。';
  const grid=d.createElement('div');grid.id='offline-adopt-preview';grid.className='offline-adopt-grid';grid.setAttribute('role','group');grid.setAttribute('aria-label','待领养幼猫的品种预览');grid.setAttribute('aria-describedby',note.id);
  controls.before(note,grid);let signature='',queued=false,disposed=false;
  function refresh(){
   if(disposed)return;
   if(sheetTitle?.textContent==='品种与衣柜')sheetTitle.textContent='小猫衣柜';
   const options=[...select.options].filter(o=>o.value&&!o.hidden),next=JSON.stringify(options.map(o=>[o.value,o.textContent,o.disabled]));
   if(next!==signature){signature=next;const nodes=options.map(option=>{
    const button=d.createElement('button');button.type='button';button.className='offline-adopt-card';button.dataset.adoptPreview=option.value;
    const label=d.createElement('span');label.textContent=option.textContent;button.append(label);return button;
   });grid.replaceChildren(...nodes);}
   for(const button of grid.children){
    const option=options.find(o=>o.value===button.dataset.adoptPreview);button.disabled=select.disabled||!option||option.disabled;
    button.setAttribute('aria-pressed',String(button.dataset.adoptPreview===select.value));
    if(!button.querySelector('svg')){
     const original=[...old.querySelectorAll('[data-breed]')].find(b=>b.dataset.breed===button.dataset.adoptPreview)?.closest('.breed-card')?.querySelector('svg.breed-face');
     if(original){const face=original.cloneNode(true);face.removeAttribute('id');face.setAttribute('focusable','false');button.prepend(face);}
    }
   }
  }
  function schedule(){if(queued||disposed)return;queued=true;w.requestAnimationFrame(()=>{queued=false;refresh();});}
  function pick(event){const b=event.target.closest('[data-adopt-preview]');if(!b||!grid.contains(b)||b.disabled||select.disabled)return;const option=[...select.options].find(o=>o.value===b.dataset.adoptPreview);if(!option||option.disabled||option.hidden)return;select.value=option.value;select.dispatchEvent(new w.Event('change',{bubbles:true}));}
  // Adult companion is the original paid pairing / future-kitten workflow, not a cosmetic selector.
  const partner=d.getElementById('partner-breed');
  if(partner){partner.hidden=true;partner.inert=true;const choices=d.createElement('div');choices.className='offline-adopt-grid';choices.setAttribute('aria-label','成年配对伙伴品种');partner.before(choices);
   const update=()=>{choices.replaceChildren(...[...partner.options].filter(o=>o.value&&!o.hidden).map(o=>{const b=d.createElement('button');b.type='button';b.className='offline-adopt-card';b.textContent=o.textContent;b.disabled=partner.disabled||o.disabled;b.setAttribute('aria-pressed',String(partner.value===o.value));b.addEventListener('click',()=>{partner.value=o.value;partner.dispatchEvent(new w.Event('change',{bubbles:true}));update();});return b;}));};
   const po=new w.MutationObserver(update);po.observe(partner,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});partner.addEventListener('change',update);update();w.addEventListener('pagehide',()=>po.disconnect(),{once:true});
   const label=partner.closest('.adopt-controls')?.previousElementSibling;if(label)label.textContent='成年后的家庭计划 · 配对与育幼';
  }
  grid.addEventListener('click',pick);select.addEventListener('change',refresh);
  const observer=new w.MutationObserver(schedule);observer.observe(old,{childList:true});observer.observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','hidden','label']});
  if(sheetTitle)observer.observe(sheetTitle,{childList:true,characterData:true,subtree:true});
  const dispose=()=>{disposed=true;observer.disconnect();grid.removeEventListener('click',pick);select.removeEventListener('change',refresh);};w.addEventListener('pagehide',dispose,{once:true});refresh();return{refresh,dispose};
 }
 return{install};
});
