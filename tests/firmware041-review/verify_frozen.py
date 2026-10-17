from pathlib import Path
import hashlib,json,zipfile
R=Path(__file__).resolve().parents[2];O=Path(__file__).resolve().parent;B=R/'artifacts/firmware-visual-prototype041';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();m=json.loads((B/'manifest.json').read_text());f=json.loads((B/'FROZEN.json').read_text());sp=json.loads((B/'source-hashes.json').read_text());assert len(sp)==19
assert sha(B/'manifest.json')==f['manifestSha256'];assert sha(B/'source-hashes.json')==f['referenceSourcePinsSha256'];z=B/m['sourceZip']['file'];assert sha(z)==f['referenceSourceZipSha256']==m['sourceZip']['sha256']and z.stat().st_size==m['sourceZip']['bytes']
pins={}
for p,h in sp.items():assert sha(B/p)==h;pins[str((B/p).relative_to(R))]=h
with zipfile.ZipFile(z)as a:
 assert len(a.infolist())==20
 for p in a.namelist():
  if p=="source-hashes.json":assert a.read(p)==(B/p).read_bytes();continue
  rel=p
  if rel not in sp:rel=p.split('/',1)[1]
  assert rel in sp and hashlib.sha256(a.read(p)).hexdigest()==sp[rel],p
for p,h in m['evidencePins'].items():assert sha(B/p)==h;pins[str((B/p).relative_to(R))]=h
for p in [B/'FROZEN.json',B/'manifest.json',B/'source-hashes.json',z]:pins[str(p.relative_to(R))]=sha(p)
init=json.loads((O/'initial-source-pins.json').read_text());assert all(sha(R/p)==h for p,h in init.items())
r={'status':'041_initial_reference_frozen_integrity_pass_behavior_blocked_by_E41_ROI_P2','sourceFiles':len(sp),'sourceZipFiles':20,'sourceZipPinnedContentFiles':19,'evidencePinsVerified':len(m['evidencePins']),'initialFivePinsUnchanged':True,'evidenceHashes':pins,'scopeExcluded':'float-candidate and reference-r2 independent candidates not swept'};(O/'reference-frozen-verification.json').write_text(json.dumps(r,indent=2)+'\n');print({k:v for k,v in r.items()if k!='evidenceHashes'})
