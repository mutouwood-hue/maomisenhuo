from pathlib import Path
import hashlib,json,zlib,base64,re
R=Path.cwd();B=R/'artifacts/device-backups/esp-usb-7c0c5f423684/2026-10-16T1052Z-3d042'; O=R/'tests/firmware042-review/actual';O.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest();gold=json.loads((B/'expected-render-samples.json').read_text())['records'];records=[]
for sample,number in enumerate([3,6,9]):
 p=next(B.glob(f'command-{number:02d}-*.log'));rows=[json.loads(x[len('CFDIAG RENDER '):]) for x in p.read_text().splitlines() if x.startswith('CFDIAG RENDER {')];assert len(rows)==1;r=rows[0];g=gold[sample];assert r['sample']==sample and all(r[k] is True for k in ['valid','published','completeFrame']) and r['phase']==5 and not r['partialCounters']
 assert all(r[k]==g[k] for k in ['roi','catBounds','triangles','tested','inside','written','crc32']);assert r['contextBytes']==431296 and r['contextExternalRam'] is True and r['pcatBytes']==205624 and r['pcatDrom'] is True;records.append(r)
for n in [2,4,7,10,13]:
 p=next(B.glob(f'command-{n:02d}-*.log'));r=json.loads(next(x[len('CFDIAG PERF '):] for x in p.read_text().splitlines() if x.startswith('CFDIAG PERF {')));assert r['dmaFree']>=65536 and r['drawBufferBytes']==9320 and r['drawDouble'] and r['buffer1Bytes']==r['buffer2Bytes']==9320 and r['buffer1DmaCapable'] and r['buffer2DmaCapable'];assert r['pressedPolls']==0
state=[]
for n in [1,12]:
 p=next(B.glob(f'command-{n:02d}-*.log'));state.append(json.loads(next(x[len('CFDIAG STATE '):] for x in p.read_text().splitlines() if x.startswith('CFDIAG STATE {'))))
assert state[0]==state[1]
caps=[]
for n in [5,8,11]:
 p=next(B.glob(f'command-{n:02d}-*.log'));lines=p.read_text().splitlines();meta=json.loads(next(x[len('CFDIAG BEGIN '):] for x in lines if x.startswith('CFDIAG BEGIN ')));cid=meta['captureId'];assert meta['bytes']==434312 and meta['width']==meta['height']==466 and meta['stride']==932
 raw=bytearray();seen=set()
 for l in lines:
  if not l.startswith('CFDIAG DATA '):continue
  _,_,i,offset,b64=l.split(' ');assert int(i)==cid and int(offset)==len(raw) and int(offset) not in seen;seen.add(int(offset));raw.extend(base64.b64decode(b64,validate=True))
 assert len(raw)==434312 and f'{zlib.crc32(raw):08x}'==meta['crc32'];assert [x for x in lines if x.startswith('CFDIAG END ')]==[f'CFDIAG END {cid}'];(O/f'capture-{cid}.rgb565').write_bytes(raw)
 # independent RGB565 expansion, software composition only
 from PIL import Image
 rgb=bytearray()
 for i in range(0,len(raw),2):
  v=raw[i]|raw[i+1]<<8;r=(v>>11)&31;g=(v>>5)&63;b=v&31;rgb.extend(((r<<3)|(r>>2),(g<<2)|(g>>4),(b<<3)|(b>>2)))
 Image.frombytes('RGB',(466,466),bytes(rgb)).save(O/f'capture-{cid}.png');caps.append({'id':cid,'command':n,'rawSha256':sha(raw),'crc32':meta['crc32'],'captureMeta':meta})
app=(R/'artifacts/firmware-visual-integration042/deliverables/cat-forest-badge-0.4.2-exact3d.bin').read_bytes();rb=(B/'app-sector-readback.bin').read_bytes();assert rb[:len(app)]==app and rb[len(app):]==b'\xff'*(len(rb)-len(app)) and len(rb)==(len(app)+4095)//4096*4096
old=(B/'before-ota1.bin').read_bytes();expected=(B/'expected-ota1.bin').read_bytes();assert expected[:len(app)]==app and expected[len(app):len(rb)]==rb[len(app):] and expected[len(rb):]==old[len(rb):]
log=(B/'verify-protected.log').read_text();assert log.count('verify OK (digest matched)')==4
result={'scope':'completed command records only; live session summary/raw/index not pinned yet; captures are LVGL software composition, not optical','records':records,'state1Equals12':True,'captures':caps,'appReadbackAndUntouchedTailExact':True,'protectedPhysicalVerifyFourRanges':True,'finalSessionPending':True};(O/'completed-stage-results.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'samples':len(records),'captures':len(caps),'appReadbackExact':True,'state1Equals12':True,'rasterTotalMs':[x['totalUs']/1000 for x in records]}))
