 // Scene-only encounter lifetimes. No social store, rewards or hardware events.
 const pairStates=new Map(),contactMembers=new Map(),npcContacts=new Set();let ownContact=null;
 const socialClock=()=>performance.now(),EXIT_DISTANCE=DIAM+1.8,SOCIAL_COOLDOWN=10000;
 const pairKey=(a,b)=>[a.index,b.index].sort((x,y)=>x-y).join(':');
 function pairState(a,b){const key=pairKey(a,b);if(!pairStates.has(key))pairStates.set(key,{a,b,until:0,left:true});return pairStates.get(key);}
 function pairReady(a,b){const p=pairState(a,b);return p.left&&socialClock()>=p.until&&!contactMembers.has(a)&&!contactMembers.has(b);}
 function latchPair(a,b){const p=pairState(a,b);p.until=socialClock()+SOCIAL_COOLDOWN;p.left=false;}
 function roadSeparation(c,other){
  if(nav.get(c).bridgeTrip||nav.get(c).bridgeRecovery||bridgeNoStop(c.root.position))return false;
  const away=c.root.position.clone().sub(other.root.position);away.y=0;if(away.length()<.01)away.set(c.index<other.index?-1:1,0,0);away.normalize();
  for(const distance of[3,4.5])for(const angle of[0,.5,-.5,1,-1]){
   const dx=away.x*Math.cos(angle)-away.z*Math.sin(angle),dz=away.x*Math.sin(angle)+away.z*Math.cos(angle),goal=walkPoint(c.root.position.clone().add(v(dx*distance,0,dz*distance)));
   if(!goal||bridgeNoStop(goal)||occupied(goal,c)||flatDistance(goal,other.root.position)<EXIT_DISTANCE||!lineClear(c.root.position,goal))continue;
   const pieces=Math.ceil(distance/.4);let valid=true;for(let i=1;i<=pieces;i++)if(!walkPoint(c.root.position.clone().lerp(goal,i/pieces))){valid=false;break;}if(!valid)continue;
   const n=nav.get(c);n.path=[goal];n.hold=n.wait=0;n.socialDepartUntil=socialClock()+3500;c.state='WANDER';return true;
  }
  const n=nav.get(c);n.hold=0;n.wait=.8;n.socialDepartUntil=socialClock()+1200;c.state='GROOM';return false;
 }
 function finishOwnContact(resume=true,scatter=true){
  const contact=ownContact;if(!contact&&!interacting)return;
  const other=contact?.other||interacting,saved=contact?.saved||socialReturn;ownContact=null;interacting=null;socialReturn=null;chatUntil=0;
  contactMembers.delete(own);if(other){contactMembers.delete(other);latchPair(own,other);nav.get(other).hold=0;other.state='GROOM';if(scatter)roadSeparation(other,own);}
  nav.get(own).hold=0;own.state='GROOM';if(eventPhase==='idle'){card.hidden=true;card.querySelector('.world-event-actions').replaceChildren();setCore(false);}
  if(resume&&saved){mode=saved.mode;nav.get(own).path=saved.path;ui.querySelector('[data-player-toggle]').textContent=mode==='free'?'我来引导':'自由活动';if(!saved.path.length&&scatter&&other)roadSeparation(own,other);}
  else if(!nav.get(own).bridgeTrip&&!nav.get(own).bridgeRecovery)nav.get(own).path=[];
  freeAt=elapsed+1;ambientNext=elapsed+8;
 }
 function beginNpcContact(a,b){
  if(a.isPlayer||b.isPlayer||!pairReady(a,b)||nav.get(a).bridgeTrip||nav.get(b).bridgeTrip||nav.get(a).bridgeRecovery||nav.get(b).bridgeRecovery||bridgeNoStop(a.root.position)||bridgeNoStop(b.root.position)||nav.get(a).socialDepartUntil>socialClock()||nav.get(b).socialDepartUntil>socialClock())return false;
  const contact={a,b,until:socialClock()+900};npcContacts.add(contact);contactMembers.set(a,contact);contactMembers.set(b,contact);
  for(const c of[a,b]){const n=nav.get(c);n.path=[];n.hold=1;c.state='SNIFF_FLOWER';}
  const face=b.root.position.clone().sub(a.root.position);a.root.rotation.y=Math.atan2(face.x,face.z);b.root.rotation.y=a.root.rotation.y+Math.PI;return true;
 }
 function finishNpcContact(contact,scatter=true){npcContacts.delete(contact);for(const c of[contact.a,contact.b]){contactMembers.delete(c);nav.get(c).hold=0;c.state='GROOM';}latchPair(contact.a,contact.b);if(scatter){roadSeparation(contact.a,contact.b);roadSeparation(contact.b,contact.a);}}
 function serviceSocial(){
  const now=socialClock();for(const p of pairStates.values())if(!p.left&&flatDistance(p.a.root.position,p.b.root.position)>=EXIT_DISTANCE)p.left=true;
  for(const contact of[...npcContacts])if(now>=contact.until)finishNpcContact(contact);
  if(ownContact&&now>=ownContact.until){finishOwnContact(true);say('这次打招呼结束了，先各自逛一逛吧。');}
 }
 function clearContacts(){finishOwnContact(false,false);for(const contact of[...npcContacts])finishNpcContact(contact,false);contactMembers.clear();}
