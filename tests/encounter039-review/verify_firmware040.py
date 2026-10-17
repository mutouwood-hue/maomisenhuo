from pathlib import Path
import hashlib,json,zipfile
R=Path.cwd();H=R/'tests/encounter039-review';N=R/'artifacts/firmware-local-v4-encounter040';O=N.parent/'firmware-local-v4-encounter039';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();m=json.loads((N/'manifest.json').read_text());f=json.loads((N/'FROZEN.json').read_text());hs=json.loads((N/'source-hashes.json').read_text());oh=json.loads((O/'source-hashes.json').read_text());w=N/'evidence/wire-window-r1';wm=json.loads((w/'manifest.json').read_text());pins={}
for p,v in hs.items():assert sha(N/'source'/p)==v,p
assert len(hs)==108
for key in ['application','elf','sourceZip']:
 p=N/m[key]['path'];assert p.stat().st_size==m[key]['bytes'] and sha(p)==m[key]['sha256'];pins[str(p.relative_to(R))]=sha(p)
assert sha(N/'manifest.json')==f['manifestSha256'];assert sha(N/'source-hashes.json')==f['sourceHashesSha256']
for group in ['sourceSha256','blobSha256']:
 for p,v in wm[group].items():
  assert sha(w/p)==v
  if group=='sourceSha256':assert sha(N/'source/main'/p)==v
  pins[str((w/p).relative_to(R))]=v
with zipfile.ZipFile(N/m['sourceZip']['path']) as z:
 assert len(z.infolist())==137
 source=[n for n in z.namelist() if n.startswith('source/') and not n.endswith('/')];assert len(source)==108
 for n in source:assert hashlib.sha256(z.read(n)).hexdigest()==hs[n[7:]],n
changed=[p for p in hs if oh.get(p)!=hs[p]];assert set(changed)=={v['path'] for v in m['sourceChangedFiles']}
for p in ['main/local2_core.c','main/local2_core.h','main/local3_encounter.inc','main/local2_store.c','main/local2_ble.c','main/badge_scene.c','main/badge_gesture.c','partitions.csv','sdkconfig']:assert hs[p]==oh[p],p
app=(N/m['application']['path']).read_bytes();elf=(N/m['elf']['path']).read_bytes();assert b'0.4.0-local4' in app and b'0.4.0-local4' in elf
for p in [N/'manifest.json',N/'FROZEN.json',N/'source-hashes.json',w/'manifest.json',*[N/'source'/p for p in hs]]:pins[str(p.relative_to(R))]=sha(p)
report={'decision':'frozen integrity checked, behavior gates reported separately','application':m['application'],'elf':m['elf'],'sourceZip':m['sourceZip'],'changed039':changed,'unchanged039':len(hs)-len(changed),'all108SourceArchiveReadbackExact':True,'finalWindowNineSourcesExact':True,'readEndStable':all(sha(N/'source'/p)==v for p,v in hs.items()),'evidenceHashes':pins};(H/'firmware040-frozen-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='evidenceHashes'},indent=2))
