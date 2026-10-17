from pathlib import Path
import subprocess,json,os,hashlib
R=Path(__file__).resolve().parents[2];T=Path(__file__).resolve().parent
rows=[]
for variant in ['r3','legacy']:
 R=Path(__file__).resolve().parents[2];T=Path(__file__).resolve().parent;S=R/'artifacts/firmware-local-v3-visual038/source';P=S/'tools/host_preview';SS=T/('source-r3' if variant=='r3' else 'source-r3-legacy');LV=R/'firmware/managed_components/lvgl__lvgl';H=R/'artifacts/firmware-local-v3-perf034/host-build';OB=H/'CMakeFiles/badge_host_preview.dir';PORT=R/'tests/firmware036-review'
 cmd=['clang','-O2','-g','-std=gnu11','-UNDEBUG','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE','-DCATFOREST_MASK_POOL_HOST_TEST=1',f'-DLV_CONF_PATH="{P}/lv_conf.h"',f'-DPREVIEW_SOURCE="{SS}/preview.c"',f'-DBADGE_PAGES_SOURCE="{SS}/badge_pages.c"',*[f'-I{x}' for x in [SS,P/'stubs',S/'main',LV,P,H/'lvgl',LV/'src/draw/sw']],str(T/'review_fixture.c'),str(SS/'badge_scene.c'),str(S/'private/lvgl_mask_pool/lv_draw_sw_mask.c'),str(PORT/'pool_port.c'),str(next(OB.rglob('badge_gesture.c.o'))),str(OB/'diag_stubs.c.o'),*[str(p) for p in OB.rglob('assets/*.c.o')],str(H/'lvgl/lib/liblvgl.a'),'-lm','-o',str(T/('review-'+variant))]

 p=subprocess.run(cmd,capture_output=True,text=True,timeout=45);(T/f'review-{variant}-build.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr
 for case in ['horizontal-commit','horizontal-rebound','vertical-up','vertical-down','samecontext','trust','sleep','sleep-fail']:
  p=subprocess.run([str(T/('review-'+variant)),case],capture_output=True,text=True,timeout=25)
  (T/f'review-{variant}-{case}.log').write_text(p.stdout+p.stderr)
  frames=[l.split() for l in p.stdout.splitlines() if l.startswith('FRAME ')]
  metrics=[l for l in p.stdout.splitlines() if l.startswith('METRIC ')]
  rows.append({'variant':variant,'case':case,'exit':p.returncode,'frames':len(frames),'ticks':[int(x[2]) for x in frames],'metrics':metrics,'outputSha256':hashlib.sha256(p.stdout.encode()).hexdigest()})
  print(variant,case,p.returncode,metrics,flush=True)
  assert p.returncode==0,p.stdout[-2000:]+p.stderr[-2000:]
(T/'logical-trace-report.json').write_text(json.dumps({'softwareOnly':True,'production':'source-r3','negative':'source-r3-legacy; only bounded_face=false','cases':rows},indent=2)+'\n')
