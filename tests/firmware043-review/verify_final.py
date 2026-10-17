from pathlib import Path
import hashlib,json,zipfile,struct,subprocess,shutil
R=Path.cwd();C=R/'artifacts/firmware-visual-integration043';B=R/'artifacts/firmware-visual-integration042';O=R/'tests/firmware043-review';sha=lambda b:hashlib.sha256(b).hexdigest();fh=lambda p:sha(p.read_bytes());m=json.loads((C/'manifest.json').read_text());f=json.loads((C/'FROZEN.json').read_text());src=json.loads((C/'source-hashes.json').read_text());sup=json.loads((C/'support-hashes.json').read_text());pins={}
def pin(p):pins[str(p.relative_to(R))]=fh(p)
assert fh(C/'manifest.json')==f['manifestSha256']=='8c3194776d0158badb76e39fb4b52c8d31d67d1b4c022cabb33545f6cb87d0e2';assert fh(C/'source-hashes.json')==f['sourcePinsSha256']==m['sourcePinsSha256'];assert fh(C/'support-hashes.json')==f['supportPinsSha256']==m['supportPinsSha256'];assert len(src)==119 and len(sup)==38
for n in ['FROZEN.json','manifest.json','source-hashes.json','support-hashes.json']:pin(C/n)
for n,h in src.items():p=C/'source'/n;assert fh(p)==h,n;pin(p)
for n,h in sup.items():p=C/n;assert fh(p)==h,n;pin(p)
for n,h in m['evidencePins'].items():p=C/n;assert fh(p)==h,n;pin(p)
for k in ['app','elf','sourceZip']:
 p=C/m[k]['path'];assert fh(p)==m[k]['sha256'] and len(p.read_bytes())==m[k]['bytes'];pin(p)
assert m['app']['sha256']==f['appSha256']=='905552f2f35dc56942b226e9d8558ae98bf31e0e07765ae0c1ba81ab32e88cc2';assert m['elf']['sha256']==f['elfSha256'];assert m['sourceZip']['sha256']==f['zipSha256']
z=zipfile.ZipFile(C/m['sourceZip']['path']);assert len(z.namelist())==158 and len(set(z.namelist()))==158
for n,h in src.items():assert sha(z.read('source/'+n))==h,n
for n,h in sup.items():assert sha(z.read(n))==h,n
assert z.read('source-hashes.json')==(C/'source-hashes.json').read_bytes()
a=(C/m['app']['path']).read_bytes();d=a[32:288];assert a[0]==0xe9 and struct.unpack_from('<I',d)[0]==0xabcd5432;cs=lambda x:x.split(b'\0',1)[0].decode();desc={'version':cs(d[16:48]),'project':cs(d[48:80]),'idf':cs(d[112:144]),'elfSha256':d[144:176].hex()};assert desc['version']=='0.4.3-exactcache' and desc['elfSha256']==m['elf']['sha256'];assert len(a)==7723088 and (len(a)+4095)//4096*4096<0x800000
base=json.loads((B/'source-hashes.json').read_text());same=[n for n,h in base.items() if src.get(n)==h];changed=[n for n,h in base.items() if n in src and src[n]!=h];added=sorted(src.keys()-base.keys());assert len(same)==106 and len(changed)==8 and len(added)==5 and not base.keys()-src.keys()
# Final verifier-only delta is identified without silently inheriting a changed runtime.
r1=json.loads((C/'evidence/source-window-r1.json').read_text());r1=r1.get('pins',r1);final=json.loads((C/'evidence/source-window-final.json').read_text())['pins'];assert [n for n in r1 if r1[n]!=final[n]]==['tools/verify_room_cache.py']
v=(C/'source/tools/verify_room_cache.py').read_text();start=v.index(";assert (S/'room_cache_fingerprint.h')");end=v.index(';print(',start);assert sha((v[:start]+v[end:]).encode())==r1['tools/verify_room_cache.py']
# Run actual source verifier, then only copied build inputs with deliberate negatives.
verifier=C/'source/tools/verify_room_cache.py';p=subprocess.run(['python3',str(verifier)],capture_output=True,text=True);assert not p.returncode,p.stderr
neg=[]
for case in ['camera','material','fingerprint']:
 D=O/('build-verifier-negative-'+case);(D/'tools').mkdir(parents=True,exist_ok=True);(D/'main/assets').mkdir(parents=True,exist_ok=True)
 shutil.copy2(verifier,D/'tools/verify_room_cache.py')
 for n in ['badge_renderer_exact.c','cache-source-transform.json','room_cache_fingerprint.h','assets/room-cache.bin','assets/room-cache-contract.json','assets/pixel-cat.pcat']:shutil.copy2(C/'source/main'/n,D/'main'/n)
 if case=='fingerprint':p=D/'main/room_cache_fingerprint.h';s=p.read_text();assert '0xb0' in s;s=s.replace('0xb0','0xb1',1);p.write_text(s)
 else:
  p=D/'main/badge_renderer_exact.c';s=p.read_text();old,new=('camera(r,-28,14,90)','camera(r,-27,14,90)') if case=='camera' else ('0x936344','0x936345');assert old in s;p.write_text(s.replace(old,new,1))
 q=subprocess.run(['python3',str(D/'tools/verify_room_cache.py')],capture_output=True,text=True);(D/'result.log').write_text(q.stdout+q.stderr);assert q.returncode!=0;neg.append({'case':case,'rejected':True})
# Actual linker metadata: DROM source and unchanged primary config.
cc=json.loads((C/'build/compile_commands.json').read_text());cmd=next(x['command'] for x in cc if x['file'].endswith('/badge_renderer_exact.c'));assert '-DESP_PLATFORM' in cmd and '-ffp-contract=off' in cmd and 'BADGE_RENDERER_CONTEXT_EXPECTED' not in cmd
nm=Path(cmd.split()[0]).with_name('xtensa-esp32s3-elf-nm');q=subprocess.run([str(nm),'-n','-S',str(C/m['elf']['path'])],capture_output=True,text=True);assert not q.returncode;qrows=[l for l in q.stdout.splitlines() if '_binary_room_cache_bin_' in l or '_binary_pixel_cat_pcat_' in l];(O/'linked-symbols.txt').write_text('\n'.join(qrows)+'\n');symbols={l.split()[-1]:int(l.split()[0],16) for l in qrows};assert symbols['_binary_room_cache_bin_end']-symbols['_binary_room_cache_bin_start']==1085860 and symbols['_binary_pixel_cat_pcat_end']-symbols['_binary_pixel_cat_pcat_start']==205624 and all(0x3c000000<=v<0x3e000000 for v in symbols.values())
r={'allPass':True,'sourceCount':119,'supportCount':38,'evidenceCount':len(m['evidencePins']),'zipEntries':158,'appDescription':desc,'appBytes':len(a),'appSectorBytes':(len(a)+4095)//4096*4096,'appSlotRemaining':0x800000-len(a),'unchanged042':same,'changed042':changed,'added043':added,'r1FinalVerifierOnlyReverseHashExact':True,'buildVerifierNegatives':neg,'linkedDromSymbols':symbols,'pins':pins};(O/'final-verification.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items() if k not in ['pins','unchanged042','changed042','added043']},ensure_ascii=False))
