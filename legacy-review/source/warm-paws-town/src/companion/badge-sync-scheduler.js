/** Mounted historical snapshot scheduler. No rebinding, activity field, or session extension. */
export class BadgeSyncScheduler {
 constructor({getOwner,getBadge,storage,canRun=()=>true,onStatus=()=>{},now=()=>Date.now()}){Object.assign(this,{getOwner,getBadge,storage,canRun,onStatus,now});this.running=false;this.retryAt=0;}
 key(owner){return `badge-sync-pending:${encodeURIComponent(owner)}`;}
 mark(){const owner=this.getOwner();if(!owner)return;const key=this.key(owner),old=Number(this.storage.getItem(key)||0);if(!Number.isSafeInteger(old)||old<0||old>=Number.MAX_SAFE_INTEGER)throw new Error('同步待办损坏。');this.storage.setItem(key,String(old+1));}
 async flush(){
  const owner=this.getOwner(),badge=this.getBadge();if(!owner||!badge||this.running||!this.canRun()||this.now()<this.retryAt||badge.transport.pending)return false;
  const pending=this.storage.getItem(this.key(owner));if(!pending)return false;
  const revision=Number(pending);if(!Number.isSafeInteger(revision)||revision<1)throw new Error('同步待办非法。');
  try{badge.requireSession();}catch{return false;}
  const sessionId=badge.session.id,generation=badge.client.generation;
  const current=()=>{badge.requireSession();if(!this.canRun()||owner!==this.getOwner()||badge!==this.getBadge()||sessionId!==badge.session.id||generation!==badge.client.generation)throw new Error('自动同步会话已改变。');};
  this.running=true;
  try{
   await badge.transport.exclusive(async()=>{for(const kind of [9,3,4]){current();const object=await badge.api.request(`/api/devices/${badge.deviceId()}/signed-objects`,{method:'POST',body:{sessionId,kind}});current();const raw=Uint8Array.from(atob(object.envelopeBase64),c=>c.charCodeAt(0)),hex=[...raw.slice(0,16)].map(v=>v.toString(16).padStart(2,'0')).join(''),body=raw.slice(20,-32);
     if(object.kind!==kind||hex!==sessionId.replaceAll('-','').toLowerCase()||(kind===9&&body.length!==6)||(kind===3&&(body.length!==27||body[0]!==1))||(kind===4&&(body.length<13||body[0]!==1||body[11]>24||body[12]>24||body.length!==13+body[11]*5+body[12]*3)))throw new Error('同步封包会话或布局不匹配。');
     await badge.transport.writeObject(kind,raw);current();}});
   if(this.storage.getItem(this.key(owner))===pending)this.storage.removeItem(this.key(owner));this.retryAt=0;this.onStatus('设备已确认最新绑定猫快照；不包含尚未冻结的活动字段。');return true;
  }catch(error){this.retryAt=this.now()+5000;this.onStatus(`设备同步待重试：${error.message}`);return false;}finally{this.running=false;}
 }
}
