/* Manual selection is UI state only. No clock/save/care/day-sync mutation. */
(function(w){'use strict';const d=w.document;let drag=null,selection=null,futureFrame=0,futureCanvas=null,lastPaint=0,lastClock=0;
/* 只在 ?daydebug=1 时记录选区变化因果，用于定位「切换到未来后选区跳回现在」这类问题；不影响正常行为。 */
const DIAG=/[?&]daydebug=1(&|$)/.test(w.location?.search||'');
function diag(cause,extra){if(!DIAG)return;try{const log=w.__dayDiag=w.__dayDiag||[];log.push({t:Date.now(),cause,sel:selection?selection.minute:null,...extra});if(log.length>300)log.shift();}catch{}}
const ring=()=>d.querySelector('#lf-body .lf-hero svg.lf-ring');
const lifeIsOpen=()=>!d.hidden&&Boolean(d.querySelector('#life-ov.on'));
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
 stopFuture();const life=w.__pgLife;if(!life?.hostSelectDayTime)return;const value=life.hostSelectDayTime(minute,svg,mode);if(!value)return;diag('update',{mode,minute:value.minute,future:Boolean(value.future)});
 let note=svg.parentElement.querySelector('.day-manual-note');if(!note){note=d.createElement('div');note.className='day-manual-note';svg.after(note);}
 if(mode==='live'){note.replaceChildren();svg.setAttribute('aria-valuetext','现在 '+life.fmtT(value.minute)+' · '+value.kind);return;}
 const copy=d.createElement('p');copy.setAttribute('role','status');
 copy.textContent=value.future?life.fmtT(value.minute)+' · 这是未来的时间，故事还没发生':life.fmtT(value.minute)+' · '+value.kind+' · '+value.source+'。仅查看所选时刻，未改变实际生活进度。';
 const now=d.createElement('button');now.type='button';now.textContent='回到此刻';now.className='g-btn ghost';now.dataset.dayLive='';note.replaceChildren(copy,now);svg.setAttribute('aria-valuetext',copy.textContent);
 if(value.future)animateFuture(svg);
}
function show(svg,minute){w.__pgLife?.hostStopDayReplay?.();const now=clock(),normalized=((Math.floor(minute)%1440)+1440)%1440;diag('show',{to:normalized,day:now.day});selection={day:now.day,minute:normalized};update(svg,normalized);}
// 命中层由 ringSvg 生成，半径与实际内外轨一致；中心和刻度不属于拖动区。
const INTENT_DISTANCE=6,INTENT_RATIO=1.2;
function ringPoint(svg,e){
 const rect=svg.getBoundingClientRect(),box=svg.viewBox?.baseVal;if(!box?.width||!box?.height||!rect.width||!rect.height)return null;
 const scale=Math.min(rect.width/box.width,rect.height/box.height),x=(e.clientX-rect.left-rect.width/2)/scale,y=(e.clientY-rect.top-rect.height/2)/scale;
 return{x,y,radius:Math.hypot(x,y)};
}
function hitsTrack(svg,point){return point&&Array.from(svg.querySelectorAll('.day-ring-track')).some(track=>Math.abs(point.radius-Number(track.getAttribute('r')))<=Number(track.getAttribute('stroke-width'))/2);}
function preview(svg,e){const point=ringPoint(svg,e);if(!point||!point.radius)return;const angle=(Math.atan2(point.y,point.x)+Math.PI/2+Math.PI*2)%(Math.PI*2);show(svg,Math.floor(angle/(Math.PI*2)*1440));}
function clearDrag(){const held=drag;drag=null;if(held?.active&&held.svg.hasPointerCapture?.(held.id))held.svg.releasePointerCapture?.(held.id);}
function cleanup(){clearDrag();stopFuture();w.__pgLife?.hostStopDayReplay?.();}
function handlePointerDown(e){
 if(!lifeIsOpen()){cleanup();return;}
 const svg=e.target.closest?.('#lf-body .lf-hero svg.lf-ring');if(!svg||drag||e.isPrimary===false||e.button!==0)return;
 const point=ringPoint(svg,e);if(!hitsTrack(svg,point))return;
 // 起手只登记候选，不截断默认滚动，也不立即改变选区。
 drag={svg,id:e.pointerId,point,startX:e.clientX,startY:e.clientY,active:false};
}
function handlePointerMove(e){
 if(!drag||drag.id!==e.pointerId)return;if(!lifeIsOpen()||!drag.svg.isConnected){cleanup();return;}
 if(!drag.active){
  const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY,r=drag.point.radius;
  const tangent=Math.abs((-drag.point.y*dx+drag.point.x*dy)/r),radial=Math.abs((drag.point.x*dx+drag.point.y*dy)/r);
  if(Math.hypot(dx,dy)<INTENT_DISTANCE)return;
  if(tangent<INTENT_DISTANCE||tangent<=radial*INTENT_RATIO){clearDrag();return;}
  drag.active=true;drag.svg.setPointerCapture?.(e.pointerId);
 }
 e.preventDefault();preview(drag.svg,e);
}
function handlePointerUp(e){
 if(drag?.id!==e.pointerId)return;if(!lifeIsOpen()){cleanup();return;}const held=drag;
 if(held.svg.isConnected&&(held.active||(Math.hypot(e.clientX-held.startX,e.clientY-held.startY)<INTENT_DISTANCE&&hitsTrack(held.svg,ringPoint(held.svg,e)))))preview(held.svg,e);
 clearDrag();
}
function restore(){if(!lifeIsOpen()){cleanup();return;}const svg=ring(),now=clock();diag('restore',{nowMinute:now.minute,nowDay:now.day,svg:Boolean(svg)});if(selection?.day!==now.day)selection=null;if(svg)update(svg,selection?selection.minute:now.minute,selection?'manual':'live');else stopFuture();}
d.addEventListener('pointerdown',handlePointerDown,true);
d.addEventListener('pointermove',handlePointerMove,true);
d.addEventListener('pointerup',handlePointerUp,true);
d.addEventListener('pointercancel',e=>{if(drag?.id===e.pointerId)clearDrag();},true);
d.addEventListener('lostpointercapture',e=>{if(drag?.id===e.pointerId)clearDrag();},true);
d.addEventListener('keydown',e=>{const svg=e.target.closest?.('#lf-body .lf-hero svg.lf-ring');if(!svg||!['ArrowLeft','ArrowRight'].includes(e.key))return;if(!lifeIsOpen()){cleanup();return;}e.preventDefault();show(svg,(selection?.minute??Number(svg.getAttribute('aria-valuenow')||0))+(e.key==='ArrowRight'?15:-15));},true);
d.addEventListener('click',e=>{
 if(e.target.closest('#life-ov [data-act=replay]')){diag('click-replay');selection=null;clearDrag();stopFuture();ring()?.parentElement.querySelector('.day-manual-note')?.replaceChildren();return;}
 if(e.target.closest('[data-day-live]')){diag('click-live');selection=null;clearDrag();w.__pgLife?.hostStopDayReplay?.();restore();}
},true);
w.CatDayNavigation=Object.freeze({restore});
d.addEventListener('visibilitychange',()=>{diag('visibility',{hidden:d.hidden});if(d.hidden)cleanup();else restore();});
// 原生活页关闭只移除 on，DOM 仍存在；不能把 isConnected 当作可交互状态。
const overlay=d.querySelector('#life-ov');
const observer=overlay&&new w.MutationObserver(()=>{if(!lifeIsOpen())cleanup();});
observer?.observe(overlay,{attributes:true,attributeFilter:['class']});
w.addEventListener('pagehide',()=>{cleanup();observer?.disconnect();});
w.addEventListener('pageshow',()=>{if(overlay)observer?.observe(overlay,{attributes:true,attributeFilter:['class']});});
})(window);
