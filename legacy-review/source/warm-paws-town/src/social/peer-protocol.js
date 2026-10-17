const hex=bytes=>[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
export const encounterHex=id=>String(id).replaceAll('-','').toLowerCase();
export function decodeSocialStatus(raw){
 if(!(raw instanceof Uint8Array)||raw.length!==30||raw[0]!==1||(raw[1]&240)||(raw[4]&240)||raw[29]||raw[2]>5||raw[3]>3||raw[5]>8)throw new Error('社交设备状态非法。');
 const value={capabilities:raw[1],state:['IDLE','DISCOVERING','REFERENCE','FOLLOW','MATCHED','FAILED'][raw[2]],method:raw[3],flags:raw[4],reason:raw[5],encounterId:hex(raw.slice(6,22)),peerMac:hex(raw.slice(22,28)),count:raw[28]};
 const idle=value.method===0&&value.flags===0&&value.reason===0&&/^0{32}$/.test(value.encounterId)&&/^0{12}$/.test(value.peerMac)&&value.count===0;
 const countValid=value.method===2?value.count>=4&&value.count<=8:value.method===3?value.count>=4&&value.count<=9:value.count===0;
 if((value.state==='IDLE'&&!idle)||(value.state!=='IDLE'&&(value.method===0||/^0{32}$/.test(value.encounterId)||/^0{12}$/.test(value.peerMac)))||(value.state==='FAILED'&&value.reason===0)||(value.state!=='FAILED'&&value.reason!==0)||(['REFERENCE','FOLLOW'].includes(value.state)&&(!(value.flags&1)||![2,3].includes(value.method)||(value.count!==0&&!countValid)))||(value.state==='MATCHED'&&(value.flags!==15||!countValid||![2,3].includes(value.method)))||((value.flags&2)&&!countValid))throw new Error('社交设备状态组合非法。');
 return value;
}
export function supportsMethod(status,method){return method==='QR'?!!(status.capabilities&1):method==='KNOCK'?(status.capabilities&10)===10:method==='PATTERN'?(status.capabilities&12)===12:false;}
export function decodeSocialReference(raw,{encounterId,method}){
 if(!(raw instanceof Uint8Array)||raw.length!==84||raw[0]!==1||raw[3]||![2,3].includes(raw[1])||raw[1]!==method||hex(raw.slice(4,20))!==encounterHex(encounterId))throw new Error('参考不属于当前设备遇见。');
 const count=raw[2],payload=raw.slice(20),view=new DataView(payload.buffer,payload.byteOffset,payload.byteLength);let length,values;
 if(method===2){if(count<4||count>8)throw new Error('敲击次数非法。');length=(count-1)*2;values=Array.from({length:count-1},(_,index)=>view.getUint16(index*2,true));if(values.some(value=>value===0))throw new Error('敲击间隔必须为正。');}
 else {if(count<4||count>9)throw new Error('图案点数非法。');length=count;values=[...payload.slice(0,count)];if(values.some(value=>value>8)||new Set(values).size!==count)throw new Error('九宫格点位必须唯一。');}
 if(payload.slice(length).some(value=>value!==0))throw new Error('参考保留字节非零。');
 return {method,count,values,canonical:new Uint8Array([count,...payload.slice(0,length)])};
}
export async function transcriptHash(body,canonical=new Uint8Array()){
 const sorted=[body.slice(17,23),body.slice(23,29)].sort((a,b)=>{for(let i=0;i<6;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;});
 const parts=[new TextEncoder().encode('BAJI-TRANSCRIPT-v1'),body.slice(1,17),...sorted,body.slice(29,61),body.slice(65,66),canonical];
 const transcript=new Uint8Array(parts.reduce((sum,part)=>sum+part.length,0));let offset=0;for(const part of parts){transcript.set(part,offset);offset+=part.length;}
 return new Uint8Array(await crypto.subtle.digest('SHA-256',transcript));
}
