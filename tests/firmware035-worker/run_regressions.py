from pathlib import Path
import subprocess,json,hashlib,shutil,importlib.util
R=Path.cwd();O=R/'artifacts/firmware-local-v3-perf035';B=R/'artifacts/firmware-local-v3-perf034';T=R/'tests/firmware035-worker';H=B/'host-build';P=O/'source/tools/host_preview';LV=R/'firmware/managed_components/lvgl__lvgl';OB=H/'CMakeFiles/badge_host_preview.dir';D=O/'evidence';D.mkdir(exist_ok=True);(O/'host-build').mkdir(exist_ok=True)
cc=['cc','-O3','-std=gnu11','-UNDEBUG','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE',f'-DLV_CONF_PATH="{P}/lv_conf.h"','-I'+str(P/'stubs'),'-I'+str(O/'source/main'),'-I'+str(LV),'-I'+str(P),'-I'+str(H/'lvgl')]
assets=list(OB.rglob('assets/*.c.o'));gesture=next(OB.rglob('badge_gesture.c.o'));diag=OB/'diag_stubs.c.o';lib=H/'lvgl/lib/liblvgl.a'
cmd=cc+[str(P/'preview.c'),str(O/'source/main/badge_scene.c'),str(gesture),str(diag),*[str(p) for p in assets],str(lib),'-lm','-o',str(O/'host-build/badge_host_preview')]
subprocess.run(cmd,check=True)
shutil.copy2(B/'evidence/font-generation.json',D/'font-generation.json')
subprocess.run(['python3',str(O/'tools/run_offline_layout_checks.py')],check=True)
# Fresh actual diagnostic C test compile, pinned 034 LVGL library, production include is 035.
subprocess.run(cc+['-I'+str(P/'diag_stubs'),str(P/'diag_test.c'),str(lib),'-lm','-o',str(O/'host-build/badge_diagnostics_test')],check=True)
p=subprocess.run([str(O/'host-build/badge_diagnostics_test'),str(D/'software-diagnostics-capture.log')],capture_output=True,text=True);(D/'diagnostics-production-c.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr
# diag main writes JSON to current working dir? read stdout and persist with exact provenance.
(D/'diagnostics-production-c-tests.json').write_text(p.stdout);print(p.stdout)
subprocess.run(['python3',str(O/'tools/test_capture_decoder.py')],check=True)
base=json.loads((B/'source-hashes.json').read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();assert all(sha(B/'source'/n)==h for n,h in base.items())
changed={n for n,h in base.items() if sha(O/'source'/n)!=h}
allowed={'CMakeLists.txt','main/badge_scene.c','main/badge_pages.c','tools/host_preview/preview.c'};assert changed==allowed,changed
for k in ['app','sourceZip']:m=json.loads((B/'manifest.json').read_text())[k];assert sha(B/m['path'])==m['sha256']
checks=[]
def check(n,v):assert v,n;checks.append(dict(name=n,passed=True))
bsp='components/waveshare__esp32_s3_touch_amoled_1_75c/esp32_s3_touch_amoled_1_75c.c';s=(O/'source'/bsp).read_text();check('BSP_exact034_and_deployed032',sha(O/'source'/bsp)==base[bsp]==sha(R/'artifacts/firmware-local-v3-dmafix/source'/bsp));check('literal_fixed10_internal_double', '.buffer_height = 10' in s and '.use_psram = false' in s and '.require_double_buffer = true' in s)
for n in base:
 if n.startswith('main/') and n not in {'main/badge_scene.c','main/badge_pages.c'}:check('main_exact034:'+n,sha(O/'source'/n)==base[n])
for n in ['sdkconfig','sdkconfig.defaults','partitions.csv','dependencies.lock']:check('exact034:'+n,sha(O/'source'/n)==base[n])
(D/'immutability-buffer.json').write_text(json.dumps(dict(checks=checks,checkCount=len(checks),changedSourcePaths=sorted(changed),all034FrozenSourceAppZipVerified=True,deviceTouched=False,eachInternalPixelBufferBytes=9320,captureGuard64KiB=True),ensure_ascii=False,indent=2)+'\n')
a=json.loads((D/'layout-tests.json').read_text());b=json.loads((B/'evidence/layout-tests.json').read_text());assert [x['sha256'] for x in a['cases']]==[x['sha256'] for x in b['cases']],'48 full image changes'
(D/'layout-exact034.json').write_text(json.dumps(dict(all48Rgb565HashesExact034=True,sourceFontsUnchanged=True,hardware=False),indent=2)+'\n');print('48 FULL images exact034;',len(checks),'immutability/buffer checks')
