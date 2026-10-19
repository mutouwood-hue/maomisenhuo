  if(center){
    const sg=!isFuture&&clock.valid?day.segs.find(sg=>now>=sg.start&&now<sg.end&&sg.kind!=='none'&&K[sg.kind]):null;
    const cd=sg?L.catDo(sg):null,title=isFuture?'还没发生的小美好':sg?'你：'+K[sg.kind].i+' '+K[sg.kind].n:'这一刻还没有记录';
    const copy=isFuture?'故事还没发生':cd?petName()+'：'+(cd.t.length>11?cd.t.slice(0,11)+'…':cd.t):'没有补写故事';
    s+=`<text x="${c}" y="${c-14}" text-anchor="middle" class="lf-ct">${L.fmtT(now)}</text><text x="${c}" y="${c+8}" text-anchor="middle" class="lf-cs">${esc(title)}</text><text x="${c}" y="${c+26}" text-anchor="middle" class="lf-cs2">${esc(copy)}</text>`;
  }
