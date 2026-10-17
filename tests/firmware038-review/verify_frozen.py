from pathlib import Path
import json,hashlib,zipfile,struct
T=Path(__file__).resolve().parent; R=T.parents[1];B=R/'artifacts/firmware-local-v3-visual038';P=R/'artifacts/firmware-local-v3-perf037'
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
m=json.loads((B/'manifest.json').read_text()); f=json.loads((B/'FROZEN.json').read_text());s=json.loads((B/'source-hashes.json').read_text());bs=json.loads((P/'source-hashes.json').read_text())
assert h(B/'manifest.json')==f['manifestSha256'] and h(B/'source-hashes.json')==f['sourceHashesSha256']
assert len(s)==107 and set(s)==set(bs)
changed=[]
for rel,v in s.items():
 assert h(B/'source'/rel)==v and h(P/'source'/rel)==bs[rel],rel
 if v!=bs[rel]:changed.append(rel)
assert sorted(changed)==sorted(['CMakeLists.txt','main/badge_pages.c','main/badge_scene.c','main/badge_scene.h','tools/host_preview/preview.c'])
for k in ['app','elf','sourceZip']:
 assert h(B/m[k]['path'])==m[k]['sha256']
 if 'bytes' in m[k]:assert (B/m[k]['path']).stat().st_size==m[k]['bytes']
z=zipfile.ZipFile(B/m['sourceZip']['path'])
for rel,v in s.items():
 ns=[n for n in z.namelist() if n.endswith('/source/'+rel) or n=='source/'+rel or n==rel];assert len(ns)==1,(rel,ns);assert hashlib.sha256(z.read(ns[0])).hexdigest()==v
app=(B/m['app']['path']).read_bytes();assert app[48:80].split(b'\0')[0]==b'0.3.8-local3';assert app[176:208].hex()==m['elf']['sha256']
cc=json.loads((B/'build/compile_commands.json').read_text());mask=[x for x in cc if x['file'].endswith('/lv_draw_sw_mask.c')];assert len(mask)==1 and '/private/' in mask[0]['file'];assert 'CATFOREST_MASK_POOL_HOST_TEST' not in mask[0]['command'];assert '-DESP_PLATFORM' in mask[0]['command'] and '-Werror' in mask[0]['command'];assert mask[0]['command']==json.loads((B/'evidence/actual-mask-compile-command.json').read_text())['command']
for n,v in m['testEvidenceSha256'].items():assert h(B/'evidence'/n)==v,n
for rel in ['main/badge_pages.c','main/badge_scene.c','main/badge_scene.h','tools/host_preview/preview.c']:assert h(T/'source-r3'/Path(rel).name)==s[rel]
print('PASS: frozen 107 sources, 102 unchanged, 107 ZIP source entries, app/ELF descriptor, private target TU and evidence pins')
