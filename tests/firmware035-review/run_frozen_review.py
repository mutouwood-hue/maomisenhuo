from pathlib import Path
import json,hashlib,zipfile,subprocess,struct,os,array,shutil
R=Path(__file__).resolve().parents[2];H=Path(__file__).resolve().parent;N=R/'artifacts/firmware-local-v3-perf035';B=R/'artifacts/firmware-local-v3-perf034';S=N/'source';BS=B/'source'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert shutil.disk_usage(H).free>300*1024*1024,'Stop: insufficient free space; no deletion permitted'
f=json.loads((N/'FROZEN.json').read_text());m=json.loads((N/'manifest.json').read_text());hs=json.loads((N/'source-hashes.json').read_text());old=json.loads((B/'source-hashes.json').read_text());delta=json.loads((N/'SOURCE-DELTA.json').read_text())
assert f['runtimeSourceWritesStopped'] and not f['deviceTouched'];assert sha(N/'manifest.json')==f['manifestSha256'];assert sha(N/'source-hashes.json')==f['sourceHashesSha256'];assert len(hs)==len(old)==103 and set(hs)==set(old)
assert all(sha(S/p)==v for p,v in hs.items()) and all(sha(BS/p)==v for p,v in old.items())
for root in [N,B]:
 mm=json.loads((root/'manifest.json').read_text());ff=json.loads((root/'FROZEN.json').read_text())
 assert sha(root/'manifest.json')==ff['manifestSha256'] and sha(root/'source-hashes.json')==ff['sourceHashesSha256']
 for key,fkey in [('app','appSha256'),('sourceZip','sourceZipSha256')]:
  p=root/mm[key]['path'];assert sha(p)==mm[key]['sha256']==ff[fkey];assert p.stat().st_size==mm[key]['bytes']
 assert sha(root/mm['elf']['path'])==mm['elf']['sha256']
with zipfile.ZipFile(N/m['sourceZip']['path']) as z:
 assert len({i.filename for i in z.infolist()})==len(z.infolist())
 for i in z.infolist():assert '..' not in Path(i.filename).parts and not i.filename.startswith('/') and z.read(i)==((R/i.filename) if i.filename.startswith('tests/firmware035-worker/') else (N/i.filename)).read_bytes()
 zipcount=len(z.infolist());assert sum(i.filename.startswith('source/') for i in z.infolist())==103
changed=[p for p in hs if hs[p]!=old[p]];assert set(changed)=={x['path'] for x in delta['changed']} and len(changed)==4
for x in delta['changed']:assert old[x['path']]==x['base034Sha256'] and hs[x['path']]==x['candidate035Sha256']
assert set(p for p in changed if p.startswith('main/'))=={'main/badge_pages.c','main/badge_scene.c'}
for name in ['sdkconfig','sdkconfig.defaults','partitions.csv','dependencies.lock','cmake/private-bsp-integrity.cmake','main/badge_diagnostics.c','main/badge_display_capture.h','main/local2_core.c','main/local2_store.c','main/local2_ble.c','main/local2_wire.c']:
 assert (S/name).read_bytes()==(BS/name).read_bytes()
assert (S/'CMakeLists.txt').read_text()==(BS/'CMakeLists.txt').read_text().replace('0.3.4','0.3.5')
assert (N/'build/partition_table/partition-table.bin').read_bytes()==(B/'build/partition_table/partition-table.bin').read_bytes()
for p,h in m['testEvidence'].items():assert sha(N/'evidence'/p)==h
raw=(N/m['app']['path']).read_bytes();assert raw[0]==0xe9 and struct.unpack_from('<I',raw,32)[0]==0xabcd5432 and struct.unpack_from('<I',raw,36)[0]==0;assert raw[48:80].split(b'\0')[0]==b'0.3.5-local3' and len(raw)<0x800000
# Reproduce both actual production variants. Only fixture raw-output volume is reduced.
fixture=(R/'tests/firmware035-worker/bench.c').read_text()
line='const char *dir=getenv("BENCH_RAW_DIR");assert(dir);char path[4096];snprintf(path,sizeof(path),"%s/%s.rgb565",dir,tag);FILE *f=fopen(path,"wb");assert(f);assert(fwrite(framebuffer,1,sizeof(framebuffer),f)==sizeof(framebuffer));fclose(f);'
assert fixture.count(line)==1
fixture=fixture.replace(line,'if(!strcmp(tag,"return-home")||!strcmp(tag,"drag-rebound")||!strcmp(tag,"toast-font")||!strcmp(tag,"toast-gone")){'+line+'}')
(H/'bench-isolated.c').write_text(fixture)
P=S/'tools/host_preview';LV=R/'firmware/managed_components/lvgl__lvgl';OB=B/'host-build/CMakeFiles/badge_host_preview.dir';lib=B/'host-build/lvgl/lib/liblvgl.a';assets=list(OB.rglob('assets/*.c.o'));assert len(assets)==12;gesture=next(OB.rglob('badge_gesture.c.o'));diag=OB/'diag_stubs.c.o'
owner=json.loads((N/'evidence/partial10-ablation.json').read_text());assert all(sha(R/p)==h for p,h in owner['readOnlyObjects'].items())
basecc=['clang','-O3','-std=gnu11','-UNDEBUG','-Wall','-Wextra','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE',f'-DLV_CONF_PATH="{P}/lv_conf.h"','-I'+str(P/'stubs'),'-I'+str(LV),'-I'+str(P),'-I'+str(B/'host-build/lvgl')]
results={};commands=[]
for mode in ['continuous','full-oracle']:
 for variant,src in [('baseline034',BS),('candidate035',S)]:
  exe=H/f'{variant}-{mode}';outdir=H/f'{variant}-{mode}-raw';outdir.mkdir(exist_ok=True)
  cmd=basecc+['-I'+str(src/'main'),f'-DBADGE_PAGES_SOURCE="{src}/main/badge_pages.c"']+(['-DBENCH_CONTINUOUS=1'] if mode=='continuous' else [])+[str(H/'bench-isolated.c'),str(src/'main/badge_scene.c'),str(gesture),str(diag),*[str(p) for p in assets],str(lib),'-lm','-o',str(exe)]
  c=subprocess.run(cmd,capture_output=True,text=True,timeout=60);(H/f'{variant}-{mode}-compile.log').write_text(c.stdout+c.stderr);assert c.returncode==0,c.stderr
  run=subprocess.run([str(exe)],env=dict(os.environ,BENCH_RAW_DIR=str(outdir)),capture_output=True,text=True,timeout=60);(H/f'{variant}-{mode}.log').write_text(run.stdout+run.stderr);assert run.returncode==0,run.stderr
  parse={'metrics':[],'samples':{},'full':{},'deviations':{},'checks':None}
  for l in run.stdout.splitlines():
   v=l.split()
   if not v:continue
   if v[0]=='METRIC':parse['metrics'].append({'case':v[1],'repeats':int(v[2]),'hostWallUs':int(v[3]),'flushes':int(v[4]),'pixels':int(v[5])})
   elif v[0]=='SAMPLE':parse['samples'][v[1]]=v[2]
   elif v[0]=='FULL':parse['full'][v[1]]=v[2]
   elif v[0]=='DEVIATION':parse['deviations'].setdefault(v[1],[]).append([int(x) for x in v[2:]])
   elif v[0]=='CHECKS':parse['checks']=int(v[1])
  assert len(parse['samples'])==115
  results[variant+'-'+mode]=parse;commands.append(cmd)
