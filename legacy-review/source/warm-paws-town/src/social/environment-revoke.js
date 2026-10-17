/** Persist OFF until cloud revocation and current-device signed11 ACK both succeed. */
export class EnvironmentRevoke {
 constructor({getOwner,getStorage,getDevice,getCloud,revokeCloud,onStatus=()=>{},now=()=>Date.now()}){Object.assign(this,{getOwner,getStorage,getDevice,getCloud,revokeCloud,onStatus,now});this.busy=false;this.retryAt=0;}
 pending(){return this.getStorage().getItem('m2-pending-env-revoke')==='true';}
 mark(){const storage=this.getStorage(),revision=Number(storage.getItem('m2-env-revoke-seq')||0)+1;storage.setItem('m2-env-revoke-seq',String(revision));storage.setItem('m2-pending-env-revoke','true');this.retryAt=0;}
 async flush(){
  if(!this.getOwner()||!this.pending()||this.busy||this.now()<this.retryAt)return false;
  const owner=this.getOwner(),storage=this.getStorage(),sequence=storage.getItem('m2-env-revoke-seq');const current=()=>{if(owner!==this.getOwner())throw new Error('撤回期间账号改变。');};this.busy=true;
  try{
   // STOP is independent of HTTP and always attempted first, even offline.
   try{await this.getDevice().emergencyStop();current();}catch(error){current();this.onStatus('设备停采未确认，请在吧唧本地关闭；云端撤回仍继续。');}
   let value=this.getCloud();if(!value||value.isEnvironmentGranted){value=await this.revokeCloud(value?.revision??0);current();}
   if(value.isEnvironmentGranted!==false)throw new Error('云端撤回尚未确认。');
   const device=this.getDevice();await device.environmentConsent(value);current();
   if(storage.getItem('m2-env-revoke-seq')!==sequence)throw new Error('有新的撤回待办。');
    if(storage.getItem('m2-pending-env-revoke')==='true')storage.setItem('m2-pending-env-revoke','false');storage.setItem('m2-pending-env-grant','false');this.retryAt=0;this.onStatus('云端撤回与设备关闭回执均已确认。');return true;
  }catch(error){this.retryAt=this.now()+5000;this.onStatus('保持关闭，撤回待重试：'+error.message);return false;}finally{this.busy=false;}
 }
}
