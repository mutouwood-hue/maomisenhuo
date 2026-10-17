/* ===== 移动端沉浸式交互 v3 ===== */
(()=>{
  const $=id=>document.getElementById(id);
  const mq=matchMedia('(max-width:600px)');
  const nav=v=>document.querySelector('.town-nav button[data-view="'+v+'"]');
  const track=(n,p)=>window.__petAnalytics?.track(n,p);
  const sheet=$('m-sheet'),body=$('m-sheet-body'),backdrop=$('m-backdrop');
  const TITLES={profile:'小猫档案',care:'更多照料',shop:'品种与衣柜',clinic:'小猫诊所',family:'猫咪家庭',journal:'生活手记',world:'出门走走'};
  /* ---------- 节点搬运：手机端把档案/照料/面板搬进抽屉，桌面端还原 ---------- */
  const moved=[['.care-journal'],['#care-shortcuts'],['.life-content']].map(([sel])=>{const el=document.querySelector(sel);return {el,parent:el.parentNode,next:el.nextSibling};});
  let mobile=false;
  function applyLayout(){
    if(mq.matches&&!mobile){mobile=true;moved.forEach(m=>body.appendChild(m.el));$('care-shortcuts').open=true;}
    else if(!mq.matches&&mobile){mobile=false;closeSheet(true);moved.forEach(m=>m.parent.insertBefore(m.el,m.next&&m.next.parentNode===m.parent?m.next:null));$('care-shortcuts').open=false;}
  }
  /* ---------- 抽屉 ---------- */
  let mode='';
  function openSheet(m,sub=''){
    mode=m;const key=m==='panel'?curView:m;
    sheet.dataset.mode=m;sheet.classList.remove('m-collapsed');
    $('m-sheet-tt').textContent=TITLES[key]||'';$('m-sheet-sub').textContent=sub;
    $('m-sheet-close').innerHTML=m==='world'?'收起':'<svg class="icon" aria-hidden="true"><use href="#icon-close"/></svg>';
    sheet.classList.add('on');backdrop.classList.toggle('on',m!=='world');
    body.scrollTop=0;track('sheet_open',{mode:key});
  }
  function closeSheet(silent){
    if(!mode) return;
    const m=mode;mode='';sheet.classList.remove('on');backdrop.classList.remove('on');
    if(!silent&&m==='panel'&&curView!=='home') nav('home')?.click();
  }
  $('m-sheet-close').addEventListener('click',()=>{
    if(mode==='world'){const c=sheet.classList.toggle('m-collapsed');$('m-sheet-close').textContent=c?'展开':'收起';return;}
    closeSheet();
  });
  backdrop.addEventListener('click',()=>closeSheet());
  /* 抽屉内开始照料时自动收起，让出场景 */
  body.addEventListener('click',e=>{
    if(e.target.closest('.care-action')&&mode==='care') setTimeout(()=>closeSheet(),30);
    if(e.target.closest('[data-world-mode]')&&mode==='world') setTimeout(()=>{sheet.classList.add('m-collapsed');$('m-sheet-close').textContent='展开';},30);
  });
  /* ---------- 视图同步 ---------- */
  let curView='home';
  function syncView(){
    const b=document.querySelector('.town-nav [aria-current=page]');
    const v=b?b.dataset.view:'home';
    if(v===curView) return;
    const prev=curView;curView=v;document.body.dataset.view=v;
    track('nav_view',{view:v,from:prev});
    if(!mobile) return;
    if(v==='home'){ if(mode==='panel'||mode==='world') closeSheet(true); }
    else if(v==='world') openSheet('world');
    else openSheet('panel');
    sync();
  }
  document.body.dataset.view='home';
  new MutationObserver(syncView).observe(document.querySelector('.town-nav'),{subtree:true,attributes:true,attributeFilter:['aria-current']});
  /* ---------- 入口 ---------- */
  $('m-rail').addEventListener('click',e=>{const b=e.target.closest('button[data-v]');if(b) nav(b.dataset.v)?.click();});
  const openProfile=()=>{ if(curView!=='home'&&curView!=='world') nav('home')?.click(); openSheet('profile'); };
  document.querySelector('.pet-identity').addEventListener('click',e=>{ if(!mobile||e.target.closest('#rename-button')) return; openProfile(); });
  $('m-stats').addEventListener('click',openProfile);
  $('m-stats').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openProfile();}});
  /* ---------- 照料坞 ---------- */
  const dock=$('m-dock');
  dock.addEventListener('click',e=>{
    const btn=e.target.closest('button[data-m]'); if(!btn||btn.disabled) return;
    if(btn.dataset.m==='more'){openSheet('care');return;}
    const src=document.querySelector('.care-action[data-action="'+btn.dataset.m+'"]');
    if(src&&!src.disabled) src.click();
  });
  /* ---------- 周期同步：坞按钮状态 / 状态条 / 愿望红点 / 出门进度 ---------- */
  function sync(){
    if(!mobile) return;
    const busy=!$('interaction-panel').hidden;
    if(busy&&(mode==='care'||mode==='profile')) closeSheet();
    dock.hidden=busy||$('care-shortcuts').hidden||curView==='world';
    dock.querySelectorAll('button[data-m]').forEach(b=>{
      if(b.dataset.m==='more') return;
      const src=document.querySelector('.care-action[data-action="'+b.dataset.m+'"]');
      b.disabled=!src||src.disabled;
    });
    document.querySelectorAll('#m-stats .ms').forEach(el=>{
      const v=$('value-'+el.dataset.s); if(!v) return;
      const n=parseInt(v.textContent,10);
      el.querySelector('b').textContent=isNaN(n)?'—':n;
      el.classList.toggle('low',!isNaN(n)&&n<30);
    });
    const claimable=!!document.querySelector('#wish-list button:not([disabled])');
    document.querySelector('.pet-identity').classList.toggle('m-dot',claimable);
    if(mode==='world'){const p=$('world-progress');$('m-sheet-sub').textContent=p?p.textContent.trim().slice(0,40):'';}
  }
  /* ---------- 气泡自动淡出 ---------- */
  const msg=$('message');let fadeT=0;
  const bump=()=>{msg.classList.remove('m-faded');clearTimeout(fadeT);fadeT=setTimeout(()=>msg.classList.add('m-faded'),5000);};
  new MutationObserver(bump).observe(msg,{childList:true,characterData:true,subtree:true});bump();
  mq.addEventListener('change',()=>{applyLayout();window.dispatchEvent(new Event('resize'));});
  applyLayout();new MutationObserver(sync).observe($('interaction-panel'),{attributes:true,attributeFilter:['hidden']});new MutationObserver(sync).observe($('care-shortcuts'),{attributes:true,attributeFilter:['hidden']});setInterval(sync,400);sync();
})();

