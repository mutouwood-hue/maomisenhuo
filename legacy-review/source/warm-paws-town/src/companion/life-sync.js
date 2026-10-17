import { dateKey } from './life-provider.js';
import { requireEligibility } from './privacy-eligibility.js';
/** Upload only consented, changed historical summaries; coordinates never enter this module. */
export class LifeSync {
 constructor({api,getOwner,getStorage,getProvider,getConsent,canRun=()=>true,onConfirmed=()=>{}}){Object.assign(this,{api,getOwner,getStorage,getProvider,getConsent,canRun,onConfirmed});this.running=false;}
 async flush(){
  if(this.running||!this.getOwner())return false;const owner=this.getOwner(),storage=this.getStorage(),provider=this.getProvider(),consent=this.getConsent();
  if(!consent.isLifeSyncEnabled||storage.getItem('pending-clear')||storage.getItem('pending-consent'))return false;
  const current=()=>{if(!this.canRun()||owner!==this.getOwner()||provider!==this.getProvider()||consent!==this.getConsent()||storage.getItem('pending-clear')||storage.getItem('pending-consent'))throw new Error('生活同步授权或账号已改变。');};
  this.running=true;let changed=false;
  try{
   const dates=new Set([...provider.visits.map(v=>v.start),...provider.moments.map(m=>m.time)].map(dateKey));for(const date of Object.keys(provider.motion))dates.add(date);
   for(const date of [...dates].sort()){
    current();const summary=provider.summary(date);if(!summary.segments.length&&!summary.motion&&!summary.moments.length)continue;
    const fingerprint=JSON.stringify({consentRevision:consent.revision,summary}),key='life-synced:'+date;if(storage.getItem(key)===fingerprint)continue;
    if(summary.segments.length){await requireEligibility(this.api,'location');current();}
    const remote=await this.api.request(`/api/life-days/${date}`);current();
    const result=await this.api.request(`/api/life-days/${date}`,{method:'PUT',body:{...summary,baseRevision:remote?.revision??0,consentRevision:consent.revision}});current();
    if(!Number.isSafeInteger(result?.revision)||result.revision<1)throw new Error('生活摘要云端版本非法。');
    storage.setItem(key,fingerprint);this.onConfirmed(result);changed=true;
   }return changed;
  }finally{this.running=false;}
 }
}
