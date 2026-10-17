import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeSocialStatus, decodeSocialReference, transcriptHash } from '../../mobile-pet/src/social/peer-protocol.js';
import { digest } from './m2-helper.mjs';
test('M2 independent peer 16/17 decoders retain encounter identity and exact LE16 canonical transcript method',async()=>{
 const id='12345678-1234-4abc-8234-123456789012',uuid=Buffer.from(id.replaceAll('-',''),'hex');
 const backing=Buffer.alloc(90),raw=backing.subarray(3,87);raw[0]=1;raw[1]=2;raw[2]=4;uuid.copy(raw,4);
 for(const [i,n]of[257,1025,4097].entries())raw.writeUInt16LE(n,20+i*2);
 const reference=decodeSocialReference(raw,{encounterId:id,method:2});assert.deepEqual(reference.values,[257,1025,4097]);assert.equal(Buffer.from(reference.canonical).toString('hex'),'04010101040110');
 const body=Buffer.alloc(66);body[0]=1;uuid.copy(body,1);Buffer.from('aabbccddeeff','hex').copy(body,17);Buffer.from('112233445566','hex').copy(body,23);Buffer.alloc(32,0x42).copy(body,29);body[65]=2;
 const oracle=digest(Buffer.concat([Buffer.from('BAJI-TRANSCRIPT-v1'),uuid,Buffer.from('112233445566aabbccddeeff','hex'),Buffer.alloc(32,0x42),Buffer.from([2]),Buffer.from('04010101040110','hex')]));
 assert.deepEqual(Buffer.from(await transcriptHash(body,reference.canonical)),oracle);
 assert.throws(()=>decodeSocialReference(raw,{encounterId:'ffffffff-ffff-ffff-ffff-ffffffffffff',method:2}));assert.throws(()=>decodeSocialReference(raw,{encounterId:id,method:3}));
 raw[83]=1;assert.throws(()=>decodeSocialReference(raw,{encounterId:id,method:2}));raw[83]=0;raw.writeUInt16LE(0,20);assert.throws(()=>decodeSocialReference(raw,{encounterId:id,method:2}));
 raw.fill(0,20);raw[1]=3;raw[2]=4;Buffer.from([0,2,5,8]).copy(raw,20);const pattern=decodeSocialReference(raw,{encounterId:id,method:3});assert.equal(Buffer.from(pattern.canonical).toString('hex'),'0400020508');raw[21]=0;assert.throws(()=>decodeSocialReference(raw,{encounterId:id,method:3}));
 const storage=Buffer.alloc(35),status=storage.subarray(2,32);status[0]=1;status[1]=15;status[2]=4;status[3]=2;status[4]=15;uuid.copy(status,6);Buffer.from('112233445566','hex').copy(status,22);status[28]=4;
 assert.equal(decodeSocialStatus(status).state,'MATCHED');status[29]=1;assert.throws(()=>decodeSocialStatus(status));status[29]=0;status[4]=7;assert.throws(()=>decodeSocialStatus(status));status[4]=15;status[1]=255;assert.throws(()=>decodeSocialStatus(status));
});