fulla=results['baseline034-full-oracle'];fullb=results['candidate035-full-oracle'];assert fulla['full']==fullb['full'] and len(fulla['full'])==115
ca=results['baseline034-continuous'];cb=results['candidate035-continuous'];diffkeys=[k for k in ca['samples'] if ca['samples'][k]!=cb['samples'][k]];assert diffkeys==['toast-font','toast-gone']
diffs={}
for tag in diffkeys:
 a=array.array('H');a.frombytes((H/'baseline034-continuous-raw'/f'{tag}.rgb565').read_bytes());b=array.array('H');b.frombytes((H/'candidate035-continuous-raw'/f'{tag}.rgb565').read_bytes());d=[[i,a[i],b[i]] for i in range(len(a)) if a[i]!=b[i]];assert len(d)==8
 ch=lambda n:((n>>11)&31,(n>>5)&63,n&31)
 diffs[tag]={'pixels':len(d),'bounds':[min(v[0]%466 for v in d),min(v[0]//466 for v in d),max(v[0]%466 for v in d),max(v[0]//466 for v in d)],'maxRGB565Delta':[max(abs(ch(v[1])[k]-ch(v[2])[k]) for v in d) for k in range(3)],'differentPixels':d};assert diffs[tag]['maxRGB565Delta']==[7,5,3]
# Unchanged-poll and real synthetic drag results, no physical performance claim.
assert all(x['pixels']==64*466*466 for x in ca['metrics'][:4]);assert all(x['pixels']==386304 for x in cb['metrics'][:4])
assert ca['metrics'][-2]['pixels']==3196508 and cb['metrics'][-2]['pixels']==3087072;assert ca['metrics'][-1]['pixels']==cb['metrics'][-1]['pixels']==1715072
# Independent strict build/rerun actual unchanged diagnostics C via owner's platform stubs.
D=P;out=H/'diagnostic-production';cmd=['clang','-std=gnu11','-O1','-UNDEBUG','-Wall','-Wextra','-Werror','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE',f'-DLV_CONF_PATH="{D}/lv_conf.h"']
for pp in [D/'diag_stubs',D/'stubs',S/'main',LV,D,B/'host-build/lvgl']:cmd+=['-I',str(pp)]
cmd+=[str(D/'diag_test.c'),str(lib),'-lm','-o',str(out)];c=subprocess.run(cmd,capture_output=True,text=True,timeout=60);(H/'diagnostic-compile.log').write_text(c.stdout+c.stderr);assert c.returncode==0
c=subprocess.run([str(out),str(H/'synthetic-diagnostic-capture.log')],capture_output=True,text=True,timeout=30);(H/'diagnostic-run.log').write_text(c.stdout+c.stderr);assert c.returncode==0;dd=json.loads(c.stdout);assert dd['checksPassed']==34
assert all(sha(S/p)==v for p,v in hs.items()) and all(sha(BS/p)==v for p,v in old.items())
report={'status':'host_delta_reproduced_known_raster_residual','kind':'independent offline recompile actual production034/035 with readonly LVGL/assets; no physical devices/Git/delete','app':m['app'],'sourceZip':m['sourceZip'],'zipEntries':zipcount,'sourceFiles':103,'changedPaths':changed,'unchangedMainFiles':49,'protectedBase034SourceAppElfZip':True,'sourceStable':True,'hostReadOnlyObjectHashes':owner['readOnlyObjects'],'compileCommands':commands,'results':results,'fullRasterExactUniqueSamples':115,'continuousExactUniqueSamples':113,'continuousDifferences':diffs,'diagnosticChecks':dd,'diagnosticCommand':cmd,'notOpticalOrSwipeFix':True,'rawOutputReducedTo4SamplesPerContinuousVariant':True,'diskSpaceBeforeScriptBytes':shutil.disk_usage(H).free}
(H/'frozen-review.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'package':'pass','sourceFiles':103,'protectedMain':49,'fullExact':115,'continuousExact':113,'residualTags':diffkeys,'diag':34,'sourceStable':True}))
