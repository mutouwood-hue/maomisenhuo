from pathlib import Path
import subprocess,importlib.util,json
R=Path.cwd();O=R/'artifacts/firmware-local-v3-visual038';T=R/'tests/firmware038-worker';S=O/'source';P=S/'tools/host_preview';H=R/'artifacts/firmware-local-v3-perf034/host-build';LV=R/'firmware/managed_components/lvgl__lvgl';OB=H/'CMakeFiles/badge_host_preview.dir';D=O/'evidence/world';D.mkdir(parents=True,exist_ok=True)
cc=['cc','-O3','-std=gnu11','-UNDEBUG','-DCATFOREST_MASK_POOL_HOST_TEST=1','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE',f'-DLV_CONF_PATH="{P}/lv_conf.h"',*['-I'+str(p) for p in [P/'stubs',S/'main',LV,P,H/'lvgl',LV/'src/draw/sw']]]
extra=[str(S/'main/badge_scene.c'),str(S/'private/lvgl_mask_pool/lv_draw_sw_mask.c'),str(T/'pool_port.c'),str(T/'pool_exit_proof.c'),str(next(OB.rglob('badge_gesture.c.o'))),str(OB/'diag_stubs.c.o'),*[str(p) for p in OB.rglob('assets/*.c.o')],str(H/'lvgl/lib/liblvgl.a'),'-lm']
exe=T/'world-matrix';p=subprocess.run(cc+[str(T/'world_matrix.c'),*extra,'-o',str(exe)],capture_output=True,text=True);(D/'build.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr
sp=importlib.util.spec_from_file_location('d',O/'tools/capture_decode.py');m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
records=[];D=O/'evidence/world-matrix-r3';D.mkdir(exist_ok=True)
for w in range(4):
 for f in range(3):
  for v in range(2):
   for low in range(2):
    for power in range(4):
     name=f'world{w}-face{f}-clock{v}-low{low}-power{power}';stem=D/name
     p=subprocess.run([str(exe),str(w),str(f),str(v),str(low),str(power),str(stem)],capture_output=True,text=True,timeout=15);stem.with_suffix('.log').write_text(p.stdout+p.stderr);assert p.returncode==0,(name,p.stderr)
     rec=json.loads(stem.with_suffix('.json').read_text());rec['case']=name;records.append(rec);stem.with_suffix('.png').write_bytes(m.png(stem.with_suffix('.rgb565').read_bytes()))
(O/'evidence/world-matrix-r3.json').write_text(json.dumps(dict(hardware=False,allProductionPagesLvgl=True,caseCount=len(records),checks=sum(x['checks'] for x in records),allActualLabelsNoMissingGlyph=True,records=records,limits=['Software clock/input/power/domain/PSRAM ports are substitutes','OFF captures are logical layouts with physical brightness0','Not hardware touch/FPS/tear-free proof']),ensure_ascii=False,indent=2)+'\n');print('World matrix',len(records),'cases pass')
