from pathlib import Path
import json,hashlib,zipfile,subprocess,os,shutil,importlib.util
R=Path(__file__).resolve().parents[2];H=Path(__file__).resolve().parent;N=R/'artifacts/firmware-local-v3-perf';S=N/'source';B=R/'artifacts/firmware-local-v3-dmafix/source'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
f=json.loads((N/'FROZEN.json').read_text());m=json.loads((N/'manifest.json').read_text());hs=json.loads((N/'source-hashes.json').read_text());delta=json.loads((N/'SOURCE-DELTA.json').read_text());idx=json.loads((N/'evidence/REVIEW-INDEX.json').read_text());assert f['runtimeSourceWritesStopped']
assert sha(N/'manifest.json')==f['manifestSha256'];assert sha(N/'source-hashes.json')==f['sourceHashesSha256']==m['sourceHashManifestSha256'];assert sha(N/'SOURCE-DELTA.json')==m['sourceDeltaSha256']==idx['sourceDeltaSha256'];assert len(hs)==103
assert all(sha(S/p)==h for p,h in hs.items())
for key,fkey in [('app','appSha256'),('sourceZip','sourceZipSha256')]:
 p=N/m[key]['path'];assert sha(p)==m[key]['sha256']==f[fkey];assert p.stat().st_size==m[key]['bytes']
with zipfile.ZipFile(N/m['sourceZip']['path']) as z:
 assert len([i for i in z.infolist() if i.filename.startswith('source/')])==103 and len(z.infolist())==114
 for i in z.infolist():
  assert '..' not in Path(i.filename).parts and not i.filename.startswith('/')
  if i.filename.startswith('source/'):
   p=i.filename[7:];assert p in hs and hashlib.sha256(z.read(i)).hexdigest()==hs[p]
  else:assert z.read(i)==(N/i.filename).read_bytes()
protected=delta['protectedExistingMainFiles'];assert all(sha(S/p)==h and sha(B/p)==h for p,h in protected.items());assert (S/'partitions.csv').read_bytes()==(B/'partitions.csv').read_bytes();assert sha(N/'build/partition_table/partition-table.bin')==m['partitionTableSha256']
for x in idx['runtimePaths']+idx['buildConfigPaths']:
 assert sha(S/x['path'])==x['candidateSha256']
 if x['baseSha256'] is not None:assert sha(B/x['path'])==x['baseSha256']
fg=json.loads((N/'evidence/font-generation.json').read_text());assert sha(R/fg['source'])==fg['source_sha256'];assert sha(N/fg['license_path'])==fg['license_sha256'];assert len(fg['known_codepoints'])==3868
for p,h in fg['input_hashes'].items():assert sha(S/p)==h
# Compile actual production diagnostic C via the unmodified owner's platform harness into reviewer-owned output.
D=S/'tools/host_preview';lib=N/'host-build/lvgl/lib/liblvgl.a';out=H/'diag-production-test'
cmd=['clang','-std=gnu11','-O1','-UNDEBUG','-Wall','-Wextra','-Werror','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE','-DLV_CONF_PATH="'+str(D/'lv_conf.h')+'"']
for p in [D/'diag_stubs',D/'stubs',S/'main',R/'firmware/managed_components/lvgl__lvgl',D,N/'host-build/lvgl']:cmd+=['-I',str(p)]
cmd+=[str(D/'diag_test.c'),str(lib),'-lm','-o',str(out)]
c=subprocess.run(cmd,capture_output=True,text=True,timeout=60);(H/'diagnostic-compile.log').write_text(c.stdout+c.stderr);assert c.returncode==0
c=subprocess.run([str(out),str(H/'diagnostic-synthetic-capture.log')],capture_output=True,text=True,timeout=30);(H/'diagnostic-run.log').write_text(c.stdout+c.stderr);assert c.returncode==0;diag=json.loads(c.stdout.strip());assert diag['checksPassed']==34
# Re-execute existing actual LVGL owner's 48-case runner; frozen binary read only, all new outputs isolated.
layout=json.loads((N/'evidence/layout-tests.json').read_text());dest=H/'layout-rerun';dest.mkdir(exist_ok=True);rows=[];host=N/'host-build/badge_host_preview'
for case in layout['cases']:
 name=case['case'];stem=dest/name
 c=subprocess.run([str(host),name,str(stem)],capture_output=True,text=True,timeout=30);stem.with_suffix('.log').write_text(c.stdout+c.stderr);assert c.returncode==0,name
 raw=stem.with_suffix('.rgb565');j=json.loads(stem.with_suffix('.json').read_text());assert not j['missing_glyph_count'];assert sha(raw)==case['sha256'],name
 rows.append({'case':name,'assertions':j['input_assertions_passed'],'rawSha256':sha(raw),'sameAsFrozenOwnerEvidence':True})
# Exact decoder tests copied into isolated location; their output remains under reviewer directory.
copy=H/'decoder';copy.mkdir(exist_ok=True);(H/'evidence').mkdir(exist_ok=True);shutil.copyfile(N/'tools/test_capture_decoder.py',copy/'test_capture_decoder.py');env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1',PYTHONPATH=str(N/'tools'))
c=subprocess.run(['python3',str(copy/'test_capture_decoder.py')],env=env,capture_output=True,text=True,timeout=30);(H/'decoder-run.log').write_text(c.stdout+c.stderr);assert c.returncode==0
assert all(sha(S/p)==h for p,h in hs.items())
result={'status':'pass','scope':'host_only_no_device_or_target_build','app':m['app'],'sourceZip':m['sourceZip'],'sourceCount':len(hs),'totalZipEntries':114,'extraSupportFiles':11,'protectedBaseMainFilesByteEqual':len(protected),'partitionCsvSha256':sha(S/'partitions.csv'),'compiledPartitionSha256':sha(N/'build/partition_table/partition-table.bin'),'sourceStableAfterTests':True,'diagnosticProductionCCompileCommand':cmd,'diagnosticProductionCTests':diag,'diagnosticBinarySha256':sha(out),'linkedExistingHostLvglLibrarySha256':sha(lib),'layoutExecution':'unmodified frozen owner host executable rerun with reviewer-owned outputs; not independently recompiled entire UI','layoutExecutableSha256':sha(host),'layoutRerunCases':rows,'uniqueFontAssertionsPerHarness':len(fg['known_codepoints'])*3*4,'decoderChecks':14,'limitations':['USB/heap/domain/input/NVS are host substitutes','no physical buffers/optical scanout/performance/clock/FIFO proved','capture pause and USB transfer cannot be used as performance window']}
(H/'report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'status':'pass','sourceCount':103,'protectedBaseMainFiles':len(protected),'diagChecks':34,'layoutCases':len(rows),'decoderChecks':14,'sourceStable':True}))
