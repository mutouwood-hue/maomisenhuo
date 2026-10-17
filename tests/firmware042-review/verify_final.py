from pathlib import Path
import json,hashlib,zipfile,struct
R=Path.cwd();C=R/'artifacts/firmware-visual-integration042';O=R/'tests/firmware042-review';B=R/'artifacts/firmware-local-v3-visual038'
sha=lambda b:hashlib.sha256(b).hexdigest();fh=lambda p:sha(p.read_bytes())
m=json.loads((C/'manifest.json').read_text());f=json.loads((C/'FROZEN.json').read_text());src=json.loads((C/'source-hashes.json').read_text());sup=json.loads((C/'support-hashes.json').read_text())
assert fh(C/'manifest.json')=='384b90a1581654f09334de67abf2f9816871435bb001faca57af9d5a62300f45'==f['manifestSha256']
assert fh(C/'source-hashes.json')==f['sourcePinsSha256']==m['sourcePinsSha256'];assert fh(C/'support-hashes.json')==f['supportPinsSha256']==m['supportPinsSha256']
assert len(src)==114 and len(sup)==29
pins={}
def pin(p):pins[str(p.relative_to(R))]=fh(p)
for p in ['manifest.json','FROZEN.json','source-hashes.json','support-hashes.json']:pin(C/p)
for n,h in src.items():p=C/'source'/n;assert fh(p)==h,n;pin(p)
for n,h in sup.items():p=C/n;assert fh(p)==h,n;pin(p)
for n,h in m['evidencePins'].items():p=C/n;assert fh(p)==h,n;pin(p)
for k in ['app','elf','sourceZip']:
 p=C/m[k]['path'];assert fh(p)==m[k]['sha256'];assert len(p.read_bytes())==m[k]['bytes'];pin(p)
assert m['app']['sha256']==f['appSha256']=='b0d1704032c1067455b4355617924dadc63efa20a4ec245189e75d75b99f8bcc';assert m['elf']['sha256']==f['elfSha256'];assert m['sourceZip']['sha256']==f['zipSha256']
z=zipfile.ZipFile(C/m['sourceZip']['path']);names=z.namelist();assert len(names)==144 and len(names)==len(set(names))
for n,h in src.items():assert sha(z.read('source/'+n))==h,n
for n,h in sup.items():assert sha(z.read(n))==h,n
assert z.read('source-hashes.json')==(C/'source-hashes.json').read_bytes()
# Exact app descriptor stored immediately after ESP image+first segment headers.
a=(C/m['app']['path']).read_bytes();d=a[32:288];assert a[0]==0xe9 and struct.unpack_from('<I',d)[0]==0xabcd5432
cstr=lambda b:b.split(b'\0',1)[0].decode();desc={'version':cstr(d[16:48]),'project':cstr(d[48:80]),'idf':cstr(d[112:144]),'elfSha256':d[144:176].hex()};assert desc['version']=='0.4.2-exact3d' and desc['elfSha256']==m['elf']['sha256']
old=json.loads((C/'evidence/source-window-r1.json').read_text());new=json.loads((C/'evidence/source-window-final.json').read_text())['pins'];changed=[n for n in old if old[n]!=new[n]];assert changed==['main/badge_diagnostics.c']
s=(C/'source/main/badge_diagnostics.c').read_text();start=s.index('\\nCFDIAG RENDER_BEGIN ');end=s.index('\\n"',start)+2;finaltext=s[start:end];prior='\\nCFDIAG RENDER_BEGIN one_shot_outside_gui_lock; any input cancels; maximum 15s plus bounded row; no domain action\\n';assert sha((s[:start]+prior+s[end:]).encode())==old['main/badge_diagnostics.c']
base=json.loads((B/'source-hashes.json').read_text());same=[n for n,h in base.items() if n in src and src[n]==h];diff=[n for n,h in base.items() if n in src and src[n]!=h];assert len(same)==97 and len(diff)==10
r={'allPass':True,'sourceCount':len(src),'supportCount':len(sup),'evidenceCount':len(m['evidencePins']),'zipEntries':len(names),'appDescription':desc,'appBytes':len(a),'appDelta038':len(a)-6402112,'unchanged038':same,'changed038':diff,'r1FinalDelta':{'file':changed[0],'textOnlyReverseHashVerified':True,'finalText':finaltext},'pins':pins}
(O/'final-verification.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items() if k not in ['pins','unchanged038','changed038']},ensure_ascii=False,indent=2))
