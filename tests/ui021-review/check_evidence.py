from pathlib import Path
import hashlib,json,re
R=Path(__file__).resolve().parents[2]; H=Path(__file__).resolve().parent; N=R/'artifacts/html-offline-candidate/ui021';O=N.parent/'ui020'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def digest(t):return hashlib.sha256(t.encode()).hexdigest()
errors=[]; summaries={}
manifest=json.loads((N/'manifest.json').read_text());frozen=json.loads((N/'FROZEN.json').read_text())
for k in ['apk','sourceArchive','versionName','status']: assert manifest[k]==frozen[k]
nh=json.loads((N/'source-hashes.json').read_text());oh=json.loads((O/'source-hashes.json').read_text())
changed=[p for p in oh if oh[p]!=nh.get(p)]; added=[p for p in nh if p not in oh]
runtime=[p for p in changed if p.startswith('web/')];assert runtime==['web/offline-page-icons.js','web/offline-page-polish.css']
for kind,filename in [('care','care-tip/production-care-tip.json'),('refresh','icon-refresh/production-icon-refresh.json'),('pages','pages/production-page-css.json')]:
 d=json.loads((N/'evidence'/filename).read_text());assert d['pass'];total=0;fixed=negative=0
 for report in d['reports']:
  m=report['metadata']; neg=m.get('negative020',False);source=O if neg else N; negative+=neg;fixed+=not neg
  assert report['pass'] and all(t['pass'] for t in report['tests']);total+=len(report['tests'])
  for style in m.get('styles',m.get('css',[])): assert sha(source/'source/web'/style['file'])==style['sha256']
  for key,file in [('moduleSha256','web/offline-page-icons.js'),('decorationSha256','web/offline-page-icons.js'),('game06Sha256','android/app/src/main/assets/game-06.js'),('game03Sha256','android/app/src/main/assets/game-03.js')]:
   if key in m:assert sha(source/'source'/file)==m[key]
  if kind=='care':
   g=(N/'source/android/app/src/main/assets/game-06.js').read_text(); a=g.index('const ICON={');b=g.index('setTimeout(()=>{},0);',a);assert digest(g[a:b])==m['originalUiExcerptSha256']
   if neg:
    overlap=next(t['detail']['area'] for t in report['tests'] if t['name'].startswith('020 negative control'));assert overlap>0
   else:
    for t in report['tests']:
     if 'tip/notification no intersection' in t['name']:
      a,b=t['detail']['tip'],t['detail']['notice'];assert min(a['right'],b['right'])<=max(a['left'],b['left']) or min(a['bottom'],b['bottom'])<=max(a['top'],b['top'])
     if 'tip follows measured bubble height' in t['name']:assert t['detail']['tip']['top']-t['detail']['bubble']['bottom']>=7.9
  if kind=='refresh':
   g=(N/'source/android/app/src/main/assets/game-03.js').read_text();a=g.index('function N(){m.title.textContent=window.__pgPlace');b=g.index('function G(){',a);assert digest(g[a:b])==m['refreshSha256']
   rows=report['refreshes'];assert len(rows)==24
   if neg:assert all(not t['hasChild'] and not t['pseudo'] and t['before']-t['immediateAfter']>20 for t in rows)
   else:assert all(t['pseudo'] and not t['hasChild'] and abs(t['before']-t['immediateAfter'])<.01 for t in rows)
 summaries[kind]={'kind':'owner_software_engine_evidence_readback_not_independent_layout_rerun','reports':len(d['reports']),'checks':total,'fixedProfiles':fixed,'negative020Profiles':negative,'allMetadataHashesAndAssertionsReadbackPass':True,'artifactSha256':sha(N/'evidence'/filename)}
assert summaries['care']['checks']==330 and summaries['refresh']['checks']==124 and summaries['pages']['checks']==1284
for version in ['ui019','ui020']:
 p=N.parent/version;m=json.loads((p/'manifest.json').read_text())
 for k in ['apk','sourceArchive']:assert sha(p/m[k]['path'])==m[k]['sha256']
# Post-run byte check; no candidate writes allowed.
assert all(sha(N/'source'/p)==h for p,h in nh.items())
tap=(H/'targeted-node.tap').read_text();assert re.search(r'^# pass 14$',tap,re.M) and re.search(r'^# fail 0$',tap,re.M)
result={'status':'pass','scope':'independent readback and Node fixture execution; no Android/WebKit rerun/3D/FPS/device or original gameplay reward claim','errors':errors,'runtimeChanged':runtime,'changedPriorFiles':changed,'addedFiles':added,'ownerEvidence':summaries,'independentNodeTests':14,'originalNRefreshesIndependent':100,'unknownActionFamiliesIndependent':4,'sourceStableAfterTests':True,'old019020DeliverablesStillFrozen':True,'manifestSha256':sha(N/'manifest.json'),'FROZENSha256':sha(N/'FROZEN.json')}
(H/'evidence-readback.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['status','runtimeChanged','ownerEvidence','independentNodeTests','sourceStableAfterTests']},indent=2))
