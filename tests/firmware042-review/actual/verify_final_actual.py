from pathlib import Path
import hashlib,json,re
from PIL import Image
R=Path.cwd();B=R/'artifacts/device-backups/esp-usb-7c0c5f423684/2026-10-16T1052Z-3d042';O=R/'tests/firmware042-review/actual';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
index=B/'FINAL-INDEX.json';assert sha(index)=='c65512f51a7e76f0eed0f458e4989a9b7ae0d537342e7f02f3ce2adbf7b7943e';idx=json.loads(index.read_text());assert idx['fileCount']==len(idx['files'])==70
pins={str(index.relative_to(R)):sha(index)}
for n,v in idx['files'].items():
 p=B/n;assert p.stat().st_size==v['bytes'] and sha(p)==v['sha256'],n;pins[str(p.relative_to(R))]=v['sha256']
boot=json.loads((B/'normal-boot.json').read_text());result=json.loads((B/'RESULT.json').read_text());status=json.loads((B/'EXECUTION-STATUS.json').read_text());assert boot['elapsedSeconds']==138.554 and len(boot['commands'])==16 and boot.get('error') is None and all('terminalLine' in c and not any(k.startswith('incomplete') for k in c) for c in boot['commands']);assert result['sessionClosed'] is True and result['commandCount']==16 and result['sessionSeconds']==138.554
assert result['stateBefore']==result['stateAfter']
for n in [1,12,15]:
 p=next(B.glob(f'command-{n:02d}-*.log'));s=json.loads(next(x[len('CFDIAG STATE '):] for x in p.read_text().splitlines() if x.startswith('CFDIAG STATE {')));assert s==result['stateBefore']
conversion=[]
for i in range(3):
 assert (B/f'actual-render-{i}.rgb565').read_bytes()==(O/f'capture-{i+1}.rgb565').read_bytes()
 rootrgb=Image.open(B/f'actual-render-{i}.png').convert('RGB').tobytes();ownrgb=Image.open(O/f'capture-{i+1}.png').convert('RGB').tobytes();raw565=(O/f'capture-{i+1}.rgb565').read_bytes();nearest=bytearray()
 for off in range(0,len(raw565),2):
  v=raw565[off]|raw565[off+1]<<8;nearest.extend((((v>>11)*255+15)//31,(((v>>5)&63)*255+31)//63,((v&31)*255+15)//31))
 assert rootrgb==nearest
 conversion.append({'sample':i,'rootNearestScalingValidated':True,'independentBitReplicationDifferingChannels':sum(a!=b for a,b in zip(rootrgb,ownrgb)),'max8bitDifference':max(abs(a-b) for a,b in zip(rootrgb,ownrgb))})
 assert conversion[-1]['max8bitDifference']<=1
 assert result['samples'][i]['actual']==json.loads((O/'completed-stage-results.json').read_text())['records'][i]
for n,h in status['executionSources'].items():assert sha(B/n)==h
raw=(B/'normal-boot-and-diagnostics.bin').read_bytes();assert len(raw)==boot['consoleBytes']==1825207;s=re.sub(r'\x1b\[[0-9;]*m','',raw.decode(errors='replace'));assert s==re.sub(r'\x1b\[[0-9;]*m','',(B/'normal-boot-and-diagnostics.txt').read_bytes().decode('utf-8'))
parser_errors=[x for x in s.splitlines() if x.startswith('CFDIAG ERROR ')];esp_errors=[x for x in s.splitlines() if re.search(r'(^|\s)E \(',x)];assert parser_errors==result['startupDiagnosticErrors']==['CFDIAG ERROR COMMAND_INVALID_OR_TOO_LONG'];assert esp_errors==result['selectedEspErrorLines']==[];assert 'App version:      0.4.2-exact3d' in s
media=json.loads((B/'private-media.json').read_text());assert media['metadataOnlyReadback'] is True and media['remoteShaVerified'] is False
for row,local in zip(media['records'],media['local']):
 m=row['metadata']['structuredContent'];p=B/f"actual-render-{local['sample']}.png";assert m['shared'] is False and m['parent_ids']==[media['folder']] and [x['role'] for x in m['permissions']]==['owner'];assert int(m['size'])==local['bytes']==p.stat().st_size and local['sha256']==sha(p)
# Confirm prior software decision and 451 evidence pins remain unchanged.
old=json.loads((R/'tests/firmware042-review/review-evidence.json').read_text());assert old['pinCount']==451
for p,h in old['sha256'].items():assert sha(R/p)==h,p
r={'scope':'closed Root actual device evidence read-only; independent decode and preservation checks; no device operations','indexedRootFiles':70,'rootIndexSha256':sha(index),'sessionSeconds':138.554,'commands':16,'states1_12_15Equal':True,'threeRenderMetricsAndCrcMatchR2':True,'captured3DObserved':[0,1],'sample2Capture':'I8 fallback; computation/published terminal succeeded but no third 3D display evidence','independentlyDecodedCaptureCount':3,'rootPngNearestScalingOfExactRawValidated':True,'png8bitConversionComparison':conversion,'espECountInBoundedConsole':len(esp_errors),'retainedStartupParserErrors':parser_errors,'prior451PinsUnchanged':True,'mediaScope':'offline metadata-only owner/sharedfalse/parent/size/local hash; no remote bytes read','pins':pins}
(O/'final-checks.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items() if k!='pins'},ensure_ascii=False))
