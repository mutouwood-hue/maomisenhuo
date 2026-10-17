#!/usr/bin/env python3
"""Frozen v3 independent checks; compile only here, no target/GUI/device actions."""
from pathlib import Path
import json,hashlib,subprocess,sys,math,re
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
FW=ROOT/'artifacts/firmware-local-v3/source';TOOLS=FW/'tools/host_preview';CAP=ROOT/'artifacts/firmware-local-v3/preview/accepted-ui-v3'
manifest=json.loads((CAP/'manifest.json').read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
expected='b4f1cddbc289f6119373fae7ca80696180ba6c06965784cf8e4cd9e0d74fe99d'
assert sha(FW/'main/badge_pages.c')==expected,'source not frozen version'
assert all(sha(ROOT/p)==h for p,h in manifest['source_sha256'].items()),'accepted manifest source hash mismatch'
images=[];errors=[]
for c in manifest['cases']:
 p=CAP/c['png'];images.append({'case':c['case'],'sha256':sha(p),'matches':sha(p)==c['png_sha256']})
 if sha(p)!=c['png_sha256']:errors.append(c['case']+' image hash')
 # Independently recalculate complete geometry, not trusting manifest pass booleans.
 for t in c['hit_targets']:
  if t['shape']==2:continue
  x,y=t['center'];w,h=t['size'];radius=math.hypot(x-233,y-233)+w if t['shape']==1 else max(math.hypot(px-233,py-233) for px in [x-w//2,x+w//2] for py in [y-h//2,y+h//2])
  if radius>212:errors.append(c['case']+' target '+t['name'])
 if not c['motion_in_progress']:
  for t in c['labels']:
   if not t['text']:continue
   x1,y1,x2,y2=t['bounds']
   if max(math.hypot(x-233,y-233) for x in [x1,x2] for y in [y1,y2])>212:errors.append(c['case']+' label '+t['text'])
 if c['missing_glyph_count']:errors.append(c['case']+' glyph')
# Source-to-handler inventory: direct enum refs + TOUCH0+i dynamic range.
s=(FW/'main/badge_pages.c').read_text();header=(FW/'main/badge_ui_targets.h').read_text();enum=header[header.index('typedef enum'):header.index('HIT_COUNT')];ids=re.findall(r'\bHIT_[A-Z0-9_]+',enum)
body=s[s.index('static bool target_hit'):];inventory=[]
for name in ids:
 lines=[i+1 for i,line in enumerate(s.splitlines()) if name in line and i+1>464]
 kind='unavailable' if name=='HIT_RESET_UNAVAILABLE' else 'dynamic TOUCH0+i' if name in ['HIT_TOUCH1','HIT_TOUCH2','HIT_TOUCH3','HIT_TOUCH4'] else 'direct actual-handler enum reference'
 inventory.append({'id':name,'evidence':kind,'lines':lines})
 if not lines and kind=='direct actual-handler enum reference':errors.append('unrouted '+name)
asset_names=['local2_fonts','badge_f16','badge_f20','badge_f24','badge_n40','cat_idle','cat_paw','game_assets','game_idle','game_pet','game_walk','game_attention']
lib=TOOLS/'build-v3/lvgl/lib/liblvgl.a'
inputs=list(manifest['source_sha256'])+['tests/local3-review/independent_runner.c',str(lib.relative_to(ROOT))]
before={p:sha(ROOT/p) for p in inputs}
cmd=['clang','-std=gnu11','-O1','-Wall','-Wextra','-UNDEBUG','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE','-DLV_CONF_PATH="'+str(TOOLS/'lv_conf.h')+'"','-I',str(TOOLS/'stubs'),'-I',str(FW/'main'),'-I',str(ROOT/'firmware/managed_components/lvgl__lvgl'),'-I',str(TOOLS),'-I',str(TOOLS/'build-v3/lvgl'),str(HERE/'independent_runner.c'),str(FW/'main/badge_scene.c'),str(FW/'main/badge_gesture.c')]+[str(FW/'main/assets'/(n+'.c')) for n in asset_names]+[str(lib),'-lm','-o',str(HERE/'independent-runner')]
build=subprocess.run(cmd,capture_output=True,text=True);(HERE/'independent-compile.log').write_text(build.stdout+build.stderr)
report={'kind':'independent_host_v3_UI_not_hardware','compileCommand':cmd,'compileReturncode':build.returncode,'compileOutput':build.stderr,'sourceSha256':before,'ownerManifestSha256':sha(CAP/'manifest.json'),'ownerFramesAudited':len(images),'ownerImageHashes':images,'manifestAuditErrors':errors,'handlerInventory':inventory,'limits':['Read-only prebuilt LVGL static library reused; pages,scene,gesture and font/sprite sources compiled here','Owner fixture BSP/domain/peer/NVS and pointer feed helpers reused, owner main and 424 assertions not called','No real storage/core/BLE/audio/physical panel or device test']}
results=[]
if build.returncode==0:
 for case in ['modal_sleep','modal_play','modal_drag','toast_text_input','guide_actual','guide_persistence','drag_boundaries','classifier','clock_empty','registry_geometry']:
  r=subprocess.run([str(HERE/'independent-runner'),case],capture_output=True,text=True,timeout=30);(HERE/(case+'.log')).write_text(r.stdout+r.stderr)
  try:data=json.loads(r.stdout.strip().splitlines()[-1])
  except Exception:data={'case':case,'status':'failed','output':r.stdout+r.stderr}
  data['exitCode']=r.returncode;results.append(data)
  if r.returncode:break
report.update(cases=results,passed=sum(x['exitCode']==0 for x in results),failed=sum(x['exitCode']!=0 for x in results),independentChecks=sum(x.get('independentChecks',0) for x in results),sourceStable=all(sha(ROOT/p)==h for p,h in before.items()))
(HERE/'independent-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['compileReturncode','ownerFramesAudited','manifestAuditErrors','passed','failed','independentChecks','sourceStable']},ensure_ascii=False,indent=2))
if results and results[-1]['exitCode']:print(json.dumps(results[-1],ensure_ascii=False,indent=2))
sys.exit(0 if build.returncode==0 and len(results)==10 and not report['failed'] and not errors and report['sourceStable'] else 1)
