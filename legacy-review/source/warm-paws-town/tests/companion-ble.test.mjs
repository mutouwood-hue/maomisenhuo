import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {ObjectTransport,crc32,decodeSensor,BadgeSync} from '../src/companion/badge-sync.js';import{encodeRequest,decodeBase64}from'../src/ble/protocol.js';
const vectors=JSON.parse(await readFile(new URL('../../tests/integration/real-data-vectors.json',import.meta.url),'utf8'));
test('real protocol matches public test-only grant and ACK fixed20 golden vectors',async()=>{
  for(const [kind,key,frames]of[[7,'grant','grantFrames'],[8,'ack','signedAckFrames']]){let seq=0;const actual=[];const client={generation:1,async request(op,payload){actual.push(Buffer.from(encodeRequest(op,++seq,payload)).toString('hex'));return new Uint8Array();}};const t=new ObjectTransport(client);t.transfer=0x1233;await t.write(kind,decodeBase64(vectors[key].base64));assert.deepEqual(actual,vectors[frames]);}
  assert.equal(crc32(new TextEncoder().encode('123456789')).toString(16),'cbf43926');assert.equal(new DataView(decodeBase64(vectors.event.base64).buffer).getBigUint64(0,true).toString(),vectors.eventId);
});
test('read metadata empty is not fabricated event zero and bad CRC is rejected',async()=>{
  const client={generation:1,async request(op,p){if(p[1]===255)return Uint8Array.from([0,0,0,0,0,0]);}};assert.equal(await new ObjectTransport(client).read(2),null);
  client.request=async(op,p)=>p[1]===255?Uint8Array.from([1,0,0,0,0,0]):Uint8Array.from([0,1]);await assert.rejects(new ObjectTransport(client).read(2),/CRC/);
});
test('object transfer is singleflight and cannot continue after reconnect',async()=>{
  let release;const client={generation:1,request:()=>new Promise(resolve=>release=resolve)};const t=new ObjectTransport(client),first=t.write(7,[1]);await assert.rejects(t.write(5,[2]),/传输处理中/);client.generation=2;release(new Uint8Array());await assert.rejects(first,/连接已失效/);
});
test('sensor unknown flags never turn sentinel values into physical data',()=>{const b=new Uint8Array(29);b[0]=1;b[6]=b[7]=b[8]=255;const s=decodeSensor(b);assert.equal(s.battery,null);assert.equal(s.accelerationMg,null);});
test('device settlement persists/imports save before requesting signed dequeue and never local settle',async()=>{
  const order=[];const b=new BadgeSync({client:{generation:1,hello:{mac:'aa:bb:cc:dd:ee:ff'}},api:{async request(path){if(path.endsWith('event-batches'))return{save:{version:2},revision:2,results:[{eventId:vectors.eventId,isTerminal:true}]};order.push('signed');return{envelopeBase64:vectors.ack.base64};}},cloud:{async acceptDeviceSave(){order.push('apply');}}});b.session={id:'s',generation:1};b.transport.read=async()=>decodeBase64(vectors.event.base64);b.transport.write=async()=>order.push('ack');await b.drainOne();assert.deepEqual(order,['apply','signed','ack']);
});
