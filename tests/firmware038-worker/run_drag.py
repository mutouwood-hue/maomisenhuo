from pathlib import Path
import subprocess,re,json
R=Path.cwd();O=R/'artifacts/firmware-local-v3-visual038';T=R/'tests/firmware038-worker';H=R/'artifacts/firmware-local-v3-perf034/host-build';LV=R/'firmware/managed_components/lvgl__lvgl';OB=H/'CMakeFiles/badge_host_preview.dir';records={}
for tag in ['037','038','038-legacy-slide']:
 S=R/('artifacts/firmware-local-v3-perf037/source' if tag=='037' else 'artifacts/firmware-local-v3-visual038/source');P=S/'tools/host_preview';exe=T/('drag-'+tag)
 cmd=['cc','-O3','-std=gnu11','-UNDEBUG','-DCATFOREST_MASK_POOL_HOST_TEST=1',f'-DPREVIEW_SOURCE="{P}/preview.c"','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE',f'-DLV_CONF_PATH="{P}/lv_conf.h"',*['-I'+str(p) for p in [P/'stubs',S/'main',LV,P,H/'lvgl',LV/'src/draw/sw']],str(T/'drag_fixture.c'),str(S/'main/badge_scene.c'),str(S/'private/lvgl_mask_pool/lv_draw_sw_mask.c'),str(T/'pool_port.c'),str(T/'pool_exit_proof.c'),str(next(OB.rglob('badge_gesture.c.o'))),str(OB/'diag_stubs.c.o'),*[str(p) for p in OB.rglob('assets/*.c.o')],str(H/'lvgl/lib/liblvgl.a'),'-lm','-o',str(exe)]
 if tag=='038-legacy-slide':
  legacy=T/'legacy_slide_pages.c';legacy.write_text((S/'main/badge_pages.c').read_text().replace('.bounded_face=face_target && observed_action!=L2_ACTION_SLEEP','.bounded_face=false'));cmd.insert(1,f'-DBADGE_PAGES_SOURCE="{legacy}"')
 p=subprocess.run(cmd,capture_output=True,text=True);assert p.returncode==0,p.stderr
 p=subprocess.run([str(exe)],capture_output=True,text=True);(O/'evidence'/('drag-'+tag+'.log')).write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr;records[tag]=[dict(case=c,flushes=int(f),pixels=int(px)) for c,f,px in re.findall(r'METRIC (\S+) (\d+) (\d+)',p.stdout)]
ratios={c:sum(x['pixels'] for x in records['038'] if x['case']==c)/sum(x['pixels'] for x in records['037'] if x['case']==c) for c in ['horizontal-commit','horizontal-rebound']}
negativeRatios={c:sum(x['pixels'] for x in records['038'] if x['case']==c)/sum(x['pixels'] for x in records['038-legacy-slide'] if x['case']==c) for c in ratios};
(O/'evidence/drag-dirty-comparison.json').write_text(json.dumps(dict(hardware=False,originalProductionGestureSyntheticCoordinates=True,privatePoolEnabledBoth=True,sameLogicalTrace=True,records=records,pixelRatios=ratios,same038LegacySlideNegativeRatios=negativeRatios,limits=['New backgrounds/HUD intentionally differ, not pixel equality against037','Render/flush software bytes, not actual SPI/wait/scanout/FPS','All original animation ticks retained; no static-pose-only gesture']),indent=2)+'\n');print(records,ratios)
