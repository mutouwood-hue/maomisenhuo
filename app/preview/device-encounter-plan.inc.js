/* Runs only inside the existing native event transaction, against staged data. */
function hostPlanDeviceEncounter(data,event,at){
  const fid='device:'+event.peerId,key=event.peerId+':'+event.encounterId;
  data.dex.nativeEncounters??={};
  if(data.dex.nativeEncounters[key])return {duplicate:true,message:'此相遇已有持久结果，未重复奖励。'};
  if(Object.keys(data.dex.nativeEncounters).length>=4096)throw Error('真实相遇记录已满，设备事件保留。');
  if(data.blocked?.[fid])return {rejected:true,reason:'blocked',message:'对方已被本机拉黑，此次相遇不添加好友、不结算成长。'};
  const day=dk(new Date(at));
  const daily=data.daily.k===day?data.daily:{k:day,alerts:0,fate:0,gifts:0,eggs:0,envy:0,meets:0,coins:0,world:0};
  const peer={fid,src:'native_device',owner:'匿名主人',petName:event.peerName,breed:event.peerBreed,sex:null,stage:null,outfit:'none',skills:[],cards:[]};
  let rhythm=null;
  if(event.method==='rhythm'){let t=0;const taps=[0];for(const gap of event.mark){t+=gap;taps.push(t);}rhythm=taps.map(x=>x/t);}
  const extra={rhythm,seal:event.method==='dots'?event.mark.slice():null};
  const old=data.friends[fid];
  extra.oldGreet=!!(rhythm&&old?.rhythm&&judge(old.rhythm.map(x=>x*1000),rhythm.map(x=>x*1000),{tol:15,dur:30}).ok);
  const result=friendProgress(data,peer,event.method,extra,at,daily);
  result.f.nativePeerId=event.peerId;result.f.lastEncounterId=event.encounterId;
  data.seen[event.peerBreed]=data.seen[event.peerBreed]||at;
  const growth=worldGrow(result.f,event.method,result.isNew,{data,daily,day,at,event});
  data.dex.deviceGiftPairs??={};
  const gift=!data.dex.deviceGiftPairs[event.peerId]&&!data.dex.deviceReceipts?.some(x=>x.kind==='gift'&&x.peerId===event.peerId&&x.status==='applied');
  if(gift)data.dex.deviceGiftPairs[event.peerId]=event.encounterId;
  const message=(event.method==='rhythm'?'敲暗号':'连点暗号')+' · '+(result.isNew?'成为朋友':'老朋友见面')+'「'+event.peerName+'」'+(growth.frag?'；相遇世界：'+growth.frag.t:'；'+(growth.skip==='same'?'今天已和它种过种子':growth.skip==='cap'?'今天世界成长已达上限':'相遇已记下'));
  data.dex.nativeEncounters[key]={eventId:event.eventId,peerId:event.peerId,fid,method:event.method,mark:event.mark.slice(),occurredAtMs:event.occurredAtMs,recordedAtMs:at,source:'native_device',peerComplete:true,message};
  return {...result,gift,message,growth};
}
function nativeEncounterHelp(){
 const records=Object.values(D.dex.nativeEncounters||{}).sort((a,b)=>b.recordedAtMs-a.recordedAtMs);
 return `<section class="lf-sec"><h4>真实吧唧相遇</h4><p class="lf-note">双方在各自吧唧长按下键 1 秒，靠近后选择同一种暗号。普通附近广播不会添加好友。</p><p>敲暗号：一人先敲 4–8 下，停 1.2 秒后另一人在 5 秒内跟敲。连点暗号：钟面 8 点加中心 1 点，两边连至少 4 点，顺序相同。匹配后双方分别确认，保存后回传手机。</p><p class="sc-small">电源键短按回主屏；长按仍为硬件关机。没有第二台吧唧时无法完成真实相遇。当面晃一晃尚无完整双机链路，未开放；扫码相遇已取消。</p><div class="lf-row"><button type="button" class="g-btn" data-native-device>连接我的吧唧</button><button type="button" class="g-btn ghost" data-htab="friends">看好友</button></div><h4>真实相遇记录 <small>${records.length} 次</small></h4><ol class="lf-list">${records.slice(0,30).map(x=>`<li><span>🤝</span><p>${esc(x.message)}<small>${x.occurredAtMs?new Date(x.occurredAtMs).toLocaleString():'设备当时没有可靠时钟；时间未推断'} · ${esc(x.method==='rhythm'?'敲暗号':'连点暗号')}</small></p></li>`).join('')||'<li class="lf-empty">尚无双方持久确认的真实吧唧相遇。吧唧离线保存后，连接手机会自动补传。查看相遇页期间会等待互动结束；回到小屋后即可继续同步。</li>'}</ol></section>`;
}
