/* Read-only projection of the original life day. Never enables collection. */
(function(root){
'use strict';
const kinds=['sleep','home','commute','work','out','move','none'],places=['none','home','work','food','cafe','park','river','other'];
root.CatOfflineDayDisplay={read(petId){
  const L=root.__pgLife;if(typeof L?.day!=='function'||typeof L.nowMin!=='function')throw Error('今日生活尚未准备好。');
  const date=new Date(),day=L.day(date),mode=L.cfg?.demo?'demo':'automatic';
  const sourceMinute=L.nowMin(),actualMinute=date.getHours()*60+date.getMinutes();
  if(!Number.isInteger(sourceMinute)||sourceMinute<0||sourceMinute>1440||!Array.isArray(day?.segs))throw Error('原今日生活时间无效。');
  const cutoff=Math.min(actualMinute,sourceMinute),segments=[];let end=0;
  for(const segment of day.segs){
    if(!Number.isInteger(segment.start)||!Number.isInteger(segment.end)||segment.start<0||segment.end>1440||segment.end<=segment.start)throw Error('原今日生活段无效。');
    if(segment.start>=cutoff)continue;
    const stop=Math.min(segment.end,cutoff);if(stop<=segment.start)continue;
    if(segment.start<end)throw Error('原今日生活记录重叠，未发送。');end=stop;
    const place=L.place?.(segment.place),category=segment.place==='river'?'river':place?.kind||(['home','work','food','cafe','park','river'].includes(segment.place)?segment.place:segment.place?'other':'none');
    const k=kinds.indexOf(segment.kind),p=places.indexOf(category);
    segments.push([segment.start,stop,k<0?6:k,mode==='demo'?2:segment.guess?1:0,p<0?7:p]);
  }
  if(segments.length>96)throw Object.assign(Error('今天超过96段，未截断或合并来源。'),{code:'TOO_MANY_DAY_SEGMENTS'});
  return {schema:1,petId,date:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,zone:-date.getTimezoneOffset(),cutoff,mode,segments};
}};
})(globalThis);
