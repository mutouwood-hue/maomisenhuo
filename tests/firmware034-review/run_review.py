from pathlib import Path
import json,hashlib,zipfile,subprocess,struct,difflib
R=Path(__file__).resolve().parents[2];H=Path(__file__).resolve().parent;N=R/'artifacts/firmware-local-v3-perf034';S=N/'source';B=R/'artifacts/firmware-local-v3-perf';SAFE=R/'artifacts/firmware-local-v3-dmafix/source'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
f=json.loads((N/'FROZEN.json').read_text());m=json.loads((N/'manifest.json').read_text());hs=json.loads((N/'source-hashes.json').read_text());old=json.loads((B/'source-hashes.json').read_text());delta=json.loads((N/'SOURCE-DELTA.json').read_text())
assert f['runtimeSourceWritesStopped'] and not f['deviceActionsPerformed']
assert sha(N/'manifest.json')==f['manifestSha256'];assert sha(N/'source-hashes.json')==f['sourceHashesSha256']==m['sourceHashesSha256'];assert sha(N/'SOURCE-DELTA.json')==m['sourceDeltaSha256'];assert len(hs)==103 and set(hs)==set(old)
assert all(sha(S/p)==h for p,h in hs.items());assert all(sha(B/'source'/p)==h for p,h in old.items())
for root,manifest,freeze in [(N,m,f),(B,json.loads((B/'manifest.json').read_text()),json.loads((B/'FROZEN.json').read_text()))]:
 for key,fkey in [('app','appSha256'),('sourceZip','sourceZipSha256')]:
  item=manifest[key];p=root/item['path'];assert sha(p)==item['sha256']==freeze[fkey];assert p.stat().st_size==item['bytes']
 assert sha(root/'manifest.json')==freeze['manifestSha256'];assert sha(root/'source-hashes.json')==freeze['sourceHashesSha256']
with zipfile.ZipFile(N/m['sourceZip']['path']) as z:
 entries=z.infolist();assert len(entries)==114 and len({i.filename for i in entries})==114
 for i in entries:
  assert not i.is_dir() and '..' not in Path(i.filename).parts and not i.filename.startswith('/')
  assert z.read(i)==(N/i.filename).read_bytes(),i.filename
 assert sum(i.filename.startswith('source/') for i in entries)==103
changed=[p for p in hs if hs[p]!=old[p]];assert set(changed)=={x['path'] for x in delta['changedSourcePaths']} and len(changed)==4
for x in delta['changedSourcePaths']:
 assert hs[x['path']]==x['candidate034Sha256'] and old[x['path']]==x['base033Sha256']
main={p:h for p,h in hs.items() if p.startswith('main/')};assert len(main)==51 and main==delta['allMainFilesByteIdentical'];assert all(h==old[p] for p,h in main.items())
bsp='components/waveshare__esp32_s3_touch_amoled_1_75c/esp32_s3_touch_amoled_1_75c.c';assert (S/bsp).read_bytes()==(SAFE/bsp).read_bytes()
assert (S/'CMakeLists.txt').read_text()==(B/'source/CMakeLists.txt').read_text().replace('0.3.3','0.3.4')
assert (S/'cmake/private-bsp-integrity.cmake').read_text()==(B/'source/cmake/private-bsp-integrity.cmake').read_text().replace(old[bsp],hs[bsp])
assert (S/'tools/host_preview/preview.c').read_text()==(B/'source/tools/host_preview/preview.c').read_text().replace('artifacts/firmware-local-v3-perf/source/','artifacts/firmware-local-v3-perf034/source/')
for name in ['sdkconfig','sdkconfig.defaults','partitions.csv','dependencies.lock']:
 assert (S/name).read_bytes()==(B/'source'/name).read_bytes()
assert sha(N/'build/partition_table/partition-table.bin')==sha(B/'build/partition_table/partition-table.bin')
assert sha(N/'build/cat_forest_badge.elf')==m['elf']['sha256']==m['app']['description']['elfSha256']
raw=(N/m['app']['path']).read_bytes();d=raw[32:288];assert raw[0]==0xe9 and struct.unpack_from('<I',d)[0]==0xabcd5432;assert struct.unpack_from('<I',d,4)[0]==0;assert d[16:48].split(b'\0')[0]==b'0.3.4-local3';assert len(raw)<0x800000
# Actual unchanged production diagnostics C through existing platform stubs, independently compiled.
D=S/'tools/host_preview';lib=N/'host-build/lvgl/lib/liblvgl.a';out=H/'diag-production-test'
cmd=['clang','-std=gnu11','-O1','-UNDEBUG','-Wall','-Wextra','-Werror','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE','-DLV_CONF_PATH="'+str(D/'lv_conf.h')+'"']
for p in [D/'diag_stubs',D/'stubs',S/'main',R/'firmware/managed_components/lvgl__lvgl',D,N/'host-build/lvgl']:cmd+=['-I',str(p)]
cmd+=[str(D/'diag_test.c'),str(lib),'-lm','-o',str(out)]
c=subprocess.run(cmd,capture_output=True,text=True,timeout=60);(H/'diagnostic-compile.log').write_text(c.stdout+c.stderr);assert c.returncode==0
c=subprocess.run([str(out),str(H/'diagnostic-synthetic-capture.log')],capture_output=True,text=True,timeout=30);(H/'diagnostic-run.log').write_text(c.stdout+c.stderr);assert c.returncode==0;diag=json.loads(c.stdout.strip());assert diag['checksPassed']==34
c=subprocess.run(['python3',str(H/'run_fixed10_isolated.py')],capture_output=True,text=True,timeout=30);(H/'fixed10-run.log').write_text(c.stdout+c.stderr);assert c.returncode==0
assert all(sha(S/p)==h for p,h in hs.items()) and all(sha(B/'source'/p)==h for p,h in old.items())
result={'status':'pass','kind':'independent read-only delta and host-only checks; no device','app':m['app'],'sourceZip':m['sourceZip'],'sourceCount':len(hs),'zipEntries':114,'zipSupportEntries':11,'allMainByteEqual033':51,'changedPaths':changed,'bspExact032Sha256':hs[bsp],'sourceStable':True,'prior033SourceAppZipManifestReverified':True,'partitionSourceSha256':sha(S/'partitions.csv'),'compiledPartitionSha256':sha(N/'build/partition_table/partition-table.bin'),'compiledPartitionUnchanged033':True,'appDescriptionVersion':'0.3.4-local3','secureVersion':0,'fits8MiBAppSlot':True,'diagnosticProductionCTests':diag,'diagnosticCompileCommand':cmd,'diagnosticBinarySha256':sha(out),'linkedExistingHostLvglSha256':sha(lib),'fixed10':json.loads((H/'fixed10-buffer-tests.json').read_text()),'limits':['USB/heap/domain/input host substitutes; not actual hardware','No target build, device, serial, ADB or install','nominal pixel buffer reduction does not prove real heap recovery, faster rendering or capture budget success']}
(H/'report.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'status':'pass','sources':103,'protectedMain':51,'changedPaths':changed,'diag':34,'fixed10':11,'sourceStable':True}))
