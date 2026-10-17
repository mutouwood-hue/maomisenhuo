/** 只恢复服务器已确认的独立授权；定期复核撤回与租约，不 PUT 重授或推进 revision。 */
export class EnvironmentResume {
 constructor({getOwner,getStorage,getBadge,readConsent,requireEligibility,canRun=()=>true,onConfirmed=()=>{},onError=()=>{},now=()=>Date.now(),checkIntervalMs=15000,renewBeforeMs=30000}){Object.assign(this,{getOwner,getStorage,getBadge,readConsent,requireEligibility,canRun,onConfirmed,onError,now,checkIntervalMs,renewBeforeMs});this.busy=false;this.retryAt=0;this.confirmed=null;this.nextCheckAt=0;this.expiresAt=0;}
 async flush(){
  const owner=this.getOwner(),storage=this.getStorage(),badge=this.getBadge();
  if(!owner||!badge||this.busy||!this.canRun()||badge.transport.pending||this.now()<this.retryAt||storage.getItem('m2-pending-env-revoke')==='true')return false;
  try{badge.requireSession();}catch{return false;}
  const session=badge.session,generation=badge.client.generation;
  const current=()=>{badge.requireSession();if(!this.canRun()||owner!==this.getOwner()||badge!==this.getBadge()||session!==badge.session||generation!==badge.client.generation||storage.getItem('m2-pending-env-revoke')==='true')throw new Error('环境恢复期间授权或会话改变。');};
  const connection=owner+':'+session.id+':'+generation;
  if(this.confirmed?.connection===connection&&storage.getItem('m2-pending-env-grant')!=='true'&&this.now()<this.nextCheckAt&&(!this.confirmed.isGranted||this.now()<this.expiresAt-this.renewBeforeMs))return false;
  this.busy=true;
  try{
   const value=await this.readConsent();current();
   if(typeof value?.isEnvironmentGranted!=='boolean'||!Number.isSafeInteger(value.revision)||value.revision<0)throw new Error('环境授权回执格式不合法。');
   if(value.isEnvironmentGranted){await this.requireEligibility();current();}
   const unchanged=this.confirmed?.connection===connection&&this.confirmed.revision===value.revision&&this.confirmed.isGranted===value.isEnvironmentGranted;
   if(unchanged&&storage.getItem('m2-pending-env-grant')!=='true'&&(!value.isEnvironmentGranted||this.now()<this.expiresAt-this.renewBeforeMs)){this.nextCheckAt=this.now()+this.checkIntervalMs;return false;}
   const receipt=await badge.signed(11,undefined,{...value,current});current();
   if(value.isEnvironmentGranted&&(!Number.isFinite(receipt?.expiresAt)||receipt.expiresAt<=this.now()))throw new Error('设备环境授权有效期未确认。');
   storage.setItem('m2-pending-env-grant','false');this.confirmed={connection,revision:value.revision,isGranted:value.isEnvironmentGranted};this.expiresAt=receipt?.expiresAt??0;this.nextCheckAt=this.now()+this.checkIntervalMs;this.retryAt=0;this.onConfirmed(value);return true;
  }catch(error){this.retryAt=this.now()+5000;if(owner===this.getOwner()){this.onError(error);}return false;}finally{this.busy=false;}
 }
}
