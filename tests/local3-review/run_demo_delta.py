#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,difflib,subprocess
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent;FW=ROOT/'artifacts/firmware-local-v3/source';T=FW/'tools/host_preview';P=ROOT/'artifacts/firmware-local-v3/preview'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
old=ROOT/'artifacts/firmware-local-v3/docs/prior-pages-b4f1cddb.c';new=FW/'main/badge_pages.c'
assert sha(old)=='b4f1cddbc289f6119373fae7ca80696180ba6c06965784cf8e4cd9e0d74fe99d'
assert sha(new)=='ea578da18502e72aa4a2aab0a22065523b3c69b51fbb7eb82a776a1050732e17'
a=old.read_text().splitlines();b=new.read_text().splitlines();changes=[(i+1,x,y) for i,(x,y) in enumerate(zip(a,b)) if x!=y];assert len(a)==len(b) and len(changes)==1
assert 'guide_index==3' in changes[0][1] and 'guide_index==3' in changes[0][2]
m=json.loads((P/'verified-ui-v3/manifest.json').read_text());prior=json.loads((HERE/'accepted-manifest-b4f1.json').read_text());sources=m['source_sha256'];assert all(sha(ROOT/p)==h for p,h in sources.items())
product_changed=[p for p,h in sources.items() if '/source/main/' in p and p in prior['source_sha256'] and h!=prior['source_sha256'][p]];assert product_changed==[str(new.relative_to(ROOT))]
added_product_tracking=[p for p in sources if '/source/main/' in p and p not in prior['source_sha256']];assert added_product_tracking==['artifacts/firmware-local-v3/source/main/badge_gesture.h']
initial=json.loads((HERE/'read-start.json').read_text());assert sources[added_product_tracking[0]]==initial[added_product_tracking[0]]['sha256']
oldimgs={x['case']:x['png_sha256'] for x in prior['cases']};assert len(m['cases'])==76
for c in m['cases']:assert sha(P/'verified-ui-v3'/c['png'])==c['png_sha256']==oldimgs[c['case']]
owner=json.loads((P/'demo-measure-harness-fix/guide-demo-report.json').read_text());assert owner['passed'] and owner['assertions']==243 and owner['productPagesSha256']==sha(new) and owner['harnessSha256']==sha(T/'preview.c')
objects=list((T/'build-v3/CMakeFiles/badge_host_preview.dir').rglob('*.o'));objects=[p for p in objects if p.name!='preview.c.o'];assert len(objects)>=14
lib=T/'build-v3/lvgl/lib/liblvgl.a'
tracked=[ROOT/p for p in sources]+objects+[lib,HERE/'demo_delta_runner.c',Path(__file__),old,P/'verified-ui-v3/manifest.json',P/'demo-measure-harness-fix/guide-demo-report.json'];before={str(p.relative_to(ROOT)):sha(p) for p in tracked}
cmd=['clang','-std=gnu11','-O1','-Wall','-Wextra','-UNDEBUG','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE','-DLV_CONF_PATH="'+str(T/'lv_conf.h')+'"','-I',str(T/'stubs'),'-I',str(FW/'main'),'-I',str(ROOT/'firmware/managed_components/lvgl__lvgl'),'-I',str(T),'-I',str(T/'build-v3/lvgl'),str(HERE/'demo_delta_runner.c')]+[str(p) for p in objects]+[str(lib),'-lm','-o',str(HERE/'demo-delta-runner')]
c=subprocess.run(cmd,capture_output=True,text=True);(HERE/'demo-delta-compile.log').write_text(c.stdout+c.stderr);report={'kind':'necessary_single_line_delta_host_review','compileCommand':cmd,'compileExit':c.returncode,'warnings':c.stderr,'sourceSha256':before,'singleProductChangedLine':changes[0],'productChangedFiles':product_changed,'newlyTrackedUnchangedHeader':added_product_tracking,'all76PngMatchPriorB4f1':True,'owner243EvidenceReadOnlyVerified':True,'limits':['Only this demo delta independently executed; historical1873 results remain associated with b4f1','Reuses existing frozen scene/gesture/asset objects and LVGL library, all hashes recorded','Host BSP/domain/pointer doubles, no device or RF or audio']}
if c.returncode==0:
 r=subprocess.run([str(HERE/'demo-delta-runner')],capture_output=True,text=True,timeout=30);(HERE/'demo-delta-run.log').write_text(r.stdout+r.stderr);report['exitCode']=r.returncode
 try:report['independentResult']=json.loads(r.stdout)
 except Exception:report['error']=r.stdout+r.stderr
report['sourceStable']=all(sha(ROOT/p)==h for p,h in before.items());(HERE/'demo-delta-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:report.get(k) for k in ['compileExit','warnings','exitCode','independentResult','sourceStable']},ensure_ascii=False,indent=2));raise SystemExit(0 if c.returncode==0 and report.get('exitCode')==0 and report['sourceStable'] else 1)
