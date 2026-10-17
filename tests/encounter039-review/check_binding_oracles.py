from pathlib import Path
import hashlib,json,random,subprocess
O=Path(__file__).resolve().parent;R=O.parents[1];rng=random.Random(39003);rows=json.loads((R/'protocol/local-encounter-v1/binding-vectors.json').read_text())
for i in range(22):
 row={'deviceId':rng.randbytes(16).hex(),'peerId':rng.randbytes(16).hex(),'localEncounterCounter':[1,2,9007199254740990][i%3],'peerEncounterCounter':rng.randrange(1,9007199254740991),'petId':''.join(chr(rng.randrange(33,127)) for _ in range([1,64,31][i%3])),'peerPetId':''.join(chr(rng.randrange(33,127)) for _ in range([64,1,47][i%3]))};rows.append(row)
for r in rows:
 pair=sorted([(bytes.fromhex(r['deviceId']),r['localEncounterCounter'],r['petId'].encode('ascii')),(bytes.fromhex(r['peerId']),r['peerEncounterCounter'],r['peerPetId'].encode('ascii'))]);eid='ec1:'+b''.join(d+n.to_bytes(8,'little') for d,n,p in pair).hex();raw=b'CF-ENCOUNTER-BINDING-v1'+bytes([1])+b''.join(d+n.to_bytes(8,'little')+bytes([len(p)])+p for d,n,p in pair);fp=hashlib.sha256(raw).hexdigest()[:32]
 for k,v in [('encounterId',eid),('bindingBytesHex',raw.hex()),('bindingFingerprint',fp)]:
  if k in r:assert r[k]==v
  r[k]=v
(O/'independent-binding-vectors.json').write_text(json.dumps(rows,indent=2)+'\n')
s="""const fs=require('node:fs'),a=require('node:assert/strict'),crypto=require('node:crypto').webcrypto;
const c=require(process.argv[1]),rows=JSON.parse(fs.readFileSync(process.argv[2]));
(async()=>{let n=0;for(const v of rows){for(const flip of [false,true]){const e={...v};if(flip){[e.deviceId,e.peerId]=[e.peerId,e.deviceId];[e.localEncounterCounter,e.peerEncounterCounter]=[e.peerEncounterCounter,e.localEncounterCounter];[e.petId,e.peerPetId]=[e.peerPetId,e.petId];}a.equal(c.encounterId(e),v.encounterId);a.equal(Buffer.from(c.bindingBytes(e)).toString('hex'),v.bindingBytesHex);a.equal(await c.bindingFingerprint(e,crypto),v.bindingFingerprint);n++;}}console.log(JSON.stringify({virtual_fixture:true,pythonIndependentByteAndShaOracle:true,vectors:rows.length,roleDirections:n,assertions:n*3,passed:true}));})().catch(e=>{console.error(e);process.exitCode=1;});"""
p=subprocess.run(['node','-e',s,str(R/'artifacts/local-ble-adapter/versions/encounter-v1/encounter-event.js'),str(O/'independent-binding-vectors.json')],capture_output=True,text=True,timeout=15);(O/'independent-binding-report.json').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr;print(p.stdout)
