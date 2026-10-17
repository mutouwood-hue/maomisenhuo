/* Scoped input for the original rhythm key. Completion remains original arm(). */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CatOfflineMeetKey=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function bind({w,modal,key,getSession,arm}){
  let press=null,timer=0;const d=w.document;
  const eligible=s=>s&&s===getSession()&&s.tab==='rhythm'&&!s.done&&s.R?.ph==='idle'&&modal.classList.contains('on')&&!d.hidden;
  const inside=e=>{const b=key.getBoundingClientRect();return e.clientX>=b.left&&e.clientX<=b.right&&e.clientY>=b.top&&e.clientY<=b.bottom;};
  function cancel(reset=false){const p=press;press=null;w.clearTimeout(timer);timer=0;key.classList.remove('down');if(reset||!modal.classList.contains('on')||!getSession()||getSession().R?.ph==='idle')key.classList.remove('armed');if(p){try{if(key.hasPointerCapture?.(p.id))key.releasePointerCapture(p.id);}catch{}}}
  function complete(){const p=press;if(!p||p.completed||!eligible(p.session)){cancel();return;}p.completed=true;w.clearTimeout(timer);timer=0;arm();if(getSession()===p.session&&p.session.R?.ph!=='idle')key.classList.add('armed');}
  function down(e){if(e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();if(press||!eligible(getSession()))return;const session=getSession();press={id:e.pointerId,session,at:w.Date.now(),completed:false};key.classList.add('down');try{key.setPointerCapture?.(e.pointerId);}catch{}timer=w.setTimeout(complete,1000);}
  function move(e){if(press&&e.pointerId===press.id&&!inside(e))cancel();}
  function up(e){if(!press||e.pointerId!==press.id)return;e.preventDefault();if(inside(e)&&w.Date.now()-press.at>=1000&&!press.completed)complete();cancel();}
  function abort(e){if(press&&e.pointerId===press.id)cancel();}
  const block=e=>e.preventDefault();
  key.addEventListener('pointerdown',down,{passive:false});key.addEventListener('pointermove',move);key.addEventListener('pointerup',up,{passive:false});
  for(const name of ['pointercancel','pointerleave','lostpointercapture'])key.addEventListener(name,abort);
  key.addEventListener('contextmenu',block);key.addEventListener('selectstart',block);
  const observer=new w.MutationObserver(()=>{if(press&&!eligible(press.session)&&!press.completed)cancel();if(!modal.classList.contains('on'))cancel();});observer.observe(modal,{attributes:true,attributeFilter:['class']});
  const visibility=()=>{if(d.hidden)cancel();},blur=()=>cancel();d.addEventListener('visibilitychange',visibility);w.addEventListener('blur',blur);
  const pagehide=e=>{if(e.persisted)cancel(true);else dispose();};
  function dispose(){cancel(true);observer.disconnect();key.removeEventListener('pointerdown',down);key.removeEventListener('pointermove',move);key.removeEventListener('pointerup',up);for(const name of ['pointercancel','pointerleave','lostpointercapture'])key.removeEventListener(name,abort);key.removeEventListener('contextmenu',block);key.removeEventListener('selectstart',block);d.removeEventListener('visibilitychange',visibility);w.removeEventListener('blur',blur);w.removeEventListener('pagehide',pagehide);}
  w.addEventListener('pagehide',pagehide);return{cancel,dispose};
 }
 return{bind};
});
