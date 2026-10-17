from pathlib import Path
import subprocess,json,importlib.util,hashlib
R=Path.cwd();T=R/'tests/firmware037-worker';O=R/'artifacts/firmware-local-v3-perf037';H=R/'artifacts/firmware-local-v3-perf034/host-build';LV=R/'firmware/managed_components/lvgl__lvgl';OB=H/'CMakeFiles/badge_host_preview.dir';D=O/'evidence/aod-matrix';D.mkdir(parents=True,exist_ok=True)
sp=importlib.util.spec_from_file_location('decode',O/'tools/capture_decode.py');m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
records={}
for version,fixed in [('036',0),('037',1)]:
 S=R/('artifacts/firmware-local-v3-perf'+version)/'source';P=S/'tools/host_preview';exe=T/('aod-'+version)
 cmd=['cc','-O3','-std=gnu11','-UNDEBUG','-DCATFOREST_MASK_POOL_HOST_TEST=1',f'-DEXPECT_FIXED={fixed}',f'-DPREVIEW_SOURCE="{P}/preview.c"','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE',f'-DLV_CONF_PATH="{P}/lv_conf.h"',*['-I'+str(p) for p in [P/'stubs',S/'main',LV,P,H/'lvgl',LV/'src/draw/sw']],str(T/'aod_matrix.c'),str(S/'main/badge_scene.c'),str(S/'private/lvgl_mask_pool/lv_draw_sw_mask.c'),str(T/'pool_port.c'),str(T/'pool_exit_proof.c'),str(next(OB.rglob('badge_gesture.c.o'))),str(OB/'diag_stubs.c.o'),*[str(p) for p in OB.rglob('assets/*.c.o')],str(H/'lvgl/lib/liblvgl.a'),'-lm','-o',str(exe)]
 q=subprocess.run(cmd,capture_output=True,text=True);(D/(version+'-build.log')).write_text(q.stdout+q.stderr);assert q.returncode==0,q.stderr
 for valid in range(2):
  for face in range(3):
   for mode in range(4):
    for low in range(2):
     key=f'{version}-clock{valid}-face{face}-mode{mode}-low{low}';stem=D/key;p=subprocess.run([str(exe),str(valid),str(face),str(mode),str(low),str(stem)],capture_output=True,text=True,timeout=30);stem.with_suffix('.log').write_text(p.stdout+p.stderr);assert p.returncode==0,(key,p.stderr)
     assert 'POOL_PROOF explicit-capability alloc=1 release=1' in p.stderr+p.stdout
     rec=json.loads(stem.with_suffix('.json').read_text());raw=stem.with_suffix('.rgb565').read_bytes();rec['sha256']=hashlib.sha256(raw).hexdigest();records[key]=rec;stem.with_suffix('.png').write_bytes(m.png(raw))
changes=[]
for key,v in records.items():
 if key.startswith('037'):
  base=records['036'+key[3:]];different=v['sha256']!=base['sha256'];assert different==(v['mode']>=2 and (v['face']>0 or not v['low'])),key
  if different:changes.append(key)
assert sum(r['negativeOverlapReproductions'] for k,r in records.items() if k.startswith('036'))>0
summary=dict(hardware=False,caseCountPerVersion=48,totalCases=len(records),checks=sum(x['checks'] for x in records.values()),allPass=True,explicitPoolAllocationRelease=True,negative036OverlapReproduced=True,allAwakeAndCompanionFramesExact036=True,intentionalStandbyChanges=changes,syntheticProductionWakeNoDomainWrites=True,records=records,limits=['Actual production source with memory-only clock/domain/brightness/input ports','Fixed fixture time20:34 is not a fresh hardware clock reading','OFF images are software compositions; physical panel would have zero brightness','Painted wake text corners checked against round screen; transparent250px label container not claimed contained','No actual PSRAM latency/heap, physical touch, scanout, tearing or FPS proof'])
(O/'evidence/aod-matrix.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print('AOD matrix',len(records),'cases',summary['checks'],'checks pass; negative036 confirmed')
