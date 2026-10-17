from pathlib import Path
import json,hashlib,subprocess,struct
R=Path(__file__).resolve().parents[2];O=Path(__file__).resolve().parent;B=R/'artifacts/local-ble-adapter/versions/encounter-v1/e2e';cli=B/'wire-cli-040-r1';source=B/'c-window-r2/fsm-A-complete.blob';blob=source.read_bytes();sha=lambda b:hashlib.sha256(b).hexdigest();rows=[]
def fields(b):
 ec,pc,oc=struct.unpack_from('<HHH',b,357);pos=447
 for _ in range(ec):pos+=17+(8 if b[pos+16]&128 else 0)
 pos+=pc*42+oc*9;bindings=b[pos+8];return {'nextEvent':int.from_bytes(b[341:349],'little'),'lastAck':int.from_bytes(b[349:357],'little'),'eventCount':ec,'peerCount':pc,'outgoingCount':oc,'bindingCount':bindings,'lastSeq':int.from_bytes(b[219:227],'little')}
for name,digest in [('onechar','x'),('63lower','a'*63),('65lower','a'*65),('64upper','A'*64),('64nonhex','g'*64),('64valid','a'*64)]:
 p=O/('raw-digest-040-'+name+'.blob');p.write_bytes(blob)
 req={'v':3,'id':'raw-ack-'+name,'op':'ack','data':{'counter':1,'eventId':'1'*32+':1','receipt':{'status':'applied','persisted':True,'saveDigest':digest}},'clientId':'11111111-2222-4333-8444-555555555555','seq':2}
 lines=[{'v':3,'id':'before','op':'state'},req,{'v':3,'id':'after','op':'state'}];run=subprocess.run([str(cli),str(p)],input=''.join(json.dumps(x,separators=(',',':'))+'\n' for x in lines),text=True,capture_output=True,timeout=5);assert run.returncode==0,run.stderr;responses=[json.loads(x) for x in run.stdout.splitlines()];after=p.read_bytes();row={'case':name,'digestLength':len(digest),'request':req,'response':responses[1],'before':fields(blob),'after':fields(after),'beforeSha256':sha(blob),'afterSha256':sha(after),'changed':after!=blob};rows.append(row);print(name,responses[1]['ok'],row['before'],row['after'])
assert source.read_bytes()==blob
assert all(not r['response']['ok'] and not r['changed'] and r['after']==r['before'] for r in rows[:-1]);assert rows[-1]['response']['ok'] and rows[-1]['changed'] and rows[-1]['after']['bindingCount']==0
(O/'raw-digest-040-negative.json').write_text(json.dumps({'virtual_fixture':True,'sourceBlobUntouched':True,'actualPinned040WireCore':True,'hostFileStoreNotNVS':True,'cliSha256':sha(cli.read_bytes()),'inputFsmBlobSha256':sha(blob),'cases':rows},indent=2)+'\n')
