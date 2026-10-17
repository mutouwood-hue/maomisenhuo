from pathlib import Path
import json,hashlib,zipfile
R=Path(__file__).resolve().parents[3];O=Path(__file__).resolve().parent;B=R/'artifacts/firmware-visual-prototype041/reference-r2';P=B.parent;sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();m=json.loads((B/'manifest.json').read_text());f=json.loads((B/'FROZEN.json').read_text());sp=json.loads((B/'source-hashes.json').read_text());old=json.loads((P/'source-hashes.json').read_text());pins={};assert len(sp)==20
assert sha(B/'manifest.json')==f['manifestSha256'];assert sha(B/'source-hashes.json')==f['sourcePinsSha256'];z=B/m['sourceZip']['file'];assert sha(z)==f['sourceZipSha256']==m['sourceZip']['sha256'] and z.stat().st_size==58185
for p,h in sp.items():assert sha(B/p)==h;pins[str((B/p).relative_to(R))]=h
with zipfile.ZipFile(z)as a:
 assert len(a.infolist())==21
 for p in a.namelist():assert a.read(p)==(B/p).read_bytes(),p
for p,h in m['evidencePins'].items():assert sha(B/p)==h;pins[str((B/p).relative_to(R))]=h
for p in [B/'FROZEN.json',B/'manifest.json',B/'source-hashes.json',z]:pins[str(p.relative_to(R))]=sha(p)
assert sha(B/'source/renderer.c')=='a6b04f219b98aab3959b9b58d921ab4dc0f1bb8b4d7f7bece514073f8705252e';assert sha(B/'source/renderer.h')==old['source/renderer.h']
assert all(sha(P/p)==h for p,h in old.items())
r={'status':'host_reference_r2_integrity_pass_not_device_deployment','sourceFiles':len(sp),'zipFiles':21,'evidencePinsVerified':len(m['evidencePins']),'runtimeDelta':'geometry padded bbox containment and ROI placement only','old19FrozenPinsUnchanged':True,'evidenceHashes':pins};(O/'frozen-verification.json').write_text(json.dumps(r,indent=2)+'\n');print({k:v for k,v in r.items()if k!='evidenceHashes'})
