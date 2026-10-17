from pathlib import Path
import subprocess,json,os
R=Path(__file__).resolve().parents[2];T=Path(__file__).resolve().parent;S=R/'artifacts/firmware-local-v3-perf037/source';P=S/'tools/host_preview';H=R/'artifacts/firmware-local-v3-perf034/host-build';LV=R/'firmware/managed_components/lvgl__lvgl';OB=H/'CMakeFiles/badge_host_preview.dir'
cmd=['clang','-O3','-std=gnu11','-UNDEBUG','-DCATFOREST_MASK_POOL_HOST_TEST=1','-DEXPECT_FIXED=1',f'-DPREVIEW_SOURCE="{P}/preview.c"','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE',f'-DLV_CONF_PATH="{P}/lv_conf.h"',*[f'-I{x}' for x in [P/'stubs',S/'main',LV,P,H/'lvgl',LV/'src/draw/sw']],str(T/'independent_aod.c'),str(S/'main/badge_scene.c'),str(S/'private/lvgl_mask_pool/lv_draw_sw_mask.c'),str(T/'pool_port.c'),str(T/'pool_exit_proof.c'),str(next(OB.rglob('badge_gesture.c.o'))),str(OB/'diag_stubs.c.o'),*[str(p) for p in OB.rglob('assets/*.c.o')],str(H/'lvgl/lib/liblvgl.a'),'-lm','-o',str(T/'independent-aod')]
p=subprocess.run(cmd,capture_output=True,text=True,timeout=45);(T/'independent-build.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr;rows=[]
for face in range(3):
 for valid in range(2):
  p=subprocess.run([str(T/'independent-aod'),str(face),str(valid)],capture_output=True,text=True,timeout=30);(T/f'independent-face{face}-clock{valid}.log').write_text(p.stdout+p.stderr);assert p.returncode==0,(face,valid,p.stderr);rows.append({'face':face,'clockValid':valid,'exitCode':p.returncode,'output':p.stdout.strip()});print(p.stdout.strip())
(T/'independent-results.json').write_text(json.dumps({'hardware':False,'kind':'productionpages_memoryports','compileCommand':cmd,'cases':rows},indent=2)+'\n')
