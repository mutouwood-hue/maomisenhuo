from pathlib import Path
import json,subprocess,hashlib
R=Path.cwd();O=R/'tests/firmware043-review';C=R/'artifacts/firmware-visual-integration043';S=C/'source/main';P=R/'artifacts/device-backups/esp-usb-7c0c5f423684/2026-10-16T1052Z-3d042';gold=json.loads((P/'expected-render-samples.json').read_text())['records']
s=(C/'tests/worker_fixture.c').read_text();s=s[:s.index('int main(')]+r'''int main(int argc,char**argv){assert(argc==2);mode=argv[1];unsigned sample=!strcmp(mode,"normal1")?1:!strcmp(mode,"normal2")?2:0;bool ok=badge_renderer_compute(sample);bool expected=!strncmp(mode,"normal",6)||!strcmp(mode,"cachefallback")||!strcmp(mode,"badcache");assert(ok==expected);assert((badge_renderer_pixels()!=NULL)==ok);assert((badge_renderer_stats()!=NULL)==ok);char line[1536];badge_renderer_report(line,sizeof(line),ok);assert(strlen(line)<1535);puts(line);if(ok){assert(allocs==1);assert(badge_renderer_compute(sample));assert(allocs==1);badge_renderer_report(line,sizeof(line),true);assert(strlen(line)<1535);puts(line);}else if(!strncmp(mode,"cancel",6)||!strcmp(mode,"deadline")){mode="normal0";assert(badge_renderer_compute(0));assert(allocs==1);badge_renderer_report(line,sizeof(line),true);puts(line);}return 0;}
'''
(O/'worker.c').write_text(s)
def asm(cache):return '.section __TEXT,__const\n.globl _binary_pixel_cat_pcat_start\n_binary_pixel_cat_pcat_start:\n.incbin "'+str(S/'assets/pixel-cat.pcat')+'"\n.globl _binary_pixel_cat_pcat_end\n_binary_pixel_cat_pcat_end:\n.globl _binary_room_cache_bin_start\n_binary_room_cache_bin_start:\n.incbin "'+str(cache)+'"\n.globl _binary_room_cache_bin_end\n_binary_room_cache_bin_end:\n'
(O/'model.S').write_text(asm(S/'assets/room-cache.bin'));bad=bytearray((S/'assets/room-cache.bin').read_bytes());bad[-1]^=1;(O/'corrupt-cache-fixture.bin').write_bytes(bad);(O/'model-corrupt.S').write_text(asm(O/'corrupt-cache-fixture.bin'))
flags=['clang','-O1','-g','-ffp-contract=off','-fsanitize=address,undefined','-fno-omit-frame-pointer','-Wall','-Wextra','-DESP_PLATFORM','-DBADGE_RENDERER_CONTEXT_EXPECTED=431880','-I'+str(S),'-I'+str(C/'tests/platform-stubs')];logs=[]
for name,assembly in [('worker','model.S'),('worker-corrupt','model-corrupt.S')]:
 cmd=flags+[str(O/'worker.c'),str(O/assembly),str(S/'badge_renderer_panel.c'),str(S/'badge_renderer_exact.c'),'-o',str(O/name)];p=subprocess.run(cmd,capture_output=True,text=True);logs.append(p.stdout+p.stderr);assert not p.returncode,p.stderr
(O/'worker-build.log').write_text(''.join(logs));records=[]
for mode in ['normal0','normal1','normal2','allocfail','deadline','cancel','cancelcopy','cancelraster','dmafail','dromfail','notexternal','cachefallback','badcache']:
 binary=O/('worker-corrupt' if mode=='badcache' else 'worker');p=subprocess.run([str(binary),mode],capture_output=True,text=True);(O/('worker-'+mode+'.log')).write_text(p.stdout+p.stderr);assert not p.returncode,(mode,p.stderr)
 rows=[json.loads(x) for x in p.stdout.split('CFDIAG RENDER ')[1:]]
 for r in rows:
  if r['valid']:
   g=gold[r['sample']];assert all(r[k]==g[k] for k in ['roi','catBounds','crc32']);assert r['completeFrame'] and r['published']
   assert r['roomCacheUsed']==(mode not in ['badcache','cachefallback']);assert r['roomCacheBytes']==1085860
  else:assert not r['completeFrame'] and not r['published'] and r['partialCounters']
 records.append({'fixture':mode,'reports':rows})
r={'scope':'actual production ESP branches with explicit host DROM/PSRAM/clock/USB/stack substitutes and431880host-pointer-layout override; no device timing','allPass':True,'cases':records,'caseCount':len(records),'maxJsonLineBytes':max(len(json.dumps(x,separators=(',',':'))) for q in records for x in q['reports'])};(O/'worker-results.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'cases':len(records),'allPass':True,'maxJsonLineBytes':r['maxJsonLineBytes']}))
