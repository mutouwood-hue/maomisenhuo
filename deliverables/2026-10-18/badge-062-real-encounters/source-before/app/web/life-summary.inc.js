/* 仅汇总已记录的生活段；推测与游戏演出不冒充真实共同经历。 */
function summary(day){
  const now=L.nowMin(),visible=day.segs.filter(s=>s.start<now),confirmed=visible.filter(s=>!s.guess&&!L.cfg.demo&&!day.demo);
  const sum=k=>confirmed.filter(s=>s.kind===k).reduce((a,s)=>a+Math.max(0,Math.min(s.end,now)-s.start),0);
  const sleep=sum('sleep'),work=sum('work'),com=sum('commute'),home=sum('home');
  const guessed=visible.some(s=>s.guess),fictional=Boolean(L.cfg.demo||day.demo);
  const labels={sleep:'睡觉',work:'工作',commute:'通勤',home:'在家',out:'外出',move:'运动'};
  const totals=Object.entries(labels).map(([kind,label])=>{const minutes=sum(kind);return minutes?`记录为${label} <b>${L.fmtDur(minutes)}</b>`:null;}).filter(Boolean);
  const life=fictional?'当前为虚构日程，不作为真实生活或共同回忆。':totals.length?totals.join('，')+'。'+(guessed?'其余缺口按作息推测，不计入这份摘要。':''):'暂无可确认的生活记录。'+(guessed?'圆环中的虚线时段按作息推测，不代表实际发生。':'');
  const workTxt=fictional?'虚构工作时段，非实际工作记录。':work?`已记录工作时段 <b>${L.fmtDur(work)}</b>。`:'暂无已记录的工作时段，不据此判断是否工作。';
  const q=L.quirksToday();
  const catTxt=q.length?`已记录 ${q.length} 次小猫怪行为：${[...new Set(q.map(x=>x.icon))].join('')}。`:'暂无已记录的小猫怪行为。生活场景中的陪伴画面不作为实际动作记录。';
  return {life,work:workTxt,cat:catTxt,nums:{sleep,work,com,home}};
}
