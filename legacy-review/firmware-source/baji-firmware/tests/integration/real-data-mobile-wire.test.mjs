import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ObjectTransport, crc32, decodeSensor } from '../../mobile-pet/src/companion/badge-sync.js';
import { encodeRequest, decodeBase64 } from '../../mobile-pet/src/ble/protocol.js';
const v=JSON.parse(await readFile(new URL('./real-data-vectors.json',import.meta.url),'utf8'));
const hex=b=>Buffer.from(b).toString('hex');
function recorder(){const frames=[];return{frames,generation:1,async request(op,p=[]){frames.push(hex(encodeRequest(op,frames.length+1,p)));return new Uint8Array();}};}
test('mobile real transport creates byte-exact grant and signed ACK golden frames',async()=>{
  for(const [kind,name,expected] of [[7,'grant','grantFrames'],[8,'ack','signedAckFrames']]){
    const c=recorder(),t=new ObjectTransport(c);t.transfer=0x1233;
    await t.write(kind,decodeBase64(v[name].base64));assert.deepEqual(c.frames,v[expected]);
  }
});
test('mobile IEEE CRC32 oracle and unknown sensor are not fictional zero data',()=>{
  assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);
  const sensor=new Uint8Array(29);sensor[0]=1;sensor.fill(255,6,9);
  for(const i of [9,11,13])new DataView(sensor.buffer).setInt16(i,-32768,true);
  const d=decodeSensor(sensor);assert.equal(d.battery,null);assert.equal(d.usb,null);assert.equal(d.charging,null);assert.equal(d.accelerationMg,null);
});
test('mobile reads frozen metadata then pages and rejects mutated CRC',async()=>{
  const event=decodeBase64(v.event.base64);let corrupt=false;
  const c={generation:1,async request(op,p){assert.equal(op,19);if(p[1]===255){const m=new Uint8Array(6),d=new DataView(m.buffer);d.setUint16(0,event.length,true);d.setUint32(2,crc32(event),true);return m;}const b=Uint8Array.from([p[1],...event.slice(p[1]*9,p[1]*9+9)]);if(corrupt&&p[1]===0)b[1]^=1;return b;}};
  const t=new ObjectTransport(c);assert.deepEqual(await t.read(2),event);corrupt=true;await assert.rejects(t.read(2),/CRC/);
});
