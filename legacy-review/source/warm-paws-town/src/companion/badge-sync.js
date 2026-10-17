import { bytes, encodeBase64, decodeBase64 } from '../ble/protocol.js';
export function crc32(value) { let crc=0xffffffff; for(const byte of value){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0; }
function view(value){return new DataView(value.buffer,value.byteOffset,value.byteLength);}
export class ObjectTransport {
  constructor(client){this.client=client;this.transfer=0;this.pending=null;}
  async caps(){const b=await this.client.request(6);if(b.length!==10||b[0]!==1||b[8]!==9||b[9]!==0)throw new Error('设备不支持真实同步扩展');return{features:view(b).getUint16(1,true),maxSegments:b[3],maxHearts:b[4],maxObject:view(b).getUint16(5,true),eventIdBytes:b[7]};}
  async exclusive(action){if(this.pending)throw new Error('设备对象传输处理中，请稍候');this.pending=true;try{return await action();}finally{this.pending=false;}}
  read(kind){return this.exclusive(()=>this.readObject(kind));}
  write(kind,input){return this.exclusive(()=>this.writeObject(kind,input));}
  async readObject(kind){
    const epoch=this.client.generation,meta=await this.client.request(19,[kind,255]);
    if(meta.length!==6)throw new Error('对象元数据不合法');const length=view(meta).getUint16(0,true),checksum=view(meta).getUint32(2,true);
    if(!length)return null;if(length>512)throw new Error('对象超出设备预算');const result=new Uint8Array(length);
    for(let page=0,offset=0;offset<length;page++,offset+=9){const data=await this.client.request(19,[kind,page]);const size=Math.min(9,length-offset);if(epoch!==this.client.generation||data[0]!==page||data.length!==size+1)throw new Error('对象分页不完整');result.set(data.slice(1),offset);}
    if(crc32(result)!==checksum)throw new Error('对象CRC校验失败');return result;
  }
  async writeObject(kind,input){
    const epoch=this.client.generation;
    const request=(op,payload)=>{if(epoch!==this.client.generation)throw new Error('对象传输连接已失效');return this.client.request(op,payload);};
    const body=bytes(input);if(!body.length||body.length>512)throw new Error('对象长度不合法');const id=(++this.transfer%65535)||1,begin=new Uint8Array(9),v=view(begin);begin[0]=kind;v.setUint16(1,id,true);v.setUint16(3,body.length,true);v.setUint32(5,crc32(body),true);
    await request(16,begin);
    for(let page=0,offset=0;offset<body.length;page++,offset+=9){const data=new Uint8Array(3+Math.min(9,body.length-offset));view(data).setUint16(0,id,true);data[2]=page;data.set(body.slice(offset,offset+9),3);await request(17,data);}
    const commit=new Uint8Array(2);view(commit).setUint16(0,id,true);return request(18,commit);
  }
}
export function decodeSensor(b){if(!b||b.length!==29||b[0]!==1)throw new Error('真实传感器对象不合法');const v=view(b),pmic=!!(b[5]&1),imu=!!(b[5]&2);return{battery:pmic&&b[6]!==255?b[6]:null,usb:pmic&&b[7]!==255?!!b[7]:null,charging:pmic&&b[8]!==255?!!b[8]:null,accelerationMg:imu?[v.getInt16(9,true),v.getInt16(11,true),v.getInt16(13,true)]:null,pendingEvents:v.getUint16(23,true),droppedEvents:v.getUint32(25,true)};}
export class BadgeSync {
  constructor({client,api,cloud,getOwner=()=>null}){this.transport=new ObjectTransport(client);Object.assign(this,{client,api,cloud,getOwner,owner:getOwner(),session:null});}
  deviceId(){if(!this.client.hello)throw new Error('先完成本地握手');return this.client.hello.mac.replaceAll(':','');}
  async beginBinding(){const caps=await this.transport.caps();if(!(caps.features&32))throw new Error('设备未安全provision，不能云绑定');this.challenge=await this.api.request(`/api/devices/${this.deviceId()}/binding-challenges`,{method:'POST',body:{}});await this.transport.write(5,decodeBase64(this.challenge.challengeBase64));return this.challenge;}
  async confirmBinding(){const proof=await this.transport.read(6);if(!proof||proof.length!==32)throw new Error('请先在吧唧上核对并确认六位码');const binding=await this.api.request('/api/device-bindings',{method:'POST',body:{deviceId:this.deviceId(),challengeId:this.challenge.challengeId,proofBase64:encodeBase64(proof)}});await this.transport.write(7,decodeBase64(binding.authGrantBase64));this.session={id:binding.sessionId,generation:this.client.generation};await this.signed(9);return binding;}
  requireSession(){if(this.owner!==this.getOwner()||!this.session||this.session.generation!==this.client.generation)throw new Error('云同步会话已结束，请重新物理确认');}
  async signed(kind,eventId,expected){this.requireSession();const session=this.session,generation=this.client.generation;const object=await this.api.request(`/api/devices/${this.deviceId()}/signed-objects`,{method:'POST',body:{sessionId:session.id,kind,...(eventId?{eventId}:{})}});this.requireSession();if(this.session!==session||this.client.generation!==generation)throw new Error('签名请求期间设备会话改变');const raw=decodeBase64(object.envelopeBase64);if(kind===11){const hex=[...raw.slice(0,16)].map(v=>v.toString(16).padStart(2,'0')).join('');if(object.kind!==11||raw.length!==62||hex!==session.id.replaceAll('-','')||raw[20]!==1||raw[25]>1||(expected&&(view(raw).getUint32(21,true)!==expected.revision||Boolean(raw[25])!==expected.isEnvironmentGranted)))throw new Error('环境签名授权与本轮确认不匹配');}expected?.current?.();await this.transport.write(kind,raw);expected?.current?.();this.requireSession();if(this.session!==session||this.client.generation!==generation)throw new Error('设备确认期间会话改变');return kind===11?{expiresAt:view(raw).getUint32(26,true)*1000}:undefined;}
  async synchronize(){this.requireSession();await this.signed(9);await this.signed(3);await this.signed(4);}
  async drainOne(){
    this.requireSession();const event=await this.transport.read(2);if(!event)return null;if(event.length!==48)throw new Error('事件签名对象必须48字节');const eventId=view(event).getBigUint64(0,true).toString();
    const response=await this.api.request(`/api/devices/${this.deviceId()}/event-batches`,{method:'POST',body:{sessionId:this.session.id,events:[{eventId,eventBase64:encodeBase64(event)}]},idempotencyKey:crypto.randomUUID()});
    const result=response.results?.find(r=>r.eventId===eventId);if(!result?.isTerminal)throw new Error(result?.msg||'后台尚未持久确认，设备队头保留');
    // 不调用原作照料函数，避免手机重复结算；先真实import保存，ACK后再重初始化画面。
    await this.cloud.acceptDeviceSave({save:response.save,revision:response.revision});await this.signed(8,eventId);return response;
  }
}
