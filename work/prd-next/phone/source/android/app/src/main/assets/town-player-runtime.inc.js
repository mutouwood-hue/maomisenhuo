/* Embedded inside the original town closure. Shared road/circle occupancy, original pet/activities. */
function createTownPlayer(){
 if(!playerModel)return null;
 const RADIUS=.9,GAP=.16,DIAM=RADIUS*2+GAP,WIDTH=1.6;
 const v=(x,y,z)=>new THREE.Vector3(x,y,z),nav=new Map(),solidRects=[];
 let profile=playerProfile,session=null,store=null,mode='free',elapsed=0,started=0,intro=0,interacting=null,chatUntil=0,eventShown=false,ended=false,journey=[],collected=0,freeAt=0,lastMoving=false,eventPhase='idle',eventChoice=null,eventResumeAt=0,currentPlace='street',destination=null,ambient=null,ambientNext=0,ambientCount=0,socialReturn=null,eventSavedPath=[],coreActive=false,drawerBeforeCore=false;
 const ground= new THREE.Group();ground.name='原暖阳庭院·街道外围';ground.position.set(32,1,20);ground.scale.setScalar(.26);scene.add(ground);
 if(root.CatTownGarden)root.CatTownGarden.build({group:ground,Group:THREE.Group,Vector3:THREE.Vector3,box:(parent,size,pos,color,opts={})=>createVoxel(...size,color,...pos,parent,opts)});registerOccludableStructure(ground,true);
 townWaypoints.gardenGate={x:22,y:1,z:20,name:'暖阳庭院入口'};townWaypoints.gardenCenter={x:32,y:1.1,z:20,name:'暖阳庭院小径'};townWaypoints.gardenNorth={x:32,y:1.1,z:14,name:'庭院花丛'};townWaypoints.gardenSouthPath={x:32,y:1.1,z:26,name:'庭院栅栏前'};
 waypointEdges.gardenSouth.push('gardenGate');waypointEdges.gardenGate=['gardenSouth','gardenCenter'];waypointEdges.gardenCenter=['gardenGate','gardenNorth','gardenSouthPath'];waypointEdges.gardenNorth=['gardenCenter'];waypointEdges.gardenSouthPath=['gardenCenter'];
 const a=townWaypoints.gardenSouth,b=townWaypoints.gardenGate,len=Math.hypot(b.x-a.x,b.z-a.z),path=createVoxel(len+1,.22,3,'#d3bd8e',(a.x+b.x)/2,.92,(a.z+b.z)/2,scene);path.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);
 // Original plaza waypoint sits inside its fountain: route around the unchanged pool.
 Object.assign(townWaypoints.plazaWest,{x:-6.1,z:2});townWaypoints.fishShop.x=-10.9;townWaypoints.bakery.x=-10.9;townWaypoints.ramen.x=-8.8;townWaypoints.catCafe.x=9.5;townWaypoints.yarnShop.x=9.5;
 Object.assign(townWaypoints,{plazaNE:{x:-6.1,y:1,z:-1.5,name:'喷泉东北侧'},plazaNorth:{x:-9.5,y:1,z:-1.5,name:'喷泉北侧'},plazaSE:{x:-6.1,y:1,z:5.5,name:'喷泉东南侧'},plazaSouth:{x:-9.5,y:1,z:5.5,name:'喷泉南侧'}});
 waypointEdges.plazaWest=['bridgeWest','plazaNE','plazaSE'];waypointEdges.plazaNE=['plazaWest','plazaNorth'];waypointEdges.plazaNorth=['plazaNE','fishShop','waterfallW'];waypointEdges.plazaSE=['plazaWest','plazaSouth'];waypointEdges.plazaSouth=['plazaSE','bakery'];waypointEdges.fishShop=['plazaNorth','waterfallW'];waypointEdges.waterfallW=['plazaNorth','fishShop'];waypointEdges.bakery=['plazaSouth','ramen','southWest'];
 // Narrow decorative stepping stones are not wide enough for the common cat clearance.
 waypointEdges.southWest=waypointEdges.southWest.filter(k=>k!=='steppingMid');waypointEdges.southEast=waypointEdges.southEast.filter(k=>k!=='steppingMid');delete waypointEdges.steppingMid;delete townWaypoints.steppingMid;
 // Dedicated bank bays: queued residents never wait in the crossing or its exits.
 townWaypoints.bridgeWaitW={x:-6.1,y:1,z:8,name:'西岸桥外等候处'};waypointEdges.bridgeWaitW=['plazaSE'];waypointEdges.plazaSE.push('bridgeWaitW');
 townWaypoints.bridgeWaitE={x:6.3,y:1,z:5.5,name:'东岸桥外等候处'};waypointEdges.bridgeWaitE=['yarnShop'];waypointEdges.yarnShop.push('bridgeWaitE');
 townWaypoints.bridgeLandingE={x:6.3,y:1,z:2,name:'东岸桥口'};waypointEdges.bridgeLandingE=['bridgeEast','plazaEast','bridgeExitE'];waypointEdges.bridgeEast=['bridgePeak','bridgeLandingE'];waypointEdges.plazaEast=waypointEdges.plazaEast.filter(k=>k!=='bridgeEast');waypointEdges.plazaEast.push('bridgeLandingE');townWaypoints.bridgeExitE={x:6.3,y:1,z:-1.5,name:'东岸离桥处'};waypointEdges.bridgeExitE=['bridgeLandingE','catCafe'];waypointEdges.catCafe.push('bridgeExitE');
 townWaypoints.bridgeExitW={x:-6.1,y:1,z:-4.5,name:'西岸离桥处'};waypointEdges.bridgeExitW=['plazaNE','plazaNorth','fishShop'];waypointEdges.plazaNE.push('bridgeExitW');waypointEdges.plazaNorth.push('bridgeExitW');waypointEdges.fishShop.push('bridgeExitW');
 for(const[a,b]of[['plazaSE','bridgeWaitW'],['yarnShop','bridgeWaitE'],['plazaNE','bridgeExitW'],['bridgeLandingE','bridgeExitE']]){const A=townWaypoints[a],B=townWaypoints[b],length=Math.hypot(B.x-A.x,B.z-A.z),mesh=createVoxel(length+1,.12,2.6,'#d3bd8e',(A.x+B.x)/2,1.02,(A.z+B.z)/2,scene);mesh.rotation.y=-Math.atan2(B.z-A.z,B.x-A.x);}
 const segments=[];for(const [a,neighbors]of Object.entries(waypointEdges))for(const b of neighbors)if(a<b)segments.push([a,b]);
 function point(k){const p=townWaypoints[k];return v(p.x,p.y,p.z);}
 function nearest(p){let best=null;for(const [a,b]of segments){const A=point(a),B=point(b),dx=B.x-A.x,dz=B.z-A.z,t=Math.max(0,Math.min(1,((p.x-A.x)*dx+(p.z-A.z)*dz)/(dx*dx+dz*dz))),q=v(A.x+dx*t,A.y+(B.y-A.y)*t,A.z+dz*t),distance=Math.hypot(p.x-q.x,p.z-q.z);if(!best||distance<best.distance)best={a,b,t,q,distance};}return best;}
 function height(p,s){if(inBridge(p))return 1.325+Math.cos(Math.min(5.5,Math.abs(p.x))/5.5*Math.PI/2)*1.65;if(['bridgeWest','bridgePeak','bridgeEast'].includes(s.a)&&['bridgeWest','bridgePeak','bridgeEast'].includes(s.b))return 1.25+Math.cos(p.x/5.5*Math.PI/2)*1.65;return s.q.y;}
 function inBridge(p){return Math.abs(p.x)<=6.4&&Math.abs(p.z-2)<=1.25;}
 function validSolid(p){if(inBridge(p))return true;if(Math.abs(p.x)<4.8+RADIUS)return false;return !solidRects.some(b=>p.x>b.min.x-RADIUS&&p.x<b.max.x+RADIUS&&p.z>b.min.z-RADIUS&&p.z<b.max.z+RADIUS);}
 function walkPoint(p){const s=nearest(p);if(!s||s.distance>WIDTH+.01||!validSolid(p))return null;const q=p.clone();q.y=height(q,s);return q;}
 function lineClear(A,B){const count=Math.max(1,Math.ceil(A.distanceTo(B)/.5));for(let i=0;i<=count;i++)if(!validSolid(A.clone().lerp(B,i/count)))return false;return true;}
 function route(from,to){const S=nearest(from),E=nearest(to);if(!S||!E)return[];if(S.a===E.a&&S.b===E.b&&lineClear(from,to))return[to.clone()];const costs={},paths={},open=new Set(Object.keys(townWaypoints));for(const k of open)costs[k]=Infinity;for(const k of[S.a,S.b]){if(lineClear(from,point(k))){costs[k]=from.distanceTo(point(k));paths[k]=[k];}}while(open.size){let k=[...open].sort((a,b)=>costs[a]-costs[b])[0];open.delete(k);if(!Number.isFinite(costs[k]))break;for(const n of waypointEdges[k]){if(!lineClear(point(k),point(n)))continue;const c=costs[k]+point(k).distanceTo(point(n));if(c<costs[n]){costs[n]=c;paths[n]=[...paths[k],n];}}}const end=[E.a,E.b].filter(k=>lineClear(point(k),to)).sort((a,b)=>costs[a]+point(a).distanceTo(to)-costs[b]-point(b).distanceTo(to))[0];return end&&paths[end]?[...paths[end].map(point),to.clone()]:[];}
 const ownerRoot=new THREE.Group(),visual=new THREE.Group();ownerRoot.name='当前存档小猫';visual.rotation.y=Math.PI;ownerRoot.add(visual);visual.add(playerModel.root);scene.add(ownerRoot);
 const own={index:cats.length,isPlayer:true,root:ownerRoot,profile:{name:profile.name,role:'你的猫',emoji:'🐈',thoughts:['闻闻花香，再去看看小镇。']},currentNode:'plazaWest',targetNode:'plazaWest',state:'WANDER',animPhase:0,thoughtIndex:0};cats.push(own);ownerRoot.position.copy(point('plazaWest'));
 function occupied(p,self){const from=self.root.position;return cats.some(c=>{if(c===self||Math.abs(c.root.position.y-p.y)>=2.4)return false;const other=c.root.position,before=Math.hypot(from.x-other.x,from.z-other.z),after=Math.hypot(p.x-other.x,p.z-other.z);
  if(before<DIAM-.001)return after<=before+.00001; // Existing penetration may only separate.
  const dx=p.x-from.x,dz=p.z-from.z,length=dx*dx+dz*dz,t=length?Math.max(0,Math.min(1,((other.x-from.x)*dx+(other.z-from.z)*dz)/length)):0;
  return Math.hypot(from.x+dx*t-other.x,from.z+dz*t-other.z)<DIAM;
 });}
 // Place residents on the same road graph, with one common radius before first display.
 const candidates=[];for(const[a,b]of segments){const A=point(a),B=point(b),n=Math.max(1,Math.floor(A.distanceTo(B)/2.5));for(let k=0;k<n;k++)candidates.push(A.clone().lerp(B,(k+.35)/n));}
 // Read final ground-level boxes before the original drop-in animation; no physics engine.
 solidRects.push({min:v(-11.4,1,.1),max:v(-7.6,1.9,3.9)});
 const originals=assemblySystem.items.map(item=>({item,y:item.obj.position.y,scale:item.obj.scale.clone()}));for(const {item}of originals){item.obj.position.y=item.targetY;if(item.targetScale)item.obj.scale.copy(item.targetScale);}scene.updateMatrixWorld(true);
 for(const mesh of cameraColliderMeshes){let node=mesh,isCat=false;while(node&&node!==scene){if(cats.some(c=>c.root===node)){isCat=true;break;}node=node.parent;}if(isCat||!mesh.geometry||mesh.material?.visible===false)continue;const box=new THREE.Box3().setFromObject(mesh),height=box.max.y-box.min.y;if(height>.7&&box.min.y<1.85&&box.max.y>1.6)solidRects.push({min:box.min.clone(),max:box.max.clone()});}
 for(const {item,y,scale}of originals){item.obj.position.y=y;item.obj.scale.copy(scale);}scene.updateMatrixWorld(true);
 for(let i=candidates.length-1;i>=0;i--)if(!validSolid(candidates[i])||bridgeNoStop(candidates[i])||Math.hypot(candidates[i].x+6.1,candidates[i].z-8)<DIAM||Math.hypot(candidates[i].x-6.3,candidates[i].z-5.5)<DIAM)candidates.splice(i,1);
 const placed=[own];for(const c of cats.filter(c=>!c.isPlayer)){let found=null;for(let k=0;k<candidates.length;k++){const p=candidates[(k+c.index*7)%candidates.length];if(placed.every(o=>o.root.position.distanceTo(p)>=DIAM+.1)){found=p;break;}}if(found)c.root.position.copy(found);placed.push(c);nav.set(c,{path:[],wait:0,hold:0,blocked:0});}
 nav.set(own,{path:[],wait:0,hold:0,blocked:0});
 // One bridge lease. Waiting bays never share its entry / exit corridor.
 const bridgeQueue=new Map();let bridgeOwner=null,bridgeTicket=0;
 const bridgeSide=p=>p.x<0?'west':'east';
 const bridgeWait={west:'bridgeWaitW',east:'bridgeWaitE'},bridgeGate={west:'bridgeWest',east:'bridgeEast'},bridgeExit={west:'bridgeExitW',east:'bridgeExitE'};
 function onBridge(p){return Math.abs(p.x)<5.8&&Math.abs(p.z-2)<1.6;}
 function bridgeCorridor(p){return onBridge(p)||p.x<0&&Math.abs(p.x+6.1)<1.35&&p.z> -2.7&&p.z<4.5||p.x>=5.5&&p.x<10.7&&p.z>-.5&&p.z<3.3;}
 function bridgeNoStop(p){return bridgeCorridor(p)||flatDistance(p,point('bridgeExitW'))<DIAM+.4||flatDistance(p,point('bridgeExitE'))<DIAM+.4;}
 function bridgeCommitted(c){const n=nav.get(c);return n?.bridgeTrip?.phase==='crossing'||n?.bridgeRecovery;}
 function flatDistance(a,b){return Math.hypot(a.x-b.x,a.z-b.z);}
 function ordinaryPath(c,p){const path=route(c.root.position,p);if(!path.length)return false;const n=nav.get(c);n.path=path;n.hold=0;n.blocked=0;return true;}
 function startBridgeRequest(c,p){
  const n=nav.get(c),side=bridgeSide(c.root.position),opposite=side==='west'?'east':'west';
  // At most one NPC physically waits on each bank; others keep their bank-local route.
  if(!c.isPlayer&&[...bridgeQueue.values()].some(t=>!t.cat.isPlayer&&t.side===side))return false;
  const north=c.root.position.z<2,wait=point(north?(side==='west'?'fishShop':'catCafe'):(c.isPlayer?(side==='west'?'plazaSouth':'yarnShop'):bridgeWait[side]));
  if(!ordinaryPath(c,wait))return false;
  const trip={cat:c,side,opposite,final:p.clone(),wait:wait.clone(),ticket:++bridgeTicket,phase:'approach'};
  n.bridgeTrip=trip;bridgeQueue.set(c,trip);if(c.isPlayer)say('在桥外等前面的小猫通过，轮到你会连续走到对岸。');return true;
 }
 function clearBridgeRequest(c){bridgeQueue.delete(c);if(bridgeOwner===c)bridgeOwner=null;const n=nav.get(c);if(n){n.bridgeTrip=null;n.bridgeRecovery=false;}}
 function recoverBridgeCat(c){
  const n=nav.get(c);if(!n||n.bridgeRecovery)return;
  clearBridgeRequest(c);n.hold=n.wait=n.blocked=0;n.bridgeRecovery=true;
  const side=bridgeSide(c.root.position),sign=side==='west'?-1:1;
  // Old overlaps may only separate, never deepen. Leave to the nearest bank,
  // retaining the current side of the deck so two stale cats need not swap lanes.
  const lane=Math.max(-1.1,Math.min(1.1,c.root.position.z-2));
  const edge=v(sign*5.9,1,2+lane),gate=v(sign*6.1,1,2),exit=point(bridgeExit[side]);
  n.path=[edge,gate,...route(gate,exit)];n.recoveryExit=exit;c.state='WANDER';
 }
 function serviceBridge(){
  for(const c of cats){const n=nav.get(c);if(!n)continue;
   if(n.bridgeRecovery){n.hold=n.wait=0;if(!onBridge(c.root.position)&&flatDistance(c.root.position,n.recoveryExit)<.25){n.bridgeRecovery=false;ordinaryPath(c,point(c.root.position.x<0?'fishShop':'catCafe'));}continue;}
   if(onBridge(c.root.position)&&bridgeOwner!==c)recoverBridgeCat(c);
  }
  if(bridgeOwner){const n=nav.get(bridgeOwner),trip=n?.bridgeTrip;
   if(!trip){bridgeOwner=null;}else{
    n.hold=n.wait=0;
    const exit=point(bridgeExit[trip.opposite]);
    if(flatDistance(bridgeOwner.root.position,exit)<.22){const c=bridgeOwner,final=trip.final;clearBridgeRequest(c);go(c,final);if(!c.isPlayer)n.wait=3.2;}
   }
  }
  if(bridgeOwner||cats.some(c=>nav.get(c)?.bridgeRecovery||onBridge(c.root.position)))return;
  const ready=[...bridgeQueue.values()].filter(t=>{const n=nav.get(t.cat);return n&&(!n.path.length||flatDistance(t.cat.root.position,t.wait)<DIAM+.5);});
  ready.sort((a,b)=>Number(b.cat.isPlayer)-Number(a.cat.isPlayer)||a.ticket-b.ticket||a.cat.index-b.cat.index);
  const next=ready[0];if(!next)return;
  const entry=point(bridgeGate[next.side]),other=point(bridgeGate[next.opposite]),exit=point(bridgeExit[next.opposite]);
  const approach=route(next.cat.root.position,entry),finish=route(other,exit);
  if(!approach.length||!finish.length)return;
  bridgeOwner=next.cat;next.phase='crossing';if(next.cat.isPlayer)say('轮到你过桥了，先走到对岸再停下。');bridgeQueue.delete(next.cat);
  const n=nav.get(next.cat);n.hold=n.wait=n.blocked=0;n.path=[...approach,point('bridgePeak'),other,...finish];
 }
 function resetBridgeTraffic(){
  bridgeOwner=null;bridgeQueue.clear();bridgeTicket=0;
  for(const c of cats){const n=nav.get(c);if(!n)continue;n.bridgeTrip=null;n.bridgeRecovery=false;n.path=[];n.hold=n.wait=0;
   if(onBridge(c.root.position))recoverBridgeCat(c);
   else if(bridgeCorridor(c.root.position)&&!c.isPlayer)ordinaryPath(c,point(c.root.position.x<0?'plazaNorth':'catCafe'));
  }
 }
 function go(c,p){
  const n=nav.get(c);if(!n)return false;
  if(n.bridgeTrip){n.bridgeTrip.final=p.clone();return true;}if(n.bridgeRecovery)return false;
  let target=p.clone();if(onBridge(target)||!c.isPlayer&&bridgeNoStop(target))target=point(bridgeSide(c.root.position)==='west'?'catCafe':'fishShop');
  const path=route(c.root.position,target);if(!path.length)return false;
  if(path.some(onBridge)||bridgeSide(c.root.position)!==bridgeSide(target))return startBridgeRequest(c,target);
  n.path=path;n.hold=n.blocked=0;const near=nearest(target);c.targetNode=near.t<.5?near.a:near.b;return true;
 }
 function move(c,dt,speed){
  const n=nav.get(c);if(!n.path.length)return false;
  const goal=n.path[0],delta=goal.clone().sub(c.root.position);delta.y=0;const distance=delta.length();
  if(distance<.12){c.root.position.y=height(c.root.position,nearest(c.root.position));n.path.shift();return false;}
  delta.divideScalar(distance);const step=Math.min(distance,speed*Math.min(dt,.05));
  // No opportunistic lane changes or reverse-to-middle fallback inside the bridge.
  const controlled=bridgeCommitted(c)||onBridge(c.root.position),angles=controlled?[0]:[0,.38,-.38,.8,-.8,1.25,-1.25];let next=null;
  for(const angle of angles){const dx=delta.x*Math.cos(angle)-delta.z*Math.sin(angle),dz=delta.x*Math.sin(angle)+delta.z*Math.cos(angle),candidate=walkPoint(c.root.position.clone().add(v(dx*step,0,dz*step)));
   if(!candidate||onBridge(candidate)&&bridgeOwner!==c&&!n.bridgeRecovery||occupied(candidate,c))continue;next=candidate;break;
  }
  if(!next){n.blocked+=dt;
   if(!controlled&&n.blocked>1){
    if(!c.isPlayer){const other=cats.find(o=>o!==c&&!o.isPlayer&&flatDistance(o.root.position,c.root.position)<DIAM+.45);if(other&&beginNpcContact(c,other)){n.blocked=0;return false;}}
    // Move a non-travelling resident off the reserved entry/exit, never command
    // a bridge traveller to reverse or overwrite another queued trip.
    for(const other of cats){const on=nav.get(other);if(other===c||other.isPlayer||on.bridgeTrip||on.bridgeRecovery||flatDistance(other.root.position,c.root.position)>DIAM+1.2)continue;
     if(bridgeCorridor(other.root.position))ordinaryPath(other,point(other.root.position.x<0?'plazaNorth':'catCafe'));
    }n.blocked=0;
   }return false;
  }
  n.blocked=0;const dx=next.x-c.root.position.x,dz=next.z-c.root.position.z,yaw=Math.atan2(dx,dz),diff=Math.atan2(Math.sin(yaw-c.root.rotation.y),Math.cos(yaw-c.root.rotation.y));c.root.rotation.y+=diff*Math.min(1,dt*9);c.root.position.copy(next);return true;
 }
 function moveNPC(c,dt){
  const n=nav.get(c);if(!n)return;
  if(n.bridgeTrip||n.bridgeRecovery){n.hold=0;c.state=move(c,dt,c.index%3===0?2.8:2.1)?'WANDER':'GROOM';return;}
  if(contactMembers.has(c)){const contact=contactMembers.get(c);c.state=contact.phase==='acting'?contact.action:'SNIFF_FLOWER';return;}
  if(n.socialDepartUntil>socialClock()){n.hold=0;c.state=move(c,dt,2.1)?'WANDER':'GROOM';return;}
  if(bridgeNoStop(c.root.position)){n.hold=n.wait=0;if(!n.path.length||n.path.some(onBridge))ordinaryPath(c,point(c.root.position.x<0?'plazaNorth':'catCafe'));c.state=move(c,dt,2.1)?'WANDER':'GROOM';return;}
  if(n.hold>0){n.hold-=dt;return;}
  if(!n.path.length){n.wait-=dt;if(n.wait>0)return;
   const side=bridgeSide(c.root.position),cross=(Math.floor(elapsed/7)+c.index)%4===0;
   const keys=Object.keys(townWaypoints).filter(k=>!k.startsWith('bridge')&&!k.startsWith('garden')&&!bridgeNoStop(point(k))&&(bridgeSide(point(k))===side)!==cross);
   if(keys.length&&!go(c,point(keys[(Math.floor(elapsed/7)+c.index)%keys.length]))){const local=keys.find(k=>bridgeSide(point(k))===side);if(local)ordinaryPath(c,point(local));}
   n.wait=2+c.index%4;
  }
  c.state=move(c,dt,c.index%3===0?2.8:2.1)?'WANDER':'GROOM';
 }
 /*__TOWN_CONTACT_RUNTIME__*/
 const ui=document.createElement('section');ui.className='town-player-ui pet-world-ui';ui.innerHTML='<div class="world-top"><div class="world-card"><strong data-player-name></strong><span data-player-status></span></div></div><div class="town-player-controls"><button data-player-mode="free">自由活动</button><button data-player-mode="guide">我来引导</button><button data-player-focus>跟着我的猫</button><button data-player-garden>去小花园</button><button data-player-next>下个路标</button><button data-player-settle>完成散步</button></div><section class="town-player-card world-event" hidden role="dialog" aria-label="小镇偶遇"><strong class="world-event-title"></strong><p class="world-event-copy"></p><div class="world-event-actions"></div></section>';panel.append(ui);
 const townActions=[['[data-player-mode=free]','roam','自由','自由活动'],['[data-player-mode=guide]','trip','引导','点击小路引导'],['[data-player-focus]','camera','跟随','跟随自己的小猫'],['[data-player-garden]','globe','庭院','走到外围小花园或回小镇'],['[data-player-next]','walk','路标','前往下个散步路标'],['[data-player-settle]','check','完成','按原规则完成散步']];
 for(const [selector,icon,label,accessible]of townActions){const button=ui.querySelector(selector);button.setAttribute('aria-label',accessible);button.innerHTML='<span class="town-button-icon" aria-hidden="true">'+(root.CatOfflineIcons?.svg(icon,22)||'')+'</span><span class="town-button-copy">'+label+'</span>';}
 for(const [key,icon,label]of [['home','home','回家'],['zoom-out',null,'−'],['zoom-in',null,'＋']]){const button=panel.querySelector('[data-host="'+key+'"]');if(button){button.innerHTML=(icon?'<span aria-hidden="true">'+(root.CatOfflineIcons?.svg(icon,22)||'')+'</span>':'')+'<span>'+label+'</span>';}}
 // Approved compact courtyard HUD; old controls remain owned but are not a permanent dock.
 ui.querySelector('.town-player-controls').hidden=true;
 const mini=document.createElement('div');mini.className='town-mini-actions';mini.innerHTML='<button type="button" data-player-toggle>我来引导</button><button type="button" data-player-overview aria-label="鸟瞰小镇">鸟瞰</button><button type="button" data-player-return hidden>回到小猫</button>';mini.querySelector('[data-player-toggle]').className='world-roam';ui.querySelector('.world-top').append(mini.querySelector('[data-player-toggle]'));mini.className='world-bottom town-bottom';ui.append(mini);
 const pocket=document.createElement('button');pocket.type='button';pocket.className='world-roam town-pocket-toggle';pocket.textContent='行程与口袋';pocket.setAttribute('aria-expanded','false');ui.querySelector('.world-top').append(pocket);
 const tripDetails=document.createElement('section');tripDetails.id='town-trip-sheet';tripDetails.dataset.mode='world';tripDetails.hidden=true;tripDetails.setAttribute('role','dialog');tripDetails.setAttribute('aria-modal','false');tripDetails.setAttribute('aria-label','行程与口袋');
 for(const selector of['.m-handle','.m-head']){const node=document.querySelector('#m-sheet '+selector)?.cloneNode(true);if(node){for(const item of[node,...node.querySelectorAll('[id]')])if(item.id)item.id='town-'+item.id;tripDetails.append(node);}}
 const title=tripDetails.querySelector('h2');if(title)title.textContent='行程与口袋';const close=tripDetails.querySelector('.m-head button');if(close){close.textContent='收起';close.setAttribute('aria-label','收起行程与口袋');}
 const tripActions=document.createElement('div');tripActions.id='town-trip-sheet-body';tripActions.className='town-trip-actions';tripDetails.append(tripActions);
 for(const button of panel.querySelectorAll('[data-host^=zoom]')){button.classList.add('town-camera-control');tripActions.append(button);}
 tripActions.append(ui.querySelector('[data-player-next]'),ui.querySelector('[data-player-settle]'),mini.querySelector('[data-player-overview]'),mini.querySelector('[data-player-return]'),ui.querySelector('[data-player-garden]'));
 const tripLabel=document.createElement('p');tripLabel.className='world-hint';tripActions.prepend(tripLabel);ui.append(tripDetails);
 function setDrawer(open){tripDetails.hidden=!open;tripDetails.classList.toggle('on',open);pocket.setAttribute('aria-expanded',String(open));pocket.textContent=open?'收起行程':'行程与口袋';}
 pocket.addEventListener('click',()=>{if(!coreActive)setDrawer(tripDetails.hidden);});close?.addEventListener('click',()=>setDrawer(false));
 function setCore(value){if(value===coreActive)return;if(value){drawerBeforeCore=!tripDetails.hidden;setDrawer(false);}coreActive=value;panel.dataset.townCore=String(value);if(!value&&drawerBeforeCore){setDrawer(true);drawerBeforeCore=false;}}
 const gateButton=document.createElement('button');gateButton.type='button';gateButton.className='town-garden-gate';gateButton.dataset.sceneGarden='';gateButton.textContent='小花园 →';ui.append(gateButton);
 const goalMarker=new THREE.Group();scene.add(goalMarker);createVoxel(.9,.06,.9,'#83b9ad',0,.05,0,goalMarker);createVoxel(.28,.08,.28,'#fff4d8',0,.10,0,goalMarker);goalMarker.visible=false;
 const gardenFlower=new THREE.Group();gardenFlower.name='可闻的庭院小花';gardenFlower.position.set(33,1.1,14);scene.add(gardenFlower);createVoxel(.12,.72,.12,'#73987c',0,.36,0,gardenFlower);createVoxel(.34,.16,.34,'#e8d59b',0,.78,0,gardenFlower);for(const[x,z]of[[.28,0],[-.28,0],[0,.28],[0,-.28]])createVoxel(.32,.16,.32,'#deb598',x,.76,z,gardenFlower);
 const status=ui.querySelector('[data-player-status]'),card=ui.querySelector('.town-player-card'),marker=new THREE.Group();scene.add(marker);createVoxel(.7,.08,.9,'#f3c68e',0,.02,0,marker);createVoxel(.22,.08,.22,'#8ba487',.35,.02,-.55,marker);
 const navigationGuide='轻点小路或桥面，带小猫去逛逛';let navigationErrorUntil=0;
 function say(text){navigationErrorUntil=0;status.textContent=text;}
 function navigationError(text){say(text);navigationErrorUntil=elapsed+3;}
 function clearAmbient(restore=false){if(!ambient)return;const old=ambient;ambient=null;gardenFlower.rotation.z=0;butterfly.visible=false;nav.get(own).hold=0;if(restore)nav.get(own).path=old.path;ambientNext=elapsed+9;own.profile.thoughts=['闻闻花香，再去看看小镇。'];root.CatTownExperience?.sceneChanged('ambient_finished');}
 function startAmbient(){
  const type=ambientCount++%2===0?'flower':'butterfly',target=point(type==='flower'?'gardenNorth':'gardenSouthPath'),path=nav.get(own).path.map(p=>p.clone());
  if(!go(own,target)){ambientNext=elapsed+9;return;}
  ambient={type,target,path,phase:'approach',until:Infinity};if(type==='butterfly'){butterfly.visible=true;butterfly.position.copy(target).add(v(1,2,0));}
  say(type==='flower'?'小猫走向路边的小花。':'小猫发现了花边的蝴蝶，慢慢走近。');root.CatTownExperience?.sceneChanged('ambient_approach');
 }
 function updateAmbient(){
  if(!ambient)return;
  if(ambient.phase==='approach'&&own.root.position.distanceTo(ambient.target)<.45){ambient.phase='action';ambient.until=elapsed+4.5;nav.get(own).path=[];nav.get(own).hold=4.5;const target=ambient.type==='flower'?gardenFlower.position:butterfly.position;own.root.rotation.y=Math.atan2(target.x-own.root.position.x,target.z-own.root.position.z);own.profile.thoughts=[ambient.type==='flower'?'花香钻进鼻子里，轻轻闻一闻。':'别飞太快呀，我只轻轻碰一下。'];own.thoughtIndex=0;say(own.profile.thoughts[0]);root.CatTownExperience?.sceneChanged('ambient_action');}
  if(ambient.phase==='action'&&elapsed>=ambient.until){clearAmbient(true);say('小猫抖抖耳朵，继续在庭院自由走动。');mode='free';freeAt=elapsed+2;ui.querySelector('[data-player-toggle]').textContent='我来引导';}
 }
 function focus(){followState.catIndex=own.index;toggleFollowMode(true);}
 function setMode(value){if(eventPhase!=='idle')return;finishOwnContact(false);clearAmbient();mode=value;destination=null;goalMarker.visible=false;ui.querySelector('[data-player-toggle]').textContent=value==='free'?'我来引导':'自由活动';interacting=null;if(value==='guide'&&!nav.get(own).bridgeTrip&&!nav.get(own).bridgeRecovery)nav.get(own).path=[];for(const b of ui.querySelectorAll('[data-player-mode]'))b.setAttribute('aria-pressed',String(b.dataset.playerMode===mode));say(mode==='free'?'小猫沿路自由活动；点地面也可以带路。':navigationGuide);focus();}
 function next(){if(!journey[collected])return;say('走向'+townWaypoints[journey[collected].key].name);if(!go(own,goalPoint(journey[collected].key)))go(own,point('plazaEast'));}
 function renderProgress(){const current=journey[collected];tripLabel.textContent='散步路标 '+collected+'/'+journey.length+' · '+(currentPlace==='garden'?'暖阳庭院':'喵喵小镇');marker.visible=!!current;if(current)marker.position.copy(goalPoint(current.key));ui.querySelector('[data-player-next]').hidden=!current;ui.querySelector('[data-player-settle]').disabled=collected<journey.length||!session||ended;}
 function showCard(title,copy,choices){card.querySelector('.world-event-title').textContent=title;card.querySelector('p').textContent=copy;const row=card.querySelector('div');row.replaceChildren();for(const [label,fn]of choices){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>{card.hidden=true;fn();if(card.hidden&&eventPhase==='idle'&&elapsed>=chatUntil)setCore(false);});row.append(b);}card.hidden=false;setCore(true);nav.get(own).path=[];}
 function resident(c){
  if(!ownContact||ownContact.other!==c||bridgeNoStop(own.root.position)||bridgeNoStop(c.root.position)||nav.get(own).bridgeTrip||nav.get(c).bridgeTrip){finishOwnContact(true);return;}
  ownContact.phase='choosing';ownContact.until=Math.min(ownContact.hardUntil,socialClock()+8000);interacting=null;
  const face=c.root.position.clone().sub(own.root.position);own.root.rotation.y=Math.atan2(face.x,face.z);c.root.rotation.y=own.root.rotation.y+Math.PI;
  const n=nav.get(c);n.path=[];n.hold=8;nav.get(own).hold=8;chatUntil=elapsed+8;c.state=own.state='SNIFF_FLOWER';
  const token=ownContact;
  const choose=state=>{if(ownContact!==token)return;ownContact.phase='acting';ownContact.action=state;ownContact.until=Math.min(ownContact.hardUntil,socialClock()+4000);n.hold=nav.get(own).hold=4;chatUntil=elapsed+4;c.state=own.state=state;say(state==='PLAY'?'陪它玩一小会儿，然后继续走走。':'一起闻了闻花香，过会儿各自散步。');};
  showCard(c.profile.name,c.profile.thoughts[(Math.floor(elapsed)+c.index)%c.profile.thoughts.length]+' · 镇上居民互动；点地面可随时结束并带路。',[['一起闻花',()=>choose('SNIFF_FLOWER')],['陪它玩一会',()=>choose('PLAY')],['结束互动，继续散步',()=>{finishOwnContact(true);say('打过招呼，继续散步。');}]]);
 }
 function clickNpc(index){
  if(eventPhase!=='idle')return;const c=cats[index];if(!c||c===own){focus();return;}
  if(ownContact?.other===c){say('正在和它打招呼；点小路可以结束互动。');return;}
  if(bridgeNoStop(c.root.position)||nav.get(c).bridgeTrip||nav.get(c).bridgeRecovery||nav.get(own).bridgeTrip||nav.get(own).bridgeRecovery){say('它正在过桥，等它走到岸边再打招呼。');return;}
  const previous=ownContact?.saved;if(ownContact)finishOwnContact(false);
  if(!pairReady(own,c)){say('先各自走开一点、逛一会儿，再来打招呼吧。');return;}
  const saved=previous||{mode,path:nav.get(own).path.map(p=>p.clone())};finishOwnContact(false);clearAmbient();setMode('guide');
  ownContact={other:c,saved,phase:'approach',until:socialClock()+12000,hardUntil:socialClock()+20000};socialReturn=saved;interacting=c;contactMembers.set(own,ownContact);contactMembers.set(c,ownContact);
  nav.get(c).hold=12;nav.get(c).path=[];c.state='GROOM';const dir=own.root.position.clone().sub(c.root.position);dir.y=0;if(dir.length()<.1)dir.set(1,0,0);
  const desired=c.root.position.clone().addScaledVector(dir.normalize(),DIAM+.35),snap=nearest(desired);
  if(!snap||!go(own,snap.q)){finishOwnContact(true);say('暂时走不到它身边，先继续散步吧。');return;}say('走近'+c.profile.name+'，停在它面前。');focus();
 }
 function goalPoint(key){const base=point(key);if(walkPoint(base))return base;let best=null,distance=Infinity;for(const[a,b]of segments)if(a===key||b===key)for(let i=0;i<=24;i++){const q=point(a).lerp(point(b),i/24),d=q.distanceTo(base);if(d<distance&&walkPoint(q)){best=q;distance=d;}}return best||base;}
 function targetPoint(p,place=null){finishOwnContact(false);clearAmbient();socialReturn=null;const target=onBridge(p)?point(bridgeSide(own.root.position)==='west'?'catCafe':'fishShop'):bridgeNoStop(p)?point(bridgeSide(p)==='west'?'fishShop':'catCafe'):p;const q=walkPoint(target);if(!q||!go(own,q)){navigationError('这里暂时没有可通行的小路，请换个路口。');return false;}mode='guide';interacting=null;chatUntil=0;nav.get(own).hold=0;intro=3.8;destination={point:q.clone(),place};if(place)root.CatTownExperience?.sceneChanged('moving_to_'+place);goalMarker.position.copy(q);goalMarker.visible=true;ui.querySelector('[data-player-toggle]').textContent='自由活动';focus();say(nav.get(own).bridgeTrip?'在岸边等候；桥空出来后会自动连续走到对岸。':place==='garden'?'沿路前往自己的暖阳庭院。':place==='street'?'沿入口步道回小镇。':'已设下脚印，跟着自己的猫走过去。');setDrawer(false);return true;}
 function pick(e){
  if(eventPhase!=='idle'||(!card.hidden&&!ownContact)||!tripDetails.hidden)return;
  const rect=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);raycaster.setFromCamera(mouse,camera);
  // The arched deck is above the ground plane. Use its actual mesh hit for
  // picking only; the existing road graph, bank lease and collisions still rule.
  const decks=occludableGroups.flatMap(group=>group.meshes).filter(mesh=>mesh.userData.townBridgeDeck);
  const deck=raycaster.intersectObjects(decks,false)[0];if(deck){const snapped=nearest(deck.point);if(snapped&&validSolid(snapped.q)){targetPoint(snapped.q);return;}}
  const ray=raycaster.ray;if(Math.abs(ray.direction.y)<.001)return;const t=(1-ray.origin.y)/ray.direction.y;if(t<=0)return;
  const raw=ray.origin.clone().addScaledVector(ray.direction,t),snap=nearest(raw);
  if(!validSolid(raw)){navigationError(Math.abs(raw.x)<4.8+RADIUS?'这里是河面，请点桥面或岸边小路。':'这里有建筑，请点旁边的小路。');return;}
  if(!snap||snap.distance>2.6||!validSolid(snap.q)){navigationError('这里没有可通行的小路，请换个位置。');return;}targetPoint(snap.q);
 }
 function handlePointer(e){if(eventPhase!=='idle'||(!card.hidden&&!ownContact)||!tripDetails.hidden)return;const rect=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);camera.updateMatrixWorld(true);scene.updateMatrixWorld(true);raycaster.setFromCamera(mouse,camera);
  const visibleMeshes=[];for(const cat of cats)if(cat!==own)cat.root.traverse(mesh=>{if(mesh.isMesh&&mesh.visible&&mesh.material&&mesh.material.visible!==false&&(!mesh.material.transparent||mesh.material.opacity>.25)){mesh.userData.townPickedCat=cat.index;visibleMeshes.push(mesh);}});
  const hit=raycaster.intersectObjects(visibleMeshes,false)[0];if(hit){clickNpc(hit.object.userData.townPickedCat);return;}pick(e);
 }
 function beginEvent(type){
  finishOwnContact(false);
  clearAmbient(true);socialReturn=null;
  eventSavedPath=interacting||chatUntil>elapsed?[]:nav.get(own).path.map(p=>p.clone());interacting=null;chatUntil=0;nav.get(own).path=[];nav.get(own).hold=0;own.state='GROOM';lastMoving=false;
  for(const [cat,n]of nav)if(cat!==own)n.hold=0;
  own.profile.thoughts=[{rain:'雨落到鼻尖了，先停下来缩缩耳朵。',butterfly:'蝴蝶停在花上，蹲下来看看。','lost-pouch':'路旁有个小包，回头等你一起看看。'}[type]];own.thoughtIndex=0;eventType=type;eventChoice=null;eventPhase='choosing';eventResumeAt=Infinity;butterfly.position.copy(own.root.position).add(v(1,1.8,1));butterfly.visible=type==='butterfly';eventFx.start(type);eventFx.frame(0);
  for(const b of ui.querySelectorAll('[data-player-toggle],[data-player-overview],[data-player-return],#town-trip-sheet button,[data-scene-garden]'))b.disabled=true;
 }
 function endEvent(){setCore(false);own.profile.thoughts=['闻闻花香，再去看看小镇。'];eventFx.cleanup();eventType=null;eventChoice=null;eventPhase='idle';eventResumeAt=0;butterfly.visible=false;own.state='GROOM';chatUntil=0;nav.get(own).path=eventSavedPath;eventSavedPath=[];for(const b of ui.querySelectorAll('[data-player-toggle],[data-player-overview],[data-player-return],#town-trip-sheet button,[data-scene-garden]'))b.disabled=false;renderProgress();say('偶遇结束，继续陪小猫逛逛；本次选择在完成散步时按原规则保存。');}
 function story(){if(ownContact)return;if(bridgeNoStop(own.root.position)||nav.get(own).bridgeTrip||nav.get(own).bridgeRecovery)return;if(!session||eventShown||ended||!root.CatTownEventCatalogue)return;eventShown=true;const kinds=['butterfly','lost-pouch','rain'],type=kinds[[...String(session.token)].reduce((a,c)=>a+c.charCodeAt(0),0)%3],catalog=root.CatTownEventCatalogue(profile),item=catalog[type];beginEvent(type);showCard(item[0],item[1],item[2].map(([choice,label])=>[label,()=>{const result=store.applyWorldChoice(session.token,type,choice);say(result.message||'已记录本次选择，完成散步后按原规则保存。');if(!result.ok){card.hidden=false;return;}eventChoice=choice;eventPhase='reacting';eventResumeAt=elapsed+4.6;eventFx.choose(choice);} ]));}
 let eventType=null,eventUntil=0;const pouch=new THREE.Group();scene.add(pouch);createVoxel(.6,.45,.35,'#bd9271',0,.23,0,pouch);createVoxel(.65,.12,.4,'#e6bf91',0,.48,0,pouch);pouch.visible=false;const butterfly=new THREE.Group();scene.add(butterfly);createVoxel(.12,.25,.12,'#775e69',0,0,0,butterfly);const leftWing=createVoxel(.5,.32,.06,'#ebbd8a',-.28,.06,0,butterfly),rightWing=createVoxel(.5,.32,.06,'#ebbd8a',.28,.06,0,butterfly);butterfly.visible=false;
 const eventFx=root.CatTownEventFx.create({parent:panel,view:{cat:ownerRoot,canvas:renderer.domElement,scene,hemi:{get intensity(){return hemiLight._legacyIntensity??hemiLight.intensity},set intensity(value){hemiLight.intensity=value}},sun:{get intensity(){return dirLight._legacyIntensity??dirLight.intensity},set intensity(value){dirLight.intensity=value}},bf:butterfly,ev:card,proj(p){const q=p.clone().project(camera);return{x:(q.x+1)/2,y:(1-q.y)/2};}}});
 function prepareProfile(value){playerModel.setStage(value.stage);playerModel.setAppearance({breed:value.breed,outfit:'none'});playerModel.applyAnimation('idle',0);visual.position.y=0;playerModel.root.scale.setScalar(1);const box=new THREE.Box3().setFromObject(playerModel.root),size=box.getSize(new THREE.Vector3()),stage={kitten:.64,baby:.64,young:.82,adult:1}[value.stage]||1;playerModel.root.scale.setScalar(2.25*stage/Math.max(1,size.y));box.setFromObject(playerModel.root);visual.position.y=ownerRoot.position.y-box.min.y;playerModel.setAppearance({breed:value.breed,outfit:value.outfit,stage:value.stage});}
 function begin(value,trip,engine){clearContacts();clearAmbient();ambientNext=10;ambientCount=0;socialReturn=null;setCore(false);setDrawer(false);destination=null;eventSavedPath=[];currentPlace='street';goalMarker.visible=false;own.profile.thoughts=['闻闻花香，再去看看小镇。'];eventFx.cleanup();eventPhase='idle';eventChoice=null;eventResumeAt=0;profile=value;session=trip;store=engine;elapsed=0;started=performance.now();intro=0;ended=false;eventShown=false;collected=0;mode='free';interacting=null;card.hidden=true;eventType=null;eventUntil=0;butterfly.visible=false;pouch.visible=false;own.profile.name=value.name;own.profile.role='你的猫 · '+(value.stageLabel||value.stage||'');prepareProfile(value);const start=point('plazaWest');own.root.position.copy(!occupied(start,own)&&validSolid(start)?start:(candidates.find(p=>!occupied(p,own)&&validSolid(p))||start));nav.get(own).path=[];resetBridgeTraffic();journey=(trip?.nodes||[]).map((n,i)=>({...n,key:['fishShop','bakery','southWest','gardenCenter','plazaEast','catCafe'][i%6]}));ui.querySelector('[data-player-name]').textContent=value.name+' · 小镇散步';setMode('free');resetOverviewCamera();orbitState.target.set(8,4,4);orbitState.radius=Math.min(overviewRadius()+40,overviewRadius()*1.18);renderProgress();say('先看看完整小镇，稍后跟随'+value.name+'。');}
 function update(dt,time){lastMoving=false;elapsed+=dt;if(navigationErrorUntil&&elapsed>=navigationErrorUntil)say(nav.get(own).bridgeTrip?'在桥外等候，轮到你会连续走到对岸。':navigationGuide);ui.querySelector('[data-player-return]').hidden=followState.active;const gate=v(22,4,20).project(camera);gateButton.hidden=true;gateButton.textContent=own.root.position.x>21?'← 回小镇':'小花园 →';gateButton.style.left=(gate.x*.5+.5)*100+'%';gateButton.style.top=(-gate.y*.5+.5)*100+'%';const gardenButton=ui.querySelector('[data-player-garden]'),gardenLabel=currentPlace==='garden'?'回小镇':'去自己的小花园';const gardenCopy=gardenButton.querySelector('.town-button-copy');if(gardenCopy.textContent!==gardenLabel)gardenCopy.textContent=gardenLabel;if(intro<3.8){intro+=dt;if(intro>=3.8)focus();return;}if(root.CatOfflineDurable?.transactionPaused)return;if(!ownContact&&coreActive&&eventPhase==='idle'&&card.hidden&&elapsed>=chatUntil){setCore(false);if(socialReturn){mode=socialReturn.mode;nav.get(own).path=socialReturn.path;socialReturn=null;freeAt=elapsed+2;ui.querySelector('[data-player-toggle]').textContent=mode==='free'?'我来引导':'自由活动';say('和居民打过招呼，继续散步。');}}if(destination&&own.root.position.distanceTo(destination.point)<.4){const reached=destination;destination=null;goalMarker.visible=false;if(reached.place){currentPlace=reached.place;if(currentPlace==='garden'){mode='free';ambientNext=elapsed+.6;freeAt=elapsed+1;}root.CatTownExperience?.sceneChanged('arrived_'+currentPlace);ui.querySelector('[data-player-name]').textContent=profile.name+' · '+(currentPlace==='garden'?'暖阳庭院':'小镇散步');say(currentPlace==='garden'?'到自己的小花园了；可自由走动，行程与口袋里可回小镇。':'已沿原路回到小镇。');renderProgress();}}if(currentPlace==='garden'&&!ambient&&!destination&&!interacting&&eventPhase==='idle'&&card.hidden&&!coreActive&&elapsed>ambientNext)startAmbient();updateAmbient();if(nav.get(own).hold>0)nav.get(own).hold-=dt;let moving=false;if(eventPhase==='idle'&&card.hidden&&(nav.get(own).hold<=0||bridgeCommitted(own))){if(interacting){nav.get(interacting).hold=Math.max(nav.get(interacting).hold,1);const distance=own.root.position.distanceTo(interacting.root.position);if(distance<=DIAM+.65){const c=interacting;interacting=null;resident(c);}else if(elapsed>freeAt){freeAt=elapsed+1;const delta=own.root.position.clone().sub(interacting.root.position);delta.y=0;if(delta.length()<.1)delta.set(1,0,0);const q=nearest(interacting.root.position.clone().addScaledVector(delta.normalize(),DIAM+.35));go(own,q.q);}}if(mode==='free'&&!ambient&&!nav.get(own).bridgeTrip&&!nav.get(own).bridgeRecovery&&!nav.get(own).path.length&&elapsed>freeAt){freeAt=elapsed+3;if(currentPlace==='garden'){go(own,point(['gardenCenter','gardenNorth','gardenSouthPath'][Math.floor(elapsed/5)%3]));}else if(journey[collected])next();else{const k=Object.keys(townWaypoints)[Math.floor(elapsed/5)%Object.keys(townWaypoints).length];go(own,point(k));}}moving=move(own,dt,2.6);}lastMoving=moving;own.state=moving?'WANDER':elapsed<chatUntil?own.state:'GROOM';own.animPhase+=dt*(moving||own.state==='PLAY'?7:1);playerModel.applyAnimation(moving||own.state==='PLAY'?'walk':'idle',own.animPhase);const head=playerModel.bones.get('head');if(head&&!moving&&own.state==='SNIFF_FLOWER')head.rotation.x-=.22;
 if(ambient){if(ambient.type==='butterfly'){butterfly.visible=true;const q=ambient.target;butterfly.position.set(q.x+1+Math.sin(elapsed*1.8)*.5,q.y+1.6+Math.sin(elapsed*2.3)*.3,q.z+Math.cos(elapsed*1.4)*.5);leftWing.rotation.y=Math.sin(elapsed*11)*.8;rightWing.rotation.y=-leftWing.rotation.y;}if(ambient.phase==='action'){lastMoving=false;playerModel.applyAnimation(ambient.type==='butterfly'?'paw':'idle',elapsed);const head=playerModel.bones.get('head');if(head&&ambient.type==='flower')head.rotation.x-=.24;gardenFlower.rotation.z=Math.sin(elapsed*3)*.07;}}
 if(eventPhase==='idle'&&session&&!ended&&journey[collected]&&own.root.position.distanceTo(goalPoint(journey[collected].key))<1.1){const result=store.collectWorldItem(session.token,journey[collected].id);if(result.ok){collected++;say('路标 '+collected+'/'+journey.length+' · '+result.message);renderProgress();}}
 if(elapsed>9&&card.hidden&&eventPhase==='idle')story();
 if(eventPhase!=='idle'){lastMoving=false;own.state='GROOM';playerModel.applyAnimation(eventType==='butterfly'&&eventChoice==='coins'?'walk':'idle',elapsed*5);eventFx.pose(playerModel,ownerRoot,elapsed,false);eventFx.frame(dt);if(eventType==='butterfly'){butterfly.visible=eventFx.moveButterfly(butterfly,ownerRoot,elapsed);leftWing.rotation.y=Math.sin(elapsed*9)*.65;rightWing.rotation.y=-leftWing.rotation.y;}if(eventPhase==='reacting'&&elapsed>=eventResumeAt)endEvent();}
 }

 listen(ui,'click',e=>{const b=e.target.closest('button');if(!b)return;if(eventPhase!=='idle'&&!b.closest('.world-event-actions'))return;if(b.dataset.playerMode)setMode(b.dataset.playerMode);if(b.hasAttribute('data-player-toggle'))setMode(mode==='free'?'guide':'free');if(b.hasAttribute('data-player-overview'))resetOverviewCamera();if(b.hasAttribute('data-player-return'))focus();if(b.hasAttribute('data-scene-garden')){setMode('guide');const back=own.root.position.x>21;go(own,point(back?'gardenSouth':'gardenCenter'));say(back?'沿入口步道走回小镇。':'沿入口步道走进小花园；点小镇道路可以原路回去。');}if(b.hasAttribute('data-player-focus'))focus();if(b.hasAttribute('data-player-garden'))targetPoint(point(currentPlace==='garden'?'gardenSouth':'gardenCenter'),currentPlace==='garden'?'street':'garden');if(b.hasAttribute('data-player-next')&&journey[collected])targetPoint(goalPoint(journey[collected].key));if(b.hasAttribute('data-player-settle')&&session&&!ended){const result=store.settleWorldActivity(session.token);say(result.message||'本次散步尚未完成。');if(result.ok){ended=true;session=null;renderProgress();}}});
 prepareProfile(profile);
 const prev=panel.querySelector('#btn-prev-cat'),nextCat=panel.querySelector('#btn-next-cat');if(prev)prev.hidden=true;if(nextCat)nextCat.hidden=true;
 return{begin,update,serviceBridge,serviceSocial,moveNPC,pick,handlePointer,clickNpc,focus,own,leave(){clearContacts();bridgeOwner=null;bridgeQueue.clear();for(const n of nav.values()){n.bridgeTrip=null;n.bridgeRecovery=false;}clearAmbient();socialReturn=null;setCore(false);setDrawer(false);goalMarker.visible=false;eventFx.cleanup();eventPhase='idle';eventChoice=null;card.hidden=true;interacting=null;butterfly.visible=false;pouch.visible=false;nav.get(own).path=[];},get completed(){return ended;},get projection(){return{scene:'away',action:lastMoving?'walk':ambient?.phase==='action'&&ambient.type==='butterfly'?'play':'idle',weather:eventType==='rain'&&eventPhase!=='idle'?'rain':'clear',petId:profile.id,region:currentPlace,revision:root.CatTownExperience?.sceneRevision||0,source:'town-original-store'};}};
}
