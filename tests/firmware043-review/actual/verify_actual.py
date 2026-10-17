from pathlib import Path
import hashlib,json,re,zlib,base64
from PIL import Image
R=Path.cwd();O=R/'tests/firmware043-review';A=O/'actual';B=R/'artifacts/device-backups/esp-usb-7c0c5f423684/2026-10-16T1145Z-cache043';P=R/'artifacts/device-backups/esp-usb-7c0c5f423684/2026-10-16T1052Z-3d042';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();index=B/'FINAL-INDEX.json';assert sha(index)=='6f5c491d2862426297daf117220c35a0e4822e34957a06a70c736597a7ded9b6';idx=json.loads(index.read_text());assert idx['count']==len(idx['files'])==59;pins={str(index.relative_to(R)):sha(index)}
for x in idx['files']:
 p=B/x['path'];assert p.stat().st_size==x['bytes'] and sha(p)==x['sha256'],x['path'];pins[str(p.relative_to(R))]=x['sha256']
gold=json.loads((B/'expected-render-samples.json').read_text())['records'];records=[]
def row(n,prefix):
 p=next(B.glob(f'command-{n:02d}-*.log'));ls=[json.loads(l[len(prefix):]) for l in p.read_text().splitlines() if l.startswith(prefix+'{')];assert len(ls)==1;return ls[0]
for n in [3,6,8,11]:
 r=row(n,'CFDIAG RENDER ');assert all(r[k] is True for k in ['valid','published','completeFrame','roomCacheUsed','roomCacheDrom','contextExternalRam','pcatDrom']);assert r['contextBytes']==431296 and r['roomCacheBytes']==1085860 and r['pcatBytes']==205624 and r['phase']==5 and not r['partialCounters'];assert all(r[k]==v for k,v in gold[r['sample']].items());records.append(r)
assert [r['sample'] for r in records]==[0,0,1,2] and [r['totalUs'] for r in records]==[909605,907726,665173,817543] and [r['cacheValidateUs'] for r in records]==[102486,3,1,3]
state=[row(n,'CFDIAG STATE ') for n in [1,13,16]];assert state[0]==state[1]==state[2]
perfs=[row(n,'CFDIAG PERF ') for n in [2,4,7,9,12,14,17]]
for r in perfs:assert r['dmaFree']>=65536 and r['drawDouble'] is True and r['drawBufferBytes']==r['buffer1Bytes']==r['buffer2Bytes']==9320 and r['buffer1DmaCapable'] is True and r['buffer2DmaCapable'] is True and r['pressedPolls']==0
captures=[]
for sample,n in enumerate([5,10]):
 p=next(B.glob(f'command-{n:02d}-*.log'));lines=p.read_text().splitlines();meta=json.loads(next(x[len('CFDIAG BEGIN '):] for x in lines if x.startswith('CFDIAG BEGIN ')));cid=meta['captureId'];assert meta['bytes']==434312 and meta['width']==meta['height']==466 and meta['stride']==932;raw=bytearray();seen=set()
 for l in lines:
  if not l.startswith('CFDIAG DATA '):continue
  _,_,i,offset,b64=l.split(' ');assert int(i)==cid and int(offset)==len(raw) and int(offset) not in seen;seen.add(int(offset));raw.extend(base64.b64decode(b64,validate=True))
 assert len(raw)==434312 and f'{zlib.crc32(raw):08x}'==meta['crc32'] and [l for l in lines if l.startswith('CFDIAG END ')]==[f'CFDIAG END {cid}'];assert raw==(B/f'actual-render-{sample}.rgb565').read_bytes()==(P/f'actual-render-{sample}.rgb565').read_bytes();(A/f'capture-{sample}.rgb565').write_bytes(raw)
 rgb=bytearray()
 for off in range(0,len(raw),2):
  v=raw[off]|raw[off+1]<<8;rgb.extend((((v>>11)*255+15)//31,(((v>>5)&63)*255+31)//63,((v&31)*255+15)//31))
 im=Image.frombytes('RGB',(466,466),bytes(rgb));im.save(A/f'capture-{sample}.png');assert Image.open(B/f'actual-render-{sample}.png').convert('RGB').tobytes()==rgb;assert (B/f'actual-render-{sample}.png').read_bytes()==(P/f'actual-render-{sample}.png').read_bytes();captures.append({'sample':sample,'crc32':meta['crc32'],'rawBytesExact042':True,'pngBytesExact042':True,'meta':meta})
app=(R/'artifacts/firmware-visual-integration043/deliverables/cat-forest-badge-0.4.3-exactcache.bin').read_bytes();rb=(B/'app-sector-readback.bin').read_bytes();assert len(app)==7723088 and len(rb)==7725056 and rb[:len(app)]==app and rb[len(app):]==b'\xff'*(len(rb)-len(app));before=(B/'before-ota1.bin').read_bytes();exp=(B/'expected-ota1.bin').read_bytes();assert exp[:len(rb)]==rb and exp[len(rb):]==before[len(rb):]
for name in ['verify-current','verify-protected']:
 x=json.loads((B/(name+'.json')).read_text());assert x['returncode']==0 and (B/(name+'.log')).read_text().count('verify OK (digest matched)')==4
boot=json.loads((B/'normal-boot.json').read_text());assert len(boot['commands'])==17 and boot['elapsedSeconds']==55.311 and boot.get('error') is None and all('terminalLine' in x and not any(k.startswith('incomplete') for k in x) for x in boot['commands']);s=(B/'normal-boot-and-diagnostics.bin').read_bytes().decode(errors='replace');assert len((B/'normal-boot-and-diagnostics.bin').read_bytes())==boot['consoleBytes']==1223054;assert s==(B/'normal-boot-and-diagnostics.txt').read_bytes().decode();s=re.sub(r'\x1b\[[0-9;]*m','',s);assert 'App version:      0.4.3-exactcache' in s;parser=[l for l in s.splitlines() if l.startswith('CFDIAG ERROR ')];errors=[l for l in s.splitlines() if re.search(r'(^|\s)E \(',l)];assert parser==['CFDIAG ERROR COMMAND_INVALID_OR_TOO_LONG'] and not errors
reuse=json.loads((B/'MEDIA-REUSE.json').read_text());assert reuse['status']=='no_duplicate_upload' and sha(R/reuse['sourceMediaIndex'])==reuse['sourceIndexSha256'];pins[reuse['sourceMediaIndex']]=reuse['sourceIndexSha256']
old=json.loads((O/'review-evidence.json').read_text());assert old['pinCount']==319
for p,h in old['sha256'].items():assert sha(R/p)==h,p
r={'scope':'closed actual043 read-only audit; independent strict capture decode and flash/state checks; no device actions','rootIndexedFiles':59,'rootIndexSha256':sha(index),'records':records,'statesAllEqual':state[0],'lastPerf':perfs[-1],'captures':captures,'sessionSeconds':55.311,'commandCount':17,'appByteAndSectorTailExact':True,'untouchedSlotTailExact':True,'physicalWholeDigestPreAndPost':True,'retainedParserErrors':parser,'selectedEspErrors':errors,'mediaReuseScope':'local bytes exact original042 and saved metadata provenance; no new upload or remote download by reviewer','prior319PinsUnchanged':True,'pins':pins};(A/'checks.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'allPass':True,'rootFiles':59,'renders':4,'captures':2,'prior319Exact':True,'totalMs':[r['totalUs']/1000 for r in records],'rasterMs':[r['rasterUsIncludingYield']/1000 for r in records]}))
