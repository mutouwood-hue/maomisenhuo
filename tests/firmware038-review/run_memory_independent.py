from pathlib import Path
import subprocess,json,os,hashlib
R=Path(__file__).resolve().parents[2];T=Path(__file__).resolve().parent
rows=[]
for variant in ['037','r3']:
 R=Path(__file__).resolve().parents[2];T=Path(__file__).resolve().parent;S=R/'artifacts/firmware-local-v3-visual038/source';P=S/'tools/host_preview';SS=T/('source-r3' if variant=='r3' else 'source-037');LV=R/'firmware/managed_components/lvgl__lvgl';H=R/'artifacts/firmware-local-v3-perf034/host-build';OB=H/'CMakeFiles/badge_host_preview.dir';PORT=R/'tests/firmware036-review'
 cmd=['clang','-O2','-g','-std=gnu11','-UNDEBUG','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE','-DCATFOREST_MASK_POOL_HOST_TEST=1',f'-DLV_CONF_PATH="{P}/lv_conf.h"',f'-DPREVIEW_SOURCE="{SS}/preview.c"',f'-DBADGE_PAGES_SOURCE="{SS}/badge_pages.c"',*[f'-I{x}' for x in [SS,P/'stubs',S/'main',LV,P,H/'lvgl',LV/'src/draw/sw']],str(T/'memory_fixture.c'),str(T/'tracked_core.c'),str(SS/'badge_scene.c'),str(S/'private/lvgl_mask_pool/lv_draw_sw_mask.c'),str(PORT/'pool_port.c'),str(next(OB.rglob('badge_gesture.c.o'))),str(OB/'diag_stubs.c.o'),*[str(p) for p in OB.rglob('assets/*.c.o')],str(H/'lvgl/lib/liblvgl.a'),'-lm','-o',str(T/('memory-'+variant))]

 p=subprocess.run(cmd,capture_output=True,text=True,timeout=45);(T/f'review-{variant}-build.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr

 p=subprocess.run([str(T/('memory-'+variant))],capture_output=True,text=True,timeout=30)
 (T/f'memory-independent-{variant}.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr
 rows.append({'variant':variant,'records':[l for l in p.stdout.splitlines() if l.startswith('MEM ') or l.startswith('CAPTURE_PARTITION_DIFFERENCE ')]});print(variant,rows[-1]['records'])
(T/'memory-independent-report.json').write_text(json.dumps({'softwareOnly':True,'host64RequestedClibAllocations':True,'fixtureCopiedUnmodifiedFromWorker':True,'notIndependentTestDesign':True,'sourceR3IndependentRerun':True,'excludesAllocatorMetadataDirectCallocAndPool':True,'cases':rows},indent=2)+'\n')
