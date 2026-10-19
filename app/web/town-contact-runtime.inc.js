 // Scene-only encounter lifetimes. No social store, rewards or hardware events.
 const pairStates=new Map(),contactMembers=new Map(),npcContacts=new Set();let ownContact=null;
 const socialClock=()=>performance.now(),EXIT_DISTANCE=DIAM+1.8,SOCIAL_COOLDOWN=10000;
 const pairKey=(a,b)=>[a.index,b.index].sort((x,y)=>x-y).join(':');
 function pairState(a,b){const key=pairKey(a,b);if(!pairStates.has(key))pairStates.set(key,{a,b,until:0,left:true});return pairStates.get(key);}
 function pairReady(a,b){const p=pairState(a,b),now=socialClock();return p.left&&now>=p.until&&[a,b].every(c=>!contactMembers.has(c)&&!nav.get(c).socialDeparture&&now>=(nav.get(c).socialReadyAt||0));}
 function latchPair(a,b){const p=pairState(a,b);p.until=socialClock()+SOCIAL_COOLDOWN;p.left=false;}
 function coolDown(c){nav.get(c).socialReadyAt=socialClock()+SOCIAL_COOLDOWN;}
 function cancelSocialDeparture(c){nav.get(c).socialDeparture=null;}
 function separationPath(c,other){
  if(nav.get(c).bridgeTrip||nav.get(c).bridgeRecovery||bridgeNoStop(c.root.position))return [];
  // Search the actual walkable road width. A waypoint behind a cat is not a
  // blocked destination when its route goes around a corner. Check each edge
  // from its own origin, using exactly the movement collision clearance.
  const origin=c.root.position.clone(),bank=bridgeSide(origin),spacing=.5;
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  dirs.sort((a,b)=>flatDistance(origin.clone().add(v(b[0],0,b[1])),other.root.position)-flatDistance(origin.clone().add(v(a[0],0,a[1])),other.root.position));
  const queue=[{x:0,z:0,p:origin,parent:null}],seen=new Set(['0:0']);let found=null,best=queue[0];
  for(let head=0;head<queue.length&&head<900;head++){
   const node=queue[head];
   if(flatDistance(node.p,other.root.position)>flatDistance(best.p,other.root.position))best=node;
   if(node.parent&&flatDistance(node.p,other.root.position)>=EXIT_DISTANCE+.25){found=node;break;}
   for(const[dx,dz]of dirs){
    const x=node.x+dx,z=node.z+dz,key=x+':'+z;if(Math.abs(x)>16||Math.abs(z)>16||seen.has(key))continue;
    const target=walkPoint(origin.clone().add(v(x*spacing,0,z*spacing)));if(!target||bridgeSide(target)!==bank||bridgeNoStop(target)||occupiedFrom(node.p,target,c))continue;
    const steps=Math.ceil(flatDistance(node.p,target)/.2);let clear=true;
    for(let i=1;i<=steps;i++){const p=node.p.clone().lerp(target,i/steps);if(!walkPoint(p)||bridgeNoStop(p)){clear=false;break;}}
    if(!clear)continue;seen.add(key);queue.push({x,z,p:target,parent:node});
   }
  }
  // Partial progress is useful in a crowd; replan from the reached position.
  // Never teleport, ignore a resident, or clear the physical collision radius.
  found=found||(flatDistance(best.p,other.root.position)>flatDistance(origin,other.root.position)+.2?best:null);
  const path=[];for(let node=found;node?.parent;node=node.parent)path.unshift(node.p);
  return path;
 }
 function roadSeparation(c,other,resumePath=nav.get(c).socialDeparture?.resumePath||[]){
  const n=nav.get(c);if(n.bridgeTrip||n.bridgeRecovery||bridgeNoStop(c.root.position))return false;
  n.socialDeparture={...n.socialDeparture,other,resumePath,retryAt:socialClock()+1200};n.hold=n.wait=n.blocked=0;n.path=separationPath(c,other);c.state=n.path.length?'WANDER':'GROOM';return n.path.length>0;
 }
 // Collision recovery uses one existing departure owner. A manual player
 // command wins; otherwise a stable resident order decides who backs away.
 function yieldRank(c){const root=nav.get(c).socialDeparture?.yieldRoot||c;return root.isPlayer?1000000:bridgeCommitted(root)?900000:1000-root.index;}
 function yieldTraffic(mover,blocker,seen=new Set()){
  let leader=mover,cat=blocker;if(yieldRank(leader)<yieldRank(cat)){leader=blocker;cat=mover;}
  if(seen.has(cat)||cat.isPlayer||bridgeCommitted(cat)||contactMembers.get(cat)===ownContact&&ownContact)return;
  // Never make a resident back toward a follower already in its yield chain.
  for(let c=leader,chain=new Set();c&&!chain.has(c);c=nav.get(c).socialDeparture?.other){if(c===cat)return;chain.add(c);}
  seen.add(cat);const n=nav.get(cat),root=nav.get(leader).socialDeparture?.yieldRoot||leader;
  const contact=contactMembers.get(cat);if(contact&&npcContacts.has(contact))finishNpcContact(contact,false);
  if(n.bridgeTrip)clearBridgeRequest(cat);
  const resume=n.socialDeparture?.resumePath||n.path.slice(-1).map(p=>p.clone());
  if(!n.socialDeparture||n.socialDeparture.other!==leader||socialClock()>=n.socialDeparture.retryAt){
   roadSeparation(cat,leader,resume);if(n.socialDeparture)n.socialDeparture.yieldRoot=root;
  }
  if(!n.path.length)for(const other of cats)if(other!==cat&&other!==leader&&flatDistance(cat.root.position,other.root.position)<DIAM+.6)yieldTraffic(cat,other,seen);
 }
 function finishOwnContact(resume=true,scatter=true){
  const contact=ownContact;if(!contact&&!interacting)return;
  const other=contact?.other||interacting,saved=contact?.saved||socialReturn;ownContact=null;interacting=null;socialReturn=null;chatUntil=0;
  if(!contact||contactMembers.get(own)===contact)contactMembers.delete(own);coolDown(own);
  if(other){if(!contact||contactMembers.get(other)===contact)contactMembers.delete(other);latchPair(own,other);coolDown(other);nav.get(other).hold=0;other.state='GROOM';if(scatter)roadSeparation(other,own);}
  nav.get(own).hold=0;own.state='GROOM';if(eventPhase==='idle'){card.hidden=true;card.querySelector('.world-event-actions').replaceChildren();setCore(false);}
  if(resume&&saved){nav.get(own).path=[];if(scatter&&other){if(!roadSeparation(own,other,saved.path))nav.get(own).path=nav.get(own).socialDeparture?[]:saved.path;}else nav.get(own).path=saved.path;renderControlMode();}
  else if(!nav.get(own).bridgeTrip&&!nav.get(own).bridgeRecovery)nav.get(own).path=[];
  renderControlMode();
  freeAt=elapsed+1;ambientNext=elapsed+8;
 }
 function beginNpcContact(a,b){
  if(a.isPlayer||b.isPlayer||!pairReady(a,b)||nav.get(a).bridgeTrip||nav.get(b).bridgeTrip||nav.get(a).bridgeRecovery||nav.get(b).bridgeRecovery||bridgeNoStop(a.root.position)||bridgeNoStop(b.root.position))return false;
  const contact={a,b,phase:'acting',action:'SNIFF_FLOWER',until:socialClock()+900};latchPair(a,b);npcContacts.add(contact);contactMembers.set(a,contact);contactMembers.set(b,contact);
  for(const c of[a,b]){const n=nav.get(c);n.path=[];n.hold=1;c.state='SNIFF_FLOWER';}
  const face=b.root.position.clone().sub(a.root.position);a.root.rotation.y=Math.atan2(face.x,face.z);b.root.rotation.y=a.root.rotation.y+Math.PI;return true;
 }
 function finishNpcContact(contact,scatter=true){if(!npcContacts.delete(contact))return;for(const c of[contact.a,contact.b]){if(contactMembers.get(c)===contact)contactMembers.delete(c);coolDown(c);nav.get(c).hold=0;c.state='GROOM';}latchPair(contact.a,contact.b);if(scatter){roadSeparation(contact.a,contact.b);roadSeparation(contact.b,contact.a);}}
 function serviceSocial(){
  const now=socialClock();for(const p of pairStates.values())if(!p.left&&flatDistance(p.a.root.position,p.b.root.position)>=EXIT_DISTANCE)p.left=true;
  for(const contact of[...npcContacts])if(now>=contact.until)finishNpcContact(contact);
  if(ownContact&&now>=ownContact.until){finishOwnContact(true);say('这次打招呼结束了，先各自逛一逛吧。');}
  for(const c of cats){const n=nav.get(c),departure=n.socialDeparture;if(!departure)continue;
   if(flatDistance(c.root.position,departure.other.root.position)>=EXIT_DISTANCE){n.socialDeparture=null;const goal=departure.resumePath.at(-1);if(goal&&(c.isPlayer||!cats.some(other=>other!==c&&flatDistance(goal,other.root.position)<DIAM+.2)))go(c,goal);continue;}
   if(now>=departure.retryAt&&(!n.path.length||n.blocked>.6)){roadSeparation(c,departure.other);if(!n.path.length)for(const other of cats)if(other!==c&&other!==departure.other&&flatDistance(c.root.position,other.root.position)<DIAM+.6)yieldTraffic(c,other);}
  }
 }
 function clearContacts(){finishOwnContact(false,false);for(const contact of[...npcContacts])finishNpcContact(contact,false);contactMembers.clear();pairStates.clear();for(const n of nav.values()){n.socialDeparture=null;n.socialReadyAt=0;}}
