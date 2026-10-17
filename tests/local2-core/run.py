#!/usr/bin/env python3
"""Execute actual core and NVS adapter with isolated host I/O doubles, never hardware."""
import hashlib,json,pathlib,subprocess,tempfile
root=pathlib.Path(__file__).resolve().parents[2]
src=root/'artifacts/firmware-local-v2/source/main'
tests=pathlib.Path(__file__).parent
flags=['/usr/bin/clang','-std=c11','-Wall','-Wextra','-Werror','-pedantic','-fsanitize=address,undefined','-fno-omit-frame-pointer','-I',str(src)]
with tempfile.TemporaryDirectory(prefix='catforest-local2-core-') as d:
 exe=pathlib.Path(d)/'core-test'
 subprocess.run(flags+[str(src/'local2_core.c'),str(tests/'test_core.c'),'-o',str(exe)],check=True)
 core=json.loads(subprocess.run([str(exe)],check=True,capture_output=True,text=True).stdout)
 exe=pathlib.Path(d)/'store-test'
 subprocess.run(flags+['-I',str(tests/'mocks'),str(src/'local2_core.c'),str(src/'local2_store.c'),str(tests/'test_store.c'),'-pthread','-o',str(exe)],check=True)
 scenarios=['new','load','alloc','mutex_alloc','nvs_init','nvs_open','get_size','get_read','corrupt','oversize','init_set_fail','init_commit_fail','set_fail','commit_old','commit_new','lock_busy','concurrent']
 store=[]
 for scenario in scenarios:
  r=subprocess.run([str(exe),scenario],capture_output=True,text=True)
  if r.returncode:raise RuntimeError(f'{scenario}: {r.stdout}\n{r.stderr}')
  store.append(json.loads(r.stdout))
 result={'scope':'actual production core + actual NVS adapter; SDK/NVS/mutex I/O doubles on host; no hardware/radio acceptance','core':core,'storeScenarios':store,'checks':core['checks']+sum(s['checks'] for s in store),'failures':0,'maxEncodedBytes':core['maxEncodedBytes'],'coreBytes':core['coreBytes'],'sourceSha256':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [src/'local2_core.c',src/'local2_core.h',src/'local2_store.c',src/'local2_store.h',tests/'test_core.c',tests/'test_store.c']}}
 (tests/'report.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result,ensure_ascii=False))
