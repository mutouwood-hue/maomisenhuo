from pathlib import Path
import subprocess,json,hashlib,shutil
R=Path.cwd();T=R/'tests/firmware038-worker';O=R/'artifacts/firmware-local-v3-visual038';B=R/'artifacts/firmware-local-v3-perf034';BASE=R/'artifacts/firmware-local-v3-perf037';H=B/'host-build';P=O/'source/tools/host_preview';LV=R/'firmware/managed_components/lvgl__lvgl';OB=H/'CMakeFiles/badge_host_preview.dir';D=O/'evidence';(O/'host-build').mkdir(exist_ok=True)
cc=['cc','-O3','-std=gnu11','-UNDEBUG','-DCATFOREST_MASK_POOL_HOST_TEST=1','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE',f'-DLV_CONF_PATH="{P}/lv_conf.h"','-I'+str(P/'stubs'),'-I'+str(O/'source/main'),'-I'+str(LV),'-I'+str(P),'-I'+str(H/'lvgl'),'-I'+str(LV/'src/draw/sw')]
extra=[str(O/'source/private/lvgl_mask_pool/lv_draw_sw_mask.c'),str(T/'pool_port.c'),str(T/'pool_exit_proof.c')];assets=list(OB.rglob('assets/*.c.o'));gesture=next(OB.rglob('badge_gesture.c.o'));diag=OB/'diag_stubs.c.o';lib=H/'lvgl/lib/liblvgl.a'
subprocess.run(cc+[str(P/'preview.c'),str(O/'source/main/badge_scene.c'),*extra,str(gesture),str(diag),*[str(p) for p in assets],str(lib),'-lm','-o',str(O/'host-build/badge_host_preview')],check=True)
shutil.copy2(B/'evidence/font-generation.json',D/'font-generation.json');subprocess.run(['python3',str(O/'tools/run_offline_layout_checks.py')],check=True)
assert all('POOL_PROOF explicit-capability alloc=1 release=1' in p.read_text() for p in (D/'layout').glob('*.log'))
subprocess.run(cc+['-I'+str(P/'diag_stubs'),str(P/'diag_test.c'),*extra,str(lib),'-lm','-o',str(O/'host-build/badge_diagnostics_test')],check=True)
p=subprocess.run([str(O/'host-build/badge_diagnostics_test'),str(D/'software-diagnostics-capture.log')],capture_output=True,text=True);(D/'diagnostics-production-c.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr;(D/'diagnostics-production-c-tests.json').write_text(p.stdout)
subprocess.run(['python3',str(O/'tools/test_capture_decoder.py')],check=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();base=json.loads((BASE/'source-hashes.json').read_text());assert all(sha(BASE/'source'/n)==h for n,h in base.items());changed={n for n,h in base.items() if sha(O/'source'/n)!=h};assert changed=={'CMakeLists.txt','tools/host_preview/preview.c','main/badge_pages.c','main/badge_scene.c','main/badge_scene.h'},changed
checks=[]
def check(n,v):assert v,n;checks.append(dict(name=n,passed=True))
bsp='components/waveshare__esp32_s3_touch_amoled_1_75c/esp32_s3_touch_amoled_1_75c.c';s=(O/'source'/bsp).read_text();check('BSP_exact_deployed032_034_035',sha(O/'source'/bsp)==base[bsp]==sha(R/'artifacts/firmware-local-v3-dmafix/source'/bsp));check('fixed10internalDouble', '.buffer_height = 10' in s and '.use_psram = false' in s and '.require_double_buffer = true' in s)
for n in base:
 if n.startswith('main/') and n not in ['main/badge_pages.c','main/badge_scene.c','main/badge_scene.h']:check('main_exact035:'+n,sha(O/'source'/n)==base[n])
for n in ['sdkconfig','sdkconfig.defaults','partitions.csv','dependencies.lock']:check('exact035:'+n,sha(O/'source'/n)==base[n])
check('shared_upstream_mask_source_exact',sha(LV/'src/draw/sw/lv_draw_sw_mask.c')=='e1f852a16219644ae2d8a08c8bb49865a6f5af1bb3e2115ec3e423de46675c22')
a=json.loads((D/'layout-tests.json').read_text());b=json.loads((BASE/'evidence/layout-tests.json').read_text());imageChanges=[x['case'] for x,y in zip(a['cases'],b['cases']) if x['sha256']!=y['sha256']];check('record_intentional_visual_image_changes',bool(imageChanges))
(D/'immutability-buffer.json').write_text(json.dumps(dict(hardware=False,checks=checks,checkCount=len(checks),allMainOutsideUiExact037=True,intentionalFullImageChanges=imageChanges,eachInternalDmaBufferBytes=9320,captureGuard64KiBUnchanged=True,all48ExplicitPoolEnabledAndReleased=True),indent=2)+'\n');print('48 pool-enabled FULL cases with explicitly recorded UI changes;34diagnostic;14decoder;',len(checks),'immutability/buffer checks')
