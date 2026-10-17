from pathlib import Path
import subprocess,importlib.util,json
R=Path.cwd();O=R/'artifacts/firmware-local-v3-visual038';T=R/'tests/firmware038-worker';S=O/'source';P=S/'tools/host_preview';H=R/'artifacts/firmware-local-v3-perf034/host-build';LV=R/'firmware/managed_components/lvgl__lvgl';OB=H/'CMakeFiles/badge_host_preview.dir';D=O/'evidence/world';D.mkdir(parents=True,exist_ok=True)
cc=['cc','-O3','-std=gnu11','-UNDEBUG','-DCATFOREST_MASK_POOL_HOST_TEST=1','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE',f'-DLV_CONF_PATH="{P}/lv_conf.h"',*['-I'+str(p) for p in [P/'stubs',S/'main',LV,P,H/'lvgl',LV/'src/draw/sw']]]
extra=[str(S/'main/badge_scene.c'),str(S/'private/lvgl_mask_pool/lv_draw_sw_mask.c'),str(T/'pool_port.c'),str(T/'pool_exit_proof.c'),str(next(OB.rglob('badge_gesture.c.o'))),str(OB/'diag_stubs.c.o'),*[str(p) for p in OB.rglob('assets/*.c.o')],str(H/'lvgl/lib/liblvgl.a'),'-lm']
exe=T/'state-check';p=subprocess.run(cc+[str(T/'state_fixture.c'),*extra,'-o',str(exe)],capture_output=True,text=True);(D/'build.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr
sp=importlib.util.spec_from_file_location('d',O/'tools/capture_decode.py');m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
p=subprocess.run([str(exe)],capture_output=True,text=True,timeout=20);(O/'evidence/state-tests.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr;print(p.stdout)
