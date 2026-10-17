import { apiTime } from './life-provider.js';
/** 固定持久批次身份和payload，重试不复用不同内容的幂等键。 */
export class TelemetryOutbox {
  constructor({api,storage,key,now=()=>Date.now()}){
    Object.assign(this,{api,storage,key,now,pending:null,events:[],batch:null,rejected:[],droppedCount:0});const raw=storage.getItem(key);
    if(raw)try{const value=JSON.parse(raw);if(Array.isArray(value))this.events=value;else{this.events=value.events;this.batch=value.batch;this.rejected=value.rejected||[];this.droppedCount=value.droppedCount||0;}if(!Array.isArray(this.events))throw new Error('队列格式非法');}catch(error){storage.setItem(key+'-corrupt',raw);storage.removeItem(key);this.events=[];this.batch=null;this.restoreError=error;}
  }
  persist(){this.storage.setItem(this.key,JSON.stringify({events:this.events,batch:this.batch,rejected:this.rejected,droppedCount:this.droppedCount}));}
  track(name,properties={},occurredAt=apiTime(this.now()),id=crypto.randomUUID()){
    this.events.push({id,name,occurredAt,properties});if(this.events.length>3000){const pinned=new Set(this.batch?.events.map(e=>e.id)||[]);const index=this.events.findIndex(e=>!pinned.has(e.id));if(index>=0){this.events.splice(index,1);this.droppedCount++;}}this.persist();
  }
  async flush(){
    if(this.pending||!this.events.length)return this.pending;
    if(!this.batch)this.batch={id:crypto.randomUUID(),events:this.events.slice(0,200)};this.persist();const batch=this.batch;
    this.pending=this.api.request('/api/telemetry-events',{method:'POST',body:{events:batch.events},idempotencyKey:batch.id}).then(response=>{
      const confirmed=new Set();for(const result of response.results||[]){if(['ACCEPTED','DUPLICATE'].includes(result.status))confirmed.add(result.id);else if(result.status==='REJECTED'&&result.isTerminal){confirmed.add(result.id);const event=batch.events.find(e=>e.id===result.id);this.rejected.push({event,result});}}
      this.events=this.events.filter(e=>!confirmed.has(e.id));this.rejected=this.rejected.slice(-200);this.batch=null;this.persist();return response;
    }).finally(()=>{this.pending=null;});return this.pending;
  }
  clear(){this.events=[];this.batch=null;this.rejected=[];this.persist();}
}
