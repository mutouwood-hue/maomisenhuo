
/* ===== 毕业事件 =====
   触发：① 自然毕业：成年满 PET_GRAD_ADULT_DAYS 天（默认 7 天，可在页面顶部改）
         ② 试养运营：首次打开后的第 14 天，自动向当前小猫发出毕业邀请（需已长到少年猫）
         ③ 演示：链接带 ?grad=now 立即向当前小猫发出毕业邀请
   流程：邀请 → 一封信 → 一起的日子 → 传承给下一代 → 告别 → 写入毕业纪念册
*/
(()=>{
  const $=id=>document.getElementById(id);
  const TRIAL_DAY=14;
  const qs=new URLSearchParams(location.search);
  const track=(n,p)=>window.__petAnalytics?.track(n,p);
  const ls={get:k=>{try{return localStorage.getItem(k)}catch{return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch{}}};
  const G=()=>window.__petGame; const S=()=>G()?.state(); const store=()=>G()?.store;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const BREED_COLORS={orange:['#dd8b48','#efb76d','#fff6e4'],silver:['#8f979e','#b9c0c6','#eef1f3'],tuxedo:['#33393d','#4a5358','#f4f4f2'],siamese:['#7a5f4c','#e6d3bd','#f6ecdf'],ragdoll:['#a89a90','#e3d9d0','#fbf7f3'],blue:['#6a7f90','#8fa3b2','#dfe6ec'],calico:['#e2873e','#f6e7d2','#2f2a26'],golden:['#c99a45','#ecc77d','#fff2d8'],starry:['#232c52','#3a467a','#c9c4ff']};
  const CARE={feed:'喂饭',bath:'洗澡',pet:'摸摸',play:'接小鱼',sleep:'哄睡',climb:'爬猫爬架',tease:'玩逗猫棒',drink:'喝水'};
  const fmtD=t=>new Date(t).toLocaleDateString('zh-CN',{year:'numeric',month:'numeric',day:'numeric'});
  const fmtT=t=>new Date(t).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});

  /* ---------- 像素小猫（照片兜底） ---------- */
  function catSvg(breed){
    const [a,b,c]=BREED_COLORS[breed]||BREED_COLORS.orange;
    return `<svg viewBox="0 0 64 48" preserveAspectRatio="xMidYMid slice"><rect width="64" height="48" fill="#f3e6cf"/><rect y="38" width="64" height="10" fill="#e5d2b2"/><g transform="translate(8 6)"><path fill="${a}" d="M9 13h28v20H9zM37 20h7v-8h4v16H37z"/><path fill="${b}" d="M3 6h5V1h7v5h9V1h7v18h-4v5H7v-5H3z"/><path fill="${c}" d="M6 19h20v7H6zM10 31h7v8h-7zm20 0h7v8h-7z"/><path fill="#2f3a2a" d="M8 14h4v4H8zm14 0h4v4h-4z"/><path fill="#bd7e6c" d="M15 20h4v3h-4z"/></g></svg>`;
  }
  const photoKey=id=>'pet-grad-photo:'+id;
  function photoHtml(id,breed){const p=ls.get(photoKey(id));return p?`<img src="${p}" alt="">`:catSvg(breed);}
  /* 从 3D 小家截一张毕业照（4:3，居中偏下） */
  function snapshot(){
    try{
      const cv=[...document.querySelectorAll('canvas')].filter(c=>c.offsetParent&&c.width>200).sort((x,y)=>y.width*y.height-x.width*x.height)[0];
      if(!cv) return null;
      const W=cv.width,H=cv.height; let w=Math.min(W,H*1.0),h=w*0.75; if(h>H){h=H;w=h/0.75;}
      const x=(W-w)/2,y=Math.min(H-h,Math.max(0,H*0.56-h/2));
      const o=document.createElement('canvas');o.width=320;o.height=240;
      const g=o.getContext('2d');g.drawImage(cv,x,y,w,h,0,0,320,240);
      const d=g.getImageData(0,0,320,240).data;let mn=255,mx=0;for(let i=0;i<d.length;i+=400){mn=Math.min(mn,d[i]);mx=Math.max(mx,d[i]);}
      if(mx-mn<12) return null; // 空白画面
      return o.toDataURL('image/jpeg',0.72);
    }catch{return null}
  }

  /* ---------- 信 ---------- */
  function letter(c,g,st){
    const n=c.counts,days=g.days;
    const fav=Object.keys(CARE).sort((a,b)=>(n[b]||0)-(n[a]||0)).filter(k=>n[k]>0);
    const total=Object.keys(CARE).reduce((s,k)=>s+(n[k]||0),0);
    const L=[];
    L.push('亲爱的你：');
    L.push(days<=1?'虽然我们只一起过了短短一天，可我已经记住了你的声音。':`还记得第一次见面吗？那时候我才这么一点点大。一转眼，我们已经一起生活了 ${days} 天。`);
    if(total>0){
      const parts=[];
      if(n.feed) parts.push(`喂我吃了 ${n.feed} 顿饭`);
      if(n.bath) parts.push(`帮我洗了 ${n.bath} 次澡`);
      if(n.pet) parts.push(`摸了我 ${n.pet} 次头`);
      if(n.sleep) parts.push(`哄我睡了 ${n.sleep} 个觉`);
      L.push(`这些日子里，你${parts.slice(0,3).join('，')||'一直陪着我'}。我都偷偷数着呢。`);
    }
    if(fav[0]) L.push(`我最喜欢和你一起${CARE[fav[0]]}${fav[1]?`，其次是${CARE[fav[1]]}`:''}。每次那个时候，我的尾巴都会自己翘起来。`);
    if(c.claimedGoals?.length) L.push(`我们一起收集了 ${c.claimedGoals.length} 枚愿望印章，我把它们都收在心里。`);
    if(c.outfit&&c.outfit!=='none'){const o=st.catalog?.outfits?.find(x=>x.id===c.outfit);if(o) L.push(`我会戴着你送的${o.name}出发，这样走到哪里都像你在身边。`);}
    L.push('现在我长大了，想去看看小镇外面更大的世界。');
    L.push(`别担心，我把「${g.trait}」的性子留给了下一只小猫，它会替我陪着你。`);
    L.push('谢谢你，把我照顾得这么好。');
    return L.join('\n');
  }

  /* ---------- 仪式 ---------- */
  const ov=document.createElement('div');ov.id='grad-ov';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','小猫毕业');
  ov.innerHTML='<div class="g-stars">'+Array.from({length:40},()=>`<i style="left:${Math.random()*100}%;top:${Math.random()*70}%;animation-delay:${(Math.random()*3).toFixed(2)}s"></i>`).join('')+'</div><button class="g-close" type="button" aria-label="稍后再说">×</button><div class="g-box"></div>';
  document.body.appendChild(ov);
  const box=ov.querySelector('.g-box');
  let cur=null; // {cat,g,letter,photo,step,heirName,heirSex,view}
  const dots=i=>'<div class="g-dots">'+[0,1,2,3].map(k=>`<i class="${k===i?'on':''}"></i>`).join('')+'</div>';
  function render(){
    const {cat:c,g,step}=cur; const ph=cur.photo?`<img src="${cur.photo}" alt="">`:catSvg(c.breed);
    if(step===0){
      box.innerHTML=`<div class="g-photo">${ph}<span>${esc(c.name)} · 第 ${g.generation} 代</span></div>
      <h2>${esc(c.name)}有话想对你说</h2><p class="g-sub">它最近总望着窗外，好像准备好去看更大的世界了。</p>
      <div class="g-actions"><button class="g-btn" data-a="next">听它说</button>${g.canPostpone?'<button class="g-btn ghost" data-a="postpone">再陪它一天</button>':''}</div>${dots(0)}`;
    }else if(step===1){
      box.innerHTML=`<div class="g-letter" id="g-letter-text"></div><div class="g-actions"><button class="g-btn" data-a="next">继续</button></div>${dots(1)}`;
      typeLetter($('g-letter-text'),cur.letter,'—— '+c.name);
    }else if(step===2){
      const st=S().pet; const mem=(st.journal||[]).filter(j=>j.catId===c.id).slice(0,4);
      box.innerHTML=`<h2>一起的日子</h2><p class="g-sub">${fmtD(c.joinedAt||st.createdAt)} — 今天</p>
      <div class="g-stats"><div><b>${g.days}</b><small>一起生活的天数</small></div><div><b>${Object.keys(CARE).reduce((s,k)=>s+(c.counts[k]||0),0)}</b><small>亲手照料次数</small></div><div><b>${c.claimedGoals.length}</b><small>愿望印章</small></div><div><b style="font-size:18px;line-height:29px">${esc(g.trait)}</b><small>它的性子</small></div></div>
      ${mem.length?'<ul class="g-mem">'+mem.map(j=>`<li>${esc(j.message)}<time>${fmtT(j.at)}</time></li>`).join('')+'</ul>':''}
      <div class="g-actions"><button class="g-btn" data-a="next">继续</button></div>${dots(2)}`;
    }else if(step===3){
      box.innerHTML=`<h2>传承给下一代</h2><p class="g-sub">${esc(c.name)}把自己的性子，留给了新来的小猫</p>
      <div class="g-trait">${esc(g.trait)}</div>
      <div class="g-heir"><div>为第 ${g.generation+1} 代小猫取个名字</div><input id="g-heir-name" maxlength="12" value="${esc(cur.heirName)}" aria-label="新小猫的名字">
      <div class="g-sex"><button type="button" data-sex="female" class="${cur.heirSex==='female'?'on':''}">女孩</button><button type="button" data-sex="male" class="${cur.heirSex==='male'?'on':''}">男孩</button></div>
      <p class="g-sub" style="margin:10px 0 0">会继承 ${esc(c.breedName||'')} 的毛色，从幼猫重新长大</p></div>
      <div class="g-actions"><button class="g-btn" data-a="go">送 ${esc(c.name)} 出发</button></div>${dots(3)}`;
    }else if(step===4){
      box.innerHTML=`<div class="g-photo g-fly">${ph}<span>${esc(c.name)} · 第 ${g.generation} 代</span></div>
      <h2>${esc(c.name)}毕业啦</h2><p class="g-sub">它的照片和信，已经收进「猫咪家庭 · 毕业纪念册」</p>
      <div class="g-heir" style="margin-top:18px"><div style="font-size:13px;color:#d9cbe6">新的家人来了</div><div style="font-size:20px;margin:6px 0">${esc(cur.heirName)}</div><div class="g-trait">第 ${g.generation+1} 代 · 家传「${esc(g.trait)}」</div></div>
      <div class="g-actions"><button class="g-btn" data-a="close">回到小家</button></div>`;
    }
    track('grad_step',{cat:c.id,step});
  }
  let typeT=0;
  function typeLetter(el,text,sign){
    clearInterval(typeT);let i=0;const rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const done=()=>{clearInterval(typeT);el.innerHTML=esc(text)+`<span class="g-sign">${esc(sign)}</span>`;};
    if(rm) return done();
    el.onclick=done;
    typeT=setInterval(()=>{i+=2;el.textContent=text.slice(0,i);if(i>=text.length) done();},28);
  }
  function open(catId){
    const st=S();if(!st?.ready) return;
    const c=st.pet.cats.find(x=>x.id===catId);if(!c||!c.grad.ready) return;
    if(st.pet.activeCatId!==catId) store().switchCat(catId);
    const c2=S().pet.cats.find(x=>x.id===catId);
    cur={cat:c2,g:c2.grad,letter:letter(c2,c2.grad,S().pet),photo:null,step:0,heirName:c2.grad.heirName,heirSex:c2.sex==='male'?'female':'male'};
    hideInvite();ov.classList.add('on');document.documentElement.style.overflow='hidden';
    requestAnimationFrame(()=>{cur.photo=snapshot();render();});
    render();track('grad_open',{cat:catId,days:c2.grad.days,reason:c2.grad.called?'trial':'natural'});
  }
  function close(){ov.classList.remove('on');document.documentElement.style.overflow='';clearInterval(typeT);if(cur&&cur.step<4) track('grad_dismiss',{cat:cur.cat.id,step:cur.step});cur=null;sync(true);}
  ov.querySelector('.g-close').addEventListener('click',close);
  box.addEventListener('click',e=>{
    const sx=e.target.closest('[data-sex]');if(sx){cur.heirSex=sx.dataset.sex;box.querySelectorAll('[data-sex]').forEach(b=>b.classList.toggle('on',b===sx));return;}
    const a=e.target.closest('[data-a]')?.dataset.a;if(!a||!cur) return;
    if(a==='next'){cur.step++;render();}
    else if(a==='postpone'){const r=store().postponeGraduation(cur.cat.id);track('grad_postpone',{cat:cur.cat.id,ok:r.ok});close();toast(r.message);}
    else if(a==='go'){
      const name=($('g-heir-name')?.value||'').trim();
      const len=Array.from(name).length;
      if(len<2||len>12){$('g-heir-name').focus();$('g-heir-name').style.outline='2px solid #f2b544';return;}
      cur.heirName=name;
      const r=store().graduate(cur.cat.id,{heirName:name,heirSex:cur.heirSex,letter:cur.letter});
      if(!r.ok){toast(r.message);return;}
      if(cur.photo) ls.set(photoKey(cur.cat.id),cur.photo);
      track('graduate',{cat:cur.cat.id,days:cur.g.days,generation:cur.g.generation,trait:cur.g.trait,reason:r.record?.reason,postponed:!cur.g.canPostpone,heir:r.heirId});
      cur.step=4;render();
    }
    else if(a==='close') close();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ov.classList.contains('on')&&cur?.step!==4) close();});

  /* ---------- 只读：重温纪念册里的信 ---------- */
  function openRecord(id){
    const r=S()?.pet?.graduates?.find(x=>x.id===id);if(!r) return;
    cur=null;ov.classList.add('on');document.documentElement.style.overflow='hidden';
    box.innerHTML=`<div class="g-photo">${photoHtml(r.id,r.breed)}<span>${esc(r.name)} · 第 ${r.generation} 代</span></div>
    <p class="g-sub" style="margin-top:14px">${fmtD(r.joinedAt)} — ${fmtD(r.graduatedAt)} · 一起 ${r.days} 天 · 照料 ${r.care} 次 · 家传「${esc(r.trait)}」→ ${esc(r.heirName)}</p>
    <div class="g-letter">${esc(r.letter||'（没有留下信）')}<span class="g-sign">—— ${esc(r.name)}</span></div>
    <div class="g-actions"><button class="g-btn" data-a="close">合上纪念册</button></div>`;
    track('grad_album_view',{cat:id});
  }

  /* ---------- 邀请条 / 档案卡 / 纪念册 ---------- */
  const inv=document.createElement('div');inv.id='grad-invite';inv.setAttribute('role','status');
  document.body.appendChild(inv);
  let invFor='',invToast=false,shown=new Set();
  function showInvite(c){invFor=c.id;invToast=false;inv.innerHTML=`<span>✦ ${esc(c.name)}有话想对你说</span><button class="g-btn" type="button" data-go>听它说</button><button class="g-x" type="button" aria-label="稍后" data-x>×</button>`;inv.classList.add('on');track('grad_ready',{cat:c.id,reason:c.grad.called?'trial':'natural'});}
  function hideInvite(){inv.classList.remove('on');}
  inv.addEventListener('click',e=>{if(e.target.closest('[data-go]')) open(invFor);else if(e.target.closest('[data-x]')) hideInvite();});
  function toast(t){invToast=true;inv.innerHTML=`<span>${esc(t)}</span>`;inv.classList.add('on');setTimeout(hideInvite,3200);}

  const card=document.createElement('div');card.id='grad-card';card.hidden=true;
  const top=document.querySelector('.care-journal .journal-top');top?.insertAdjacentElement('afterend',card);
  card.addEventListener('click',e=>{const a=e.target.closest('[data-a]')?.dataset.a;if(a==='open') open(card.dataset.cat);else if(a==='postpone'){const r=store().postponeGraduation(card.dataset.cat);track('grad_postpone',{cat:card.dataset.cat,ok:r.ok,from:'card'});toast(r.message);}});

  const album=document.createElement('div');album.id='grad-album';album.hidden=true;
  const fam=$('family-panel');const lim=fam?.querySelector('.life-limits');fam&&(lim?fam.insertBefore(album,lim):fam.appendChild(album));
  album.addEventListener('click',e=>{const b=e.target.closest('[data-rec]');if(b) openRecord(b.dataset.rec);});

  let sig='';
  function sync(force){
    const st=S();if(!st?.ready||!st.pet) return;const p=st.pet;
    const a=p.cats.find(c=>c.id===p.activeCatId);
    const ready=p.cats.filter(c=>c.grad?.ready);
    const s=JSON.stringify([p.activeCatId,ready.map(c=>c.id),a?.grad?.waitingUntil,a?.grad?.blocked,a?.heritage,(p.graduates||[]).length]);
    if(s!==sig||force){
      sig=s;
      // 档案卡
      let h='';
      if(a?.grad?.ready) h=`<b>✦ ${esc(a.name)}准备好毕业了</b><div>一起生活了 ${a.grad.days} 天。它想去看看小镇外面的世界。</div><div class="g-row"><button class="g-btn" data-a="open">听它说</button>${a.grad.canPostpone?'<button class="g-btn ghost" data-a="postpone">再陪它一天</button>':''}</div>`;
      else if(a?.grad?.reached&&a.grad.waitingUntil) h=`<b>${esc(a.name)}答应再陪你一天</b><div>${fmtT(a.grad.waitingUntil)} 之后，它就要出发啦。</div>`;
      else if(a?.grad?.reached&&a.grad.blocked==='pair') h=`<b>${esc(a.name)}想等宝宝出生后再出发</b><div>先完成育幼准备，或在家庭里取消配对。</div>`;
      else{const o=ready.find(c=>c.id!==a?.id);if(o){h=`<b>✦ ${esc(o.name)}准备好毕业了</b><div class="g-row"><button class="g-btn" data-a="open">去看看它</button></div>`;card.dataset.cat=o.id;}}
      if(a?.grad?.ready) card.dataset.cat=a.id;
      if(a?.heritage) h+=`<div class="g-heritage"${h?' style="margin-top:8px"':''}>第 ${a.generation} 代 · 家传「${esc(a.heritage.trait)}」，来自${esc(a.heritage.fromName)}</div>`;
      card.innerHTML=h;card.hidden=!h;
      // 纪念册
      const gs=(p.graduates||[]).slice().reverse();
      album.hidden=!gs.length;
      album.innerHTML=gs.length?`<div class="life-section-label">毕业纪念册 · ${gs.length} 位</div><div class="ga-grid">${gs.map(r=>`<button type="button" class="ga-item" data-rec="${esc(r.id)}">${photoHtml(r.id,r.breed)}<b>${esc(r.name)}</b><small>第 ${r.generation} 代 · 一起 ${r.days} 天<br>${fmtD(r.graduatedAt)} 毕业</small></button>`).join('')}</div>`:'';
    }
    document.querySelector('.pet-identity')?.classList.toggle('g-dot',ready.length>0);
    if(inv.classList.contains('on')&&!invToast&&!ready.some(c=>c.id===invFor)) hideInvite();
    // 邀请条：每只猫每次打开只主动提示一次
    const r0=ready.find(c=>c.id===p.activeCatId)||ready[0];
    if(r0&&!shown.has(r0.id)&&!ov.classList.contains('on')&&!st.busy&&!p.busy){shown.add(r0.id);showInvite(r0);}
  }

  /* ---------- 触发：试养第 14 天 / ?grad=now ---------- */
  function triggers(){
    const st=S();if(!st?.ready||!st.pet||p_busy(st)) return;
    const p=st.pet,s=store();
    if(qs.get('grad')==='now'&&!ls.get('pet-grad-now-'+p.activeCatId)){ls.set('pet-grad-now-'+p.activeCatId,'1');s.callGraduation(p.activeCatId,{force:true});track('grad_call',{cat:p.activeCatId,by:'link'});}
    if(qs.get('grad')==='off'||ls.get('pet-grad-trial')) return;
    const first=+ls.get('pet-ana-first');if(!first) return;
    const d0=new Date(first);d0.setHours(0,0,0,0);const t=new Date();t.setHours(0,0,0,0);
    if(Math.round((t-d0)/864e5)+1<TRIAL_DAY) return;
    const c=p.cats.find(x=>x.id===p.activeCatId);
    if(c&&c.grad.stage!=='kitten'){const r=s.callGraduation(c.id);if(r.ok){ls.set('pet-grad-trial','1');track('grad_call',{cat:c.id,by:'trial_day'});}}
  }
  const p_busy=st=>st.busy||st.pet.busy;
  window.__petGrad={open,openRecord,call:(id,f)=>store()?.callGraduation(id||S().pet.activeCatId,{force:!!f})};
  setInterval(()=>{triggers();sync();},1000);
})();
