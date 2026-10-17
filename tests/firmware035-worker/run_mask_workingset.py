# Host-only sensitivity experiment. No firmware/config/shared library changes.
from pathlib import Path
import subprocess,json,re,hashlib
R=Path.cwd();T=R/'tests/firmware035-worker';O=R/'artifacts/firmware-local-v3-perf035';B=R/'artifacts/firmware-local-v3-perf034';P=O/'source/tools/host_preview';H=B/'host-build';LV=R/'firmware/managed_components/lvgl__lvgl';OB=H/'CMakeFiles/badge_host_preview.dir';C=T/'counters';out=T/'mask-workingset';out.mkdir(exist_ok=True)
# Exact instrumentation copies already contain counters, no geometry changes.
mask=(C/'mask.c').read_text();decoder=C/'decoder.c';s=(C/'counter_fixture.c').read_text();s=s.replace('iterations++;','iterations++;printf("TRACE %u %016llx\\n",j,(unsigned long long)pixel_hash(framebuffer,sizeof(framebuffer)));');fixture=out/'fixture.c';fixture.write_text(s)
cc=['cc','-O3','-std=gnu11','-UNDEBUG','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE',f'-DLV_CONF_PATH="{P}/lv_conf.h"','-I'+str(P/'stubs'),'-I'+str(O/'source/main'),'-I'+str(LV),'-I'+str(P),'-I'+str(H/'lvgl'),'-I'+str(LV/'src/draw/sw'),'-I'+str(LV/'src/libs/bin_decoder')]
assets=list(OB.rglob('assets/*.c.o'));gesture=next(OB.rglob('badge_gesture.c.o'));diag=OB/'diag_stubs.c.o';lib=H/'lvgl/lib/liblvgl.a';records={}
for slots in [4,8,12]:
 ms=mask.replace('#define _circle_cache                   LV_GLOBAL_DEFAULT()->sw_circle_cache',f'static lv_draw_sw_mask_radius_circle_dsc_t profile_circle_cache[{slots}];\n#define _circle_cache profile_circle_cache').replace('LV_DRAW_SW_CIRCLE_CACHE_SIZE',str(slots));m=out/f'mask{slots}.c';m.write_text(ms);exe=out/f'cache{slots}'
 cmd=cc+[f'-DBADGE_PAGES_SOURCE="{O}/source/main/badge_pages.c"',str(fixture),str(O/'source/main/badge_scene.c'),str(m),str(decoder),str(gesture),str(diag),*[str(p) for p in assets],str(lib),'-lm','-o',str(exe)]
 subprocess.run(cmd,check=True,capture_output=True);runs=[]
 for repeat in range(3):
  p=subprocess.run([str(exe)],capture_output=True,text=True);(out/f'cache{slots}-repeat{repeat}.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr
  trace={int(k):h for k,h in re.findall(r'TRACE (\d+) (\w+)',p.stdout)};runs.append(dict(counters={k:int(v) for k,v in re.findall(r'(\w+)=(\d+)',p.stdout)},radiusMissHistogram={int(k):int(v) for k,v in re.findall(r'RADIUS (\d+) (\d+)',p.stdout)},trace=trace))
 records[slots]=runs
 print(slots,[(r['counters']['wallUs'],r['counters']['radiusMisses']) for r in runs])
assert all(run['trace']==records[4][0]['trace'] for runs in records.values() for run in runs),'pixel trace changed'
report=dict(offline=True,hardware=False,productionSourceUnchanged=True,rendererMaskCopiesOnly=True,slotsCompared=[4,8,12],records=records,all40ContinuousEndOfGestureFrameHashesExactAcrossSlotsAndRepeats=True,configIsNotAProductionPatch=True,allocationFormula='radius*6+6 resident mask bytes, plus radius circle descriptor; temporary construction(radius+1)*16 bytes; global descriptor layout also changes if real config changed',allocationFailureLimit='This experiment did not inject OOM. Existing circ_calc_aa4 does not offer safe malloc failure fallback; increasing config alone is not approved. Any future implementation needs an allocation/budget gate and preserve original4 behavior when denied.',limits=['Mac software flush memcpy, not QSPI/DMA','Forty repeated synthetic production horizontal gestures include settle/feedback/poll, no actual touch','Count/CPU sensitivity does not attribute ESP68ms or prove physical FPS/tearing','Only end-of-gesture frame hashes; intermediate frame clipping requires further gate'])
(out/'workingset.json').write_text(json.dumps(report,indent=2)+'\n');print('All40gesture hashes exact, 3repeats each. No035 source changed.')
