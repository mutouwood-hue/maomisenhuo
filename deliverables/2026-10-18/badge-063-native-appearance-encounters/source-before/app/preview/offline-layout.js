/* Layout only. All gameplay actions still go through the original buttons. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const meetBox=document.querySelector('#sc-meet .sc-mbox');
  if(meetBox){
    const content=document.createElement('div');content.className='offline-meet-scroll';
    // Keep the real close/title row outside the independently scrolling game.
    for(const child of [...meetBox.children])if(!child.matches('.sc-mhead'))content.append(child);
    meetBox.append(content);
  }
  const bars = [];
  for (const nav of document.querySelectorAll('#sc-hub .lf-tabs,#life-ov .lf-tabs')) {
    const wrap = document.createElement('div'); wrap.className = 'offline-tabbar';
    nav.before(wrap);
    const left = document.createElement('button'), right = document.createElement('button');
    for (const [button, label, glyph] of [[left,'向左查看更多栏目','‹'],[right,'向右查看更多栏目','›']]) {
      button.type = 'button'; button.className = 'offline-tab-arrow'; button.setAttribute('aria-label',label); button.textContent = glyph;
    }
    wrap.append(left, nav, right);
    let previous = null;
    const update = () => {
      // Measure with the arrows removed; they must not manufacture overflow.
      const overflow = nav.scrollWidth > wrap.clientWidth - 20;
      if(left.hidden===overflow)left.hidden=!overflow;
      if(right.hidden===overflow)right.hidden=!overflow;
      left.disabled = nav.scrollLeft < 2;
      right.disabled = nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 2;
      const active = nav.querySelector('[aria-selected=true]');
      if (active !== previous) { previous = active; active?.scrollIntoView({block:'nearest',inline:'nearest'}); }
    };
    left.addEventListener('click',()=>nav.scrollBy({left:-Math.max(120,nav.clientWidth*.7),behavior:'smooth'}));
    right.addEventListener('click',()=>nav.scrollBy({left:Math.max(120,nav.clientWidth*.7),behavior:'smooth'}));
    nav.addEventListener('scroll',update,{passive:true});
    nav.addEventListener('keydown', event => {
      const tabs=[...nav.querySelectorAll('[role=tab]')];
      const at=tabs.indexOf(document.activeElement); if(at<0)return;
      const next=event.key==='ArrowRight'?(at+1)%tabs.length:event.key==='ArrowLeft'?(at+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;
      if(next!==null){event.preventDefault();tabs[next].click();tabs[next].focus();}
    });
    bars.push(update);
  }
  const tools=document.createElement('div'); tools.id='offline-world-tools'; tools.setAttribute('aria-label','外出操作');
  tools.innerHTML='<button type="button" id="offline-world-home">⌂ 回家</button><button type="button" id="offline-world-options" aria-expanded="false" aria-controls="m-sheet">行程与口袋</button>';
  document.body.append(tools);
  $('offline-world-home').addEventListener('click',()=>$('world-home')?.click());
  const sheet=$('m-sheet'), toggle=$('offline-world-options');
  function collapse(){sheet?.classList.add('m-collapsed');if($('m-sheet-close'))$('m-sheet-close').textContent='展开';}
  toggle.addEventListener('click',()=>{
    if(sheet?.dataset.mode!=='world')return;
    $('m-sheet-close')?.click();
  });
  // Retain all original entry order; expose the short-screen overflow.
  const rail=$('m-rail'),railMore=document.createElement('button');
  railMore.id='offline-rail-more';railMore.type='button';railMore.hidden=true;railMore.textContent='更多 ↓';railMore.setAttribute('aria-controls','m-rail');
  document.body.append(railMore);
  const railBottom=()=>rail.scrollTop+rail.clientHeight>=rail.scrollHeight-2;
  railMore.addEventListener('click',()=>{
    const behavior=matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
    if(railBottom())rail.scrollTo({top:0,behavior});else rail.scrollBy({top:Math.max(120,rail.clientHeight*.75),behavior});
  });
  function updateRail(){
    const overflow=rail.clientHeight>0&&rail.scrollHeight>rail.clientHeight+2;
    rail.classList.toggle('offline-rail-overflow',overflow);if(railMore.hidden===overflow)railMore.hidden=!overflow;
    const end=railBottom(),label=end?'返回 ↑':'更多 ↓';
    if(railMore.textContent!==label)railMore.textContent=label;
    railMore.setAttribute('aria-label',end?'返回功能栏顶部':'向下滚动查看更多功能，包括手记和吧唧');
  }
  rail.addEventListener('scroll',updateRail,{passive:true});
  if(typeof ResizeObserver==='function')new ResizeObserver(updateRail).observe(rail);
  let lastWorld=false, lastEvent=false, scheduled=false;
  function update(){
    bars.forEach(fn=>fn());updateRail();
    const world=document.body.dataset.view==='world';
    const event=world&&Boolean(document.querySelector('.world-event:not([hidden])'));
    if((world&&!lastWorld)||(event&&!lastEvent))collapse();
    lastWorld=world;lastEvent=event;
    const expanded=world&&sheet?.classList.contains('on')&&!sheet.classList.contains('m-collapsed');
    toggle.setAttribute('aria-expanded',String(expanded));
    const label=expanded?'收起行程':'行程与口袋';
    if(toggle.textContent!==label)toggle.textContent=label;
    // Encounter choices take precedence; reopening options must not cover them.
    if(toggle.hidden!==event)toggle.hidden=event;
  }
  const observer=new MutationObserver(()=>{
    if(scheduled)return;scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;update();});
  });
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','aria-selected','data-view']});
  window.addEventListener('resize',update);
  window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
  update();
})();
