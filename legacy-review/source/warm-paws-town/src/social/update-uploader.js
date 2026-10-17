import { decodeBase64 } from '../ble/protocol.js';
const hex = bytes => [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
export function decodeUpdateStatus(raw) {
  if(!raw||raw.length!==40||raw[0]!==1||raw[1]>3||raw[2]>2||raw[3]>12)throw new Error('更新状态对象非法。');
  const view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
  const value={state:['IDLE','RECEIVING','VERIFIED','FAILED'][raw[1]],kind:raw[2],reason:raw[3],releaseId:hex(raw.slice(4,20)),received:view.getUint32(20,true),size:view.getUint32(24,true),version:view.getUint32(28,true),firmwareFloor:view.getUint32(32,true),assetFloor:view.getUint32(36,true)};
  const empty=value.kind===0&&/^0{32}$/.test(value.releaseId)&&value.received===0&&value.size===0&&value.version===0;
  const configured=value.kind>0&&!/^0{32}$/.test(value.releaseId)&&value.size>0&&value.size<=8*1024*1024&&value.version>0;
  if(value.received>value.size||(value.state==='IDLE'&&(!empty||value.reason!==0))||(['RECEIVING','VERIFIED'].includes(value.state)&&(!configured||value.reason!==0))||(value.state==='VERIFIED'&&value.received!==value.size)||(value.state==='FAILED'&&(!value.reason||(!empty&&!configured))))throw new Error('更新状态组合或进度非法。');return value;
}
const same=(a,b)=>a.length===b.length&&a.every((value,index)=>value===b[index]);
export function validateUpdateManifest(manifest,target) {
  if(manifest.target!==target||!Number.isSafeInteger(manifest.sizeBytes)||manifest.sizeBytes<1||manifest.sizeBytes>8*1024*1024||!Number.isInteger(manifest.version)||manifest.version<1||manifest.version>0xffffffff)throw new Error('更新发布类型、大小或版本非法。');
  const raw=decodeBase64(manifest.manifestBase64),signature=decodeBase64(manifest.signatureBase64),view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
  if(raw.length!==74||signature.length<8||signature.length>80||raw[0]!==1||raw[1]!==({APP:1,ASSETS:2})[target]||!same(raw.slice(2,18),new TextEncoder().encode('baji-s3-175c-v1\0'))||view.getUint32(18,true)!==manifest.version||view.getUint32(22,true)!==manifest.sizeBytes||hex(raw.slice(26,58))!==manifest.sha256||hex(raw.slice(58,74))!==manifest.releaseId)throw new Error('更新 manifest 与元数据不一致。');
  return {raw,signature,kind:raw[1]};
}
export function validateUpdateEnvelope(result,{kind,sessionId,manifest,publication,artifact,offset}) {
  const envelope=decodeBase64(result.envelopeBase64),sessionHex=sessionId.replaceAll('-','').toLowerCase();
  if(result.kind!==kind||!/^([a-f\d]{32})$/.test(sessionHex)||envelope.length<68||envelope.length>512||hex(envelope.slice(0,16))!==sessionHex)throw new Error('后台更新封包类型或会话非法。');
  const body=envelope.slice(20,-32);let expected;
  if(kind===20){expected=new Uint8Array(76+publication.signature.length);expected.set(publication.raw);new DataView(expected.buffer).setUint16(74,publication.signature.length,true);expected.set(publication.signature,76);}
  else if(kind===21){const chunk=artifact.slice(offset,offset+440);if(!chunk.length)throw new Error('更新分片越界。');expected=new Uint8Array(20+chunk.length);expected.set(publication.raw.slice(58,74));new DataView(expected.buffer).setUint32(16,offset,true);expected.set(chunk,20);}
  else if(kind===22)expected=publication.raw.slice(58,74);
  else throw new Error('更新封包类型非法。');
  if(!same(body,expected))throw new Error('后台更新封包与当前发布内容不符。');return envelope;
}
/** Phone relays only server-produced envelopes; firmware verifies trusted publisher signature. */
export class UpdateUploader {
  constructor({api,getBadge,getOwner,storage,onProgress=()=>{}}){Object.assign(this,{api,getBadge,getOwner,storage,onProgress,pending:null});}
  cancel(){this.pending?.abort();}
  async run(target) {
    if(this.pending)throw new Error('已有更新传输进行中。');
    if(!['APP','ASSETS'].includes(target))throw new Error('更新类型非法。');
    const badge=this.getBadge();if(!badge)throw new Error('请先连接并物理确认已绑定吧唧。');badge.requireSession();
    const owner=this.getOwner(),sessionId=badge.session.id,generation=badge.client.generation,deviceId=badge.deviceId(),abort=new AbortController();this.pending=abort;
    const current=()=>{badge.requireSession();if(abort.signal.aborted||owner!==this.getOwner()||badge!==this.getBadge()||generation!==badge.client.generation||sessionId!==badge.session.id)throw new Error('更新已中止；换号或重连后不得续传。');};
    const progress=value=>{current();this.onProgress(value);};
    try {
      const query=new URLSearchParams({deviceId,sessionId});
      const manifest=await this.api.request(`/api/ota-manifests/${target}?${query}`,{signal:abort.signal});current();
      if(!manifest?.isConfigured){progress({phase:'UNCONFIGURED',received:0,size:0});return manifest;}
      if(!/^[a-f\d]{32}$/.test(manifest.releaseId)||!/^[a-f\d]{64}$/.test(manifest.sha256)||manifest.releaseId!==manifest.sha256.slice(0,32))throw new Error('更新发布标识非法。');
      const publication=validateUpdateManifest(manifest,target);
      progress({phase:'DOWNLOADING',received:0,size:manifest.sizeBytes});
      const artifact=await this.api.binary(manifest.artifactUrl,{signal:abort.signal,maxBytes:manifest.sizeBytes});current();
      if(artifact.length!==manifest.sizeBytes||hex(new Uint8Array(await crypto.subtle.digest('SHA-256',artifact)))!==manifest.sha256)throw new Error('更新制品大小或摘要与签名发布不符。');current();
      const signed=async(kind,offset)=>{
        current();const body={sessionId,kind,releaseId:manifest.releaseId,...(offset===undefined?{}:{offset})};
        const key=`m2-ota:${owner}:${sessionId}:${manifest.releaseId}:${kind}:${offset??'none'}`;
        const saved=this.storage?.getItem(key);let id;try{id=saved?JSON.parse(saved).id:crypto.randomUUID();}catch{throw new Error('更新幂等记录损坏；请先核对设备状态。');}if(typeof id!=='string'||id.length<8||id.length>128)throw new Error('更新幂等标识非法。');this.storage?.setItem(key,JSON.stringify({id}));
        const result=await this.api.request(`/api/devices/${deviceId}/signed-objects`,{method:'POST',body,signal:abort.signal,idempotencyKey:id});current();
        const envelope=validateUpdateEnvelope(result,{kind,sessionId,manifest,publication,artifact,offset});
        await badge.transport.writeObject(kind,envelope);current();
      };
      return await badge.transport.exclusive(async()=>{
        await signed(20);const beginning=decodeUpdateStatus(await badge.transport.readObject(23));current();
        if(beginning.kind!==publication.kind||beginning.releaseId!==manifest.releaseId||beginning.size!==artifact.length||beginning.version!==manifest.version||!['RECEIVING','VERIFIED'].includes(beginning.state))throw new Error('设备未接受当前签名发布。');
        if(beginning.state!=='VERIFIED') {
          for(let offset=beginning.received;offset<artifact.length;offset+=440){await signed(21,offset);progress({phase:'UPLOADING',received:Math.min(offset+440,artifact.length),size:artifact.length});}
          await signed(22);
        }
        const status=decodeUpdateStatus(await badge.transport.readObject(23));current();
        if(status.kind!==publication.kind||status.size!==manifest.sizeBytes||status.version!==manifest.version||status.state!=='VERIFIED'||status.releaseId!==manifest.releaseId||status.received!==artifact.length)throw new Error('设备未确认完整更新，不能声称升级成功。');
        progress({phase:'VERIFIED',received:status.received,size:status.size});return status;
      });
    }finally{if(this.pending===abort)this.pending=null;}
  }
}
