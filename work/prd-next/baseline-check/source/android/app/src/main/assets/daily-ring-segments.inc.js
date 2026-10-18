  // Future is an unobserved view, never a planned segment painted as a record.
  const clock=wallNow,observed=mini?1440:clock.valid?clock.minute:0,progress=Math.min(now,observed),isFuture=!mini&&clock.valid&&now>observed;
  const dayPath=(radius,start,end)=>end-start>=1440?arc(c,c,radius,start,start+720)+' '+arc(c,c,radius,start+720,end):arc(c,c,radius,start,end);
  day.segs.forEach(sg=>{
    const a=Math.max(0,sg.start),b=Math.min(sg.end,1440,observed);if(b<=a||!K[sg.kind])return;
    const end=Math.max(a,Math.min(b,progress)),dash=sg.guess?' stroke-dasharray="5 3"':'';
    s+=`<path d="${dayPath(r1,a,b)}" stroke="${K[sg.kind].c}" stroke-width="16" fill="none" opacity=".20"${dash}><title>${L.fmtT(a)}–${L.fmtT(b)} ${K[sg.kind].n}${sg.guess?'（推测）':''}</title></path>`;
    if(end>a)s+=`<path d="${dayPath(r1,a,end)}" stroke="${K[sg.kind].c}" stroke-width="16" fill="none" opacity="${sg.guess?.5:1}"${dash}/>`;
    const cd=L.catDo(sg),color=cd.k==='out'?'#e8907a':cd.k==='sleep'?'#8f8bc4':'#f0bf73';
    s+=`<path d="${dayPath(r2,a,b)}" stroke="${color}" stroke-width="7" fill="none" opacity=".18"/>`;
    if(end>a)s+=`<path d="${dayPath(r2,a,end)}" stroke="${color}" stroke-width="7" fill="none" opacity=".95"/>`;
  });
  if(isFuture){
    s+=`<path d="${dayPath(r1,observed,now)}" stroke="#cbbbdc" stroke-width="13" stroke-dasharray="5 5" fill="none" opacity=".62"/><path d="${dayPath(r2,observed,now)}" stroke="#e0c9a2" stroke-width="6" stroke-dasharray="4 5" fill="none" opacity=".7"/>`;
  }
