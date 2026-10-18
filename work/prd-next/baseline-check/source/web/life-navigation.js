/* Manual selection is UI state only. No clock/save/care/day-sync mutation. */
(function(w){'use strict';const d=w.document;let drag=null,selection=null,futureFrame=0,futureCanvas=null,lastPaint=0,lastClock=0;
const ring=()=>d.querySelector('#lf-body .lf-hero svg.lf-ring');
const clock=()=>w.__pgLife?.hostDayClock?.()||{valid:false,minute:0,day:null};
function stopFuture(){if(futureFrame)w.cancelAnimationFrame(futureFrame);futureFrame=0;futureCanvas=null;}
function animateFuture(svg){
 stopFuture();futureCanvas=svg.closest('.lf-hero')?.querySelector('#lf-stage');if(!futureCanvas)return;lastPaint=lastClock=0;
 function frame(time){
  futureFrame=0;if(d.hidden||!futureCanvas?.isConnected||!d.querySelector('#life-ov.on')||!selection||!svg.isConnected){stopFuture();return;}
  if(time-lastClock>=1000){lastClock=time;const now=clock();if(!now.valid||selection.day!==now.day||selection.minute<=now.minute){restore();return;}}
  if(time-lastPaint>=100){lastPaint=time;w.__pgLife?.hostDrawDayFuture?.(futureCanvas,time/1000);}
  futureFrame=w.requestAnimationFrame(frame);
 }
 futureFrame=w.requestAnimationFrame(frame);
}
function update(svg,minute,mode='manual'){
 stopFuture();const life=w.__pgLife;if(!life?.hostSelectDayTime)return;const value=life.hostSelectDayTime(minute,svg,mode);if(!value)return;
 let note=svg.parentElement.querySelector('.day-manual-note');if(!note){note=d.createElement('div');note.className='day-manual-note';svg.after(note);}
 if(mode==='live'){note.replaceChildren();svg.setAttribute('aria-valuetext','现在 '+life.fmtT(value.minute)+' · '+value.kind);return;}
 const copy=d.createElement('p');copy.setAttribute('role','status');
 copy.textContent=value.future?life.fmtT(value.minute)+' · 这是未来的时间，故事还没发生':life.fmtT(value.minute)+' · '+value.kind+' · '+value.source+'。仅查看所选时刻，未改变实际生活进度。';
 const now=d.createElement('button');now.type='button';now.textContent='回到此刻';now.className='g-btn ghost';now.dataset.dayLive='';note.replaceChildren(copy,now);svg.setAttribute('aria-valuetext',copy.textContent);
 if(value.future)animateFuture(svg);
}
function show(svg,minute){w.__pgLife?.hostStopDayReplay?.();const now=clock(),normalized=((Math.floor(minute)%1440)+1440)%1440;selection={day:now.day,minute:normalized};update(svg,normalized);}
function preview(svg,e){const r=svg.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;if(Math.hypot(x,y)<Math.min(r.width,r.height)*.18)return;const angle=(Math.atan2(y,x)+Math.PI/2+Math.PI*2)%(Math.PI*2);show(svg,Math.floor(angle/(Math.PI*2)*1440));}
function restore(){const svg=ring(),now=clock();if(selection?.day!==now.day)selection=null;if(svg)update(svg,selection?selection.minute:now.minute,selection?'manual':'live');else stopFuture();}
d.addEventListener('pointerdown',e=>{const svg=e.target.closest('#lf-body .lf-hero svg.lf-ring');if(!svg||drag)return;drag={svg,id:e.pointerId};svg.setPointerCapture?.(e.pointerId);e.preventDefault();preview(svg,e);},true);
d.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;if(!drag.svg.isConnected){drag=null;return;}e.preventDefault();preview(drag.svg,e);},true);
d.addEventListener('pointerup',e=>{if(drag?.id!==e.pointerId)return;const held=drag;preview(held.svg,e);drag=null;held.svg.releasePointerCapture?.(e.pointerId);},true);
d.addEventListener('pointercancel',e=>{if(drag?.id===e.pointerId)drag=null;},true);
d.addEventListener('keydown',e=>{const svg=e.target.closest('#lf-body .lf-hero svg.lf-ring');if(!svg||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();show(svg,(selection?.minute??Number(svg.getAttribute('aria-valuenow')||0))+(e.key==='ArrowRight'?15:-15));},true);
d.addEventListener('click',e=>{
 if(e.target.closest('#life-ov [data-act=replay]')){selection=null;drag=null;stopFuture();ring()?.parentElement.querySelector('.day-manual-note')?.replaceChildren();return;}
 if(e.target.closest('[data-day-live]')){selection=null;drag=null;w.__pgLife?.hostStopDayReplay?.();restore();}
},true);
w.CatDayNavigation=Object.freeze({restore});
d.addEventListener('visibilitychange',()=>{if(d.hidden){drag=null;stopFuture();w.__pgLife?.hostStopDayReplay?.();}else restore();});
w.addEventListener('pagehide',stopFuture);
})(window);
