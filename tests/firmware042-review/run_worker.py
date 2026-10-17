from pathlib import Path
import hashlib,json,subprocess,shutil
R=Path.cwd(); O=R/'tests/firmware042-review'; C=R/'artifacts/firmware-visual-integration042'; B=R/'artifacts/device-backups/esp-usb-7c0c5f423684/2026-10-16T1052Z-3d042'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
pins=json.loads((C/'evidence/source-window-r1.json').read_text());assert all(sha(C/'source'/p)==v for p,v in pins.items())
s=(C/'tests/worker_fixture.c').read_text(); s=s[:s.index('int main(')]+'''int main(int argc,char **argv){assert(argc==2);mode=argv[1]; unsigned sample=!strcmp(mode,"normal1")?1:!strcmp(mode,"normal2")?2:0;
if(!strcmp(mode,"recovery")){mode="normal0";assert(badge_renderer_compute(0));assert(allocs==1);mode="cancel";read_calls=0;assert(!badge_renderer_compute(1));assert(!badge_renderer_stats()&&!badge_renderer_pixels());assert(!strcmp(badge_renderer_error(),"CANCELLED"));mode="normal2";assert(badge_renderer_compute(2));assert(allocs==1);sample=2;}
else {bool ok=badge_renderer_compute(sample);assert(ok==(!strncmp(mode,"normal",6)));assert((badge_renderer_pixels()!=NULL)==ok);assert((badge_renderer_stats()!=NULL)==ok);}
if(badge_renderer_pixels()){FILE *f=fopen("tests/firmware042-review/worker-pixels.rgb565","wb");assert(f);assert(fwrite(badge_renderer_pixels(),2,65536,f)==65536);fclose(f);}
char line[1536];badge_renderer_report(line,sizeof(line),false);puts(line);return 0;}
'''
(O/'worker-independent.c').write_text(s);(O/'model_embed.S').write_text((C/'tests/model_embed.S').read_text())
cmd=['clang','-O1','-g','-fsanitize=address,undefined','-fno-omit-frame-pointer','-Wall','-Wextra','-DESP_PLATFORM','-DBADGE_RENDERER_CONTEXT_EXPECTED=431880','-I'+str(C/'source/main'),'-I'+str(C/'tests/platform-stubs'),str(O/'worker-independent.c'),str(O/'model_embed.S'),str(C/'source/main/badge_renderer_panel.c'),str(C/'source/main/badge_renderer_exact.c'),'-o',str(O/'worker-independent')]
p=subprocess.run(cmd,text=True,capture_output=True);(O/'worker-build.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr
records=[]; gold=json.loads((B/'expected-render-samples.json').read_text())['records']
for mode in ['normal0','normal1','normal2','allocfail','deadline','cancel','dmafail','dromfail','notexternal','recovery']:
 p=subprocess.run([str(O/'worker-independent'),mode],text=True,capture_output=True);(O/f'worker-{mode}.log').write_text(p.stdout+p.stderr);assert p.returncode==0,(mode,p.stderr)
 row=json.loads(p.stdout.split('CFDIAG RENDER ',1)[1]);row['fixtureMode']=mode
 if row['valid']:
  g=gold[row['sample']];assert all(row[k]==g[k] for k in ['roi','catBounds','triangles','tested','inside','written','crc32']);assert sha(O/'worker-pixels.rgb565')==g['sha256'];row['goldenByteExact']=True
 records.append(row)
assert all(sha(C/'source'/p)==v for p,v in pins.items())
result={'scope':'actual production C with explicit host ESP allocator/USB/clock/stack substitutes; ASAN+UBSAN; no device proof','cases':records,'sourcePins':pins,'compile':cmd,'allPass':True}
(O/'worker-results.json').write_text(json.dumps(result,indent=2)+'\n'); print(json.dumps({'cases':len(records),'goldenMatches':sum(r.get('goldenByteExact',False) for r in records),'allPass':True}))