(()=>{
  /* ================= 试养埋点 =================
     接收地址三选一（优先级从高到低）：
       1. 链接参数 ?ep=https://...   （会记住）
       2. 下面 ENDPOINT 常量
       3. 不填：事件只缓存在本机，可在「存档 → 导出体验数据」导出
     受试者编号：链接参数 ?u=编号（会记住），用于和深访对应。
     上报格式：POST text/plain，内容为 JSON {v,pid,did,first,ua,events:[{n,t,d,s,p}]}
  ============================================ */
  const ENDPOINT='';
  const K={q:'pet-ana-queue',did:'pet-ana-device',first:'pet-ana-first',pid:'pet-ana-pid',ep:'pet-ana-endpoint',days:'pet-ana-days'};
  const ls={get:k=>{try{return localStorage.getItem(k)}catch{return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch{}}};
  const qs=new URLSearchParams(location.search);
  if(qs.get('ep')) ls.set(K.ep,qs.get('ep'));
  if(qs.get('u')) ls.set(K.pid,qs.get('u').slice(0,40));
  const endpoint=ls.get(K.ep)||ENDPOINT;
  const pid=ls.get(K.pid)||'';
  let did=ls.get(K.did); if(!did){did=(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));ls.set(K.did,did);}
  let first=+ls.get(K.first); const isFirst=!first; if(!first){first=Date.now();ls.set(K.first,String(first));}
  const day0=new Date(first);day0.setHours(0,0,0,0);
  const dayIdx=()=>{const d=new Date();d.setHours(0,0,0,0);return Math.round((d-day0)/864e5);};
  let days=[];try{days=JSON.parse(ls.get(K.days)||'[]')}catch{}
  function markDay(){const d=dayIdx();if(!days.includes(d)){days.push(d);ls.set(K.days,JSON.stringify(days));}}
  let queue=[];try{queue=JSON.parse(ls.get(K.q)||'[]')}catch{}
  const save=()=>{if(queue.length>3000)queue=queue.slice(-3000);ls.set(K.q,JSON.stringify(queue));};
  let sid=Math.random().toString(36).slice(2,10), sStart=Date.now(), sActs=0, hiddenAt=0;
  const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  function track(n,p={}){queue.push({n,t:Date.now(),d:dayIdx(),s:sid,p});save();if(queue.length>=20)flush();}
  let sending=false;
  function flush(beacon){
    if(!endpoint||!queue.length||sending) return;
    const batch=queue.slice(0,200);
    const body=JSON.stringify({v:1,pid,did,first,ua:navigator.userAgent,events:batch});
    const drop=()=>{queue=queue.slice(batch.length);save();};
    if(beacon&&navigator.sendBeacon){ if(navigator.sendBeacon(endpoint,new Blob([body],{type:'text/plain'}))) drop(); return; }
    sending=true;
    fetch(endpoint,{method:'POST',body,headers:{'Content-Type':'text/plain'},keepalive:true}).then(r=>{if(r.ok)drop();}).catch(()=>{}).finally(()=>{sending=false;});
  }
  function openSession(entry){
    sid=Math.random().toString(36).slice(2,10);sStart=Date.now();sActs=0;markDay();
    track('app_open',{entry,first:entry==='launch'&&isFirst,standalone:standalone(),hour:new Date().getHours(),ref:document.referrer?'link':'direct',mobile:matchMedia('(max-width:600px)').matches});
  }
  function closeSession(reason){track('session_end',{reason,sec:Math.round((Date.now()-sStart)/1000),acts:sActs});flush(true);}
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){hiddenAt=Date.now();closeSession('hidden');}
    else if(hiddenAt){ if(Date.now()-hiddenAt>30*60e3) openSession('resume'); else {sStart=Date.now();track('app_foreground',{away:Math.round((Date.now()-hiddenAt)/1000)});} hiddenAt=0; }
  });
  window.addEventListener('pagehide',()=>{ if(!document.hidden) closeSession('pagehide'); });
  setInterval(()=>flush(),15000);

  /* ---------- 基于存档状态差分的业务事件（不侵入原逻辑） ---------- */
  let prev=null;
  function snap(){
    const g=window.__petGame; if(!g) return null;
    const s=g.state(); if(!s||!s.ready||!s.pet) return null;
    const p=s.pet;
    return {cats:Object.fromEntries(p.cats.map(c=>[c.id,{counts:{...c.counts},stage:c.stage,breed:c.breed,outfit:c.outfit,health:c.health,issue:c.healthIssue}])),
      wardrobe:[...p.wardrobe],world:{...p.world.completed},journal:p.journal.map(j=>j.id),journalFull:p.journal,
      goals:(p.goals||[]).filter(x=>x.claimed).map(x=>p.activeCatId+':'+x.id),catCount:p.cats.length,babies:p.family?.babiesBorn||0,
      active:p.activeCatId,coins:p.coins,stats:p.stats};
  }
  function diff(){
    const c=snap(); if(!c) return;
    if(!prev){prev=c;track('state_init',{cats:c.catCount,coins:c.coins,stage:c.cats[c.active]?.stage});return;}
    for(const [id,cat] of Object.entries(c.cats)){
      const o=prev.cats[id];
      if(!o){track('cat_join',{cat:id,breed:cat.breed});continue;}
      for(const [a,v] of Object.entries(cat.counts)){const dv=v-(o.counts[a]||0);if(dv>0){for(let i=0;i<dv;i++){track('care_done',{action:a,cat:id});sActs++;}}}
      if(cat.stage!==o.stage) track('stage_up',{cat:id,stage:cat.stage});
      if(cat.breed!==o.breed) track('breed_change',{cat:id,breed:cat.breed});
      if(cat.outfit!==o.outfit) track('outfit_wear',{cat:id,outfit:cat.outfit});
      if(cat.issue!==o.issue) track('health_issue',{cat:id,issue:cat.issue||'cleared'});
    }
    c.wardrobe.filter(w=>!prev.wardrobe.includes(w)).forEach(w=>track('outfit_buy',{outfit:w}));
    for(const [m,v] of Object.entries(c.world)){const dv=v-(prev.world[m]||0);if(dv>0)track('trip_done',{mode:m});}
    c.journalFull.filter(j=>!prev.journal.includes(j.id)).forEach(j=>track('journal',{kind:j.kind}));
    c.goals.filter(g=>!prev.goals.includes(g)).forEach(g=>track('goal_claim',{goal:g}));
    if(c.babies>prev.babies) track('baby_born',{});
    if(c.active!==prev.active) track('cat_switch',{cat:c.active});
    prev=c;
  }
  setInterval(diff,2000);
  /* 每 10 分钟记录一次状态快照，便于观察「被需要感」 */
  setInterval(()=>{const g=window.__petGame?.state();const s=g?.pet?.stats;if(s&&!document.hidden)track('stats_tick',{food:Math.round(s.food),mood:Math.round(s.mood),clean:Math.round(s.clean),energy:Math.round(s.energy),health:g.pet.health});},10*60e3);

  /* ---------- 本机导出 ---------- */
  function summary(){
    const cnt={};queue.forEach(e=>cnt[e.n]=(cnt[e.n]||0)+1);
    return {pid,did,firstOpen:new Date(first).toISOString(),activeDays:days.slice().sort((a,b)=>a-b),retainedD1:days.includes(1),retainedD7:days.includes(7),standaloneNow:standalone(),pendingEvents:queue.length,endpoint:endpoint||'(未配置，仅本机缓存)',eventCounts:cnt};
  }
  function exportData(){
    const blob=new Blob([JSON.stringify({summary:summary(),events:queue},null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='暖爪小镇-体验数据-'+(pid||did.slice(0,8))+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  }
  const menu=document.getElementById('save-menu');
  if(menu){const b=document.createElement('button');b.type='button';b.id='export-analytics';b.innerHTML='<svg class="icon" aria-hidden="true"><use href="#icon-export"/></svg>导出体验数据';b.addEventListener('click',exportData);menu.appendChild(b);}
  window.__petAnalytics={track,flush,summary,export:exportData,get queue(){return queue.slice()}};
  openSession('launch');
})();
