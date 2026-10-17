import {encodeBase64} from '../ble/protocol.js';
const hex=raw=>[...raw].map(v=>v.toString(16).padStart(2,'0')).join('');
/** 只解码固件真实前台活跃证据；手机心跳、页面停留不作为活跃时间。 */
export function decodeActiveEvent(raw,{sessionId,catId,now=Date.now()}={}){
 if(!raw||raw.length!==71||raw[0]!==1)throw new Error('活跃事件布局非法，设备队头保留。');
 const v=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),eventId=v.getBigUint64(1,true).toString(),alias=v.getUint32(9,true),from=v.getUint32(13,true),to=v.getUint32(17,true),activeSeconds=v.getUint16(21,true),session=hex(raw.slice(23,39));
 if(eventId==='0'||!alias||catId!==`cat-${alias}`||!sessionId||session!==sessionId.replaceAll('-','').toLowerCase()||to<=from||to-from>10||!activeSeconds||activeSeconds>to-from||to>Math.floor(now/1000)+1)throw new Error('活跃事件猫咪、会话或时间窗不符，未上传或删除；请校时并核对绑定。');
 return{eventId,alias,from,to,activeSeconds,sessionId};
}
export class ActiveEvents {
 constructor({getOwner,getBadge,getCatId,canRun=()=>true,now=()=>Date.now(),onStatus=()=>{}}){Object.assign(this,{getOwner,getBadge,getCatId,canRun,now,onStatus});this.busy=false;this.retryAt=0;}
 async flush({limit=8}={}){
  const owner=this.getOwner(),badge=this.getBadge();if(!owner||!badge||this.busy||!this.canRun()||badge.transport.pending||this.now()<this.retryAt)return false;
  try{badge.requireSession();}catch{return false;}
  const session=badge.session,generation=badge.client.generation,catId=this.getCatId();
  const current=()=>{badge.requireSession();if(owner!==this.getOwner()||badge!==this.getBadge()||session!==badge.session||generation!==badge.client.generation||catId!==this.getCatId()||!this.canRun())throw new Error('活跃传输期间账号、猫咪或会话改变；队头保留。');};
  this.busy=true;let processed=0;
  try{for(let i=0;i<Math.min(32,Math.max(1,limit));i++){current();const raw=await badge.transport.read(24);current();if(!raw)break;const event=decodeActiveEvent(raw,{sessionId:session.id,catId,now:this.now()});const response=await badge.api.request(`/api/devices/${badge.deviceId()}/active-batches`,{method:'POST',body:{sessionId:session.id,events:[{eventId:event.eventId,signedEventBase64:encodeBase64(raw)}]}});current();const result=response?.results?.find(r=>r.eventId===event.eventId);if(result?.isTerminal!==true)throw new Error(result?.msg||'活跃事件尚无持久终态，队头保留。');await badge.signed(25,event.eventId,{current});current();processed++;}this.retryAt=0;if(processed)this.onStatus(`已确认${processed}条设备真实活跃终态；没有手机心跳补造。`);return processed>0;
  }catch(error){this.retryAt=this.now()+5000;if(owner===this.getOwner())this.onStatus(error.message);return false;}finally{this.busy=false;}
 }
}
