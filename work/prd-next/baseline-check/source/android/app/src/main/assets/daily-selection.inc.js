/* Embedded in the original daily-view closure. Presentation only; no life/store writes. */
function hostDayClock(){const date=new Date(),valid=Number.isFinite(date.getTime())&&date.getFullYear()>=2020&&date.getFullYear()<=2100;return{valid,day:valid?L.dayKey(date):null,minute:valid?date.getHours()*60+date.getMinutes()+date.getSeconds()/60:0};}
L.hostDayClock=hostDayClock;
L.hostStopDayReplay=stopReplay;
let hostFutureTile=null;
L.hostDrawDayFuture=(canvas,time=0)=>{
 const g=canvas.getContext('2d'),w=canvas.width,h=canvas.height;if(!g)return;g.imageSmoothingEnabled=false;
 g.fillStyle='#f6eee4';g.fillRect(0,0,w,h);g.fillStyle='#e9dfce';g.fillRect(0,h*.73,w,h*.27);
 // Reuse the original daily cat. Only its head gently looks up/around.
 const tile=hostFutureTile||(hostFutureTile=document.createElement('canvas'));tile.width=L.catW*4;tile.height=L.catH*4;const tg=tile.getContext('2d');L.drawCat(tg,0,0,4,Math.sin(time*.8)> .985);
 const x=w*.5-tile.width*.5,y=h*.72-tile.height;
 g.drawImage(tile,0,28,tile.width,tile.height-28,x,y+28,tile.width,tile.height-28);
 g.save();g.translate(x+tile.width*.5,y+28);g.rotate(Math.sin(time*.7)*.035);g.drawImage(tile,0,0,tile.width,28,-tile.width*.5,-29-Math.sin(time*.5)*1.2,tile.width,28);g.restore();
 const phase=time%7;if(phase>3.8&&phase<5.4){g.save();g.globalAlpha=Math.sin((phase-3.8)/1.6*Math.PI)*.7;g.strokeStyle='#bca3cf';g.lineWidth=2;const sx=w*.69,sy=h*.35;g.beginPath();g.moveTo(sx-4,sy);g.lineTo(sx+4,sy);g.moveTo(sx,sy-4);g.lineTo(sx,sy+4);g.stroke();g.restore();}
};
L.hostSelectDayTime=(minute,svg,mode='manual',frameTime=0)=>{
 if(!svg||!Number.isFinite(minute))return null;
 const selected=Math.max(0,Math.min(1439,Math.floor(minute))),clock=hostDayClock(),future=clock.valid&&selected>clock.minute,day=L.day();
 // Exact containment only. Future never consults segAt/catDo or borrows a past event.
 const sg=!future&&clock.valid?day.segs.find(s=>selected>=s.start&&selected<s.end&&s.kind!=='none'&&K[s.kind]):null;
 const moments=L.moments().filter(m=>{const date=new Date(m.t),value=date.getHours()*60+date.getMinutes();return value<=clock.minute&&(mode!=='replay'||value<=selected);});
 const template=document.createElement('template');template.innerHTML=ringSvg(day,{now:selected,moments,wallNow:clock});const fresh=template.content.firstElementChild;
 svg.replaceChildren(...fresh.childNodes);for(const attr of fresh.attributes)svg.setAttribute(attr.name,attr.value);
 svg.dataset.selectedMinute=String(selected);svg.dataset.timeMode=mode;
 const hero=svg.closest('.lf-hero'),you=hero?.querySelector('.lf-card.you'),cat=hero?.querySelector('.lf-card.cat'),canvas=hero?.querySelector('#lf-stage');
 const text=(node,selector,value)=>{const field=node?.querySelector(selector);if(field)field.textContent=value;};
 let bubble=hero?.querySelector('.day-future-bubble');if(future&&canvas&&!bubble){bubble=document.createElement('p');bubble.className='day-future-bubble';bubble.textContent='不知道接下来会遇见什么，好期待呀～';canvas.before(bubble);}if(bubble)bubble.hidden=!future;
 const source=day.demo||L.cfg.demo?'虚构日程':sg?.guess?'推测时段':sg?'日程记录':'暂无记录';
 text(you,'small',(mode==='live'?'你现在':'选中时刻')+' · '+L.fmtT(selected));
 if(future){
  text(you,'b','还没发生的小美好');text(you,'span','这是未来的时间，故事还没发生');
  text(cat,'small',petName()+'正在期待');text(cat,'b','还没发生的小美好');text(cat,'span','不知道接下来会遇见什么，好期待呀～');
  if(canvas){canvas.setAttribute('aria-label','期待未来的小猫；仅为展示');L.hostDrawDayFuture(canvas,frameTime);}
 }else if(!sg){
  text(you,'b',clock.valid?'这一刻还没有记录':'暂时无法确认当前时间');text(you,'span',clock.valid?'空白的过去，没有补写故事。':'请确认手机时间后再查看。');
  text(cat,'small',petName()+'的这一刻');text(cat,'b','暂无记录');text(cat,'span','没有用相邻记录代替这一刻。');
  if(canvas){const g=canvas.getContext('2d');g.fillStyle='#f5eee4';g.fillRect(0,0,canvas.width,canvas.height);g.fillStyle='#776a5a';g.font='14px system-ui';g.textAlign='center';g.fillText('这一刻还没有记录',canvas.width/2,canvas.height/2);g.textAlign='start';canvas.setAttribute('aria-label','这一刻还没有记录');}
 }else{
  const cd=L.catDo(sg);text(you,'b',K[sg.kind].i+' '+K[sg.kind].n+(sg.place&&L.place(sg.place)?' · '+L.place(sg.place).name:''));text(you,'span',L.fmtT(sg.start)+' 开始 · '+source);
  text(cat,'small',petName()+(mode==='live'?'现在':'在这一刻'));text(cat,'b',cd.k==='out'?'🐾 出门中':cd.k==='sleep'?'💤 睡觉':'🏠 在家');text(cat,'span',cd.t);
  if(canvas){canvas.setAttribute('aria-label',source+' · '+L.fmtT(selected));drawStage(canvas,sg,frameTime);}
 }
 return{minute:selected,kind:future?'还没发生的小美好':sg?K[sg.kind].n:'暂无记录',source,future,clockValid:clock.valid};
};
