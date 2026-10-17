#!/usr/bin/env python3
"""Read frozen files/ZIP/APK only. No implementation tests/build/device/network."""
from pathlib import Path
import hashlib,json,zipfile,re,subprocess
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent;BASE=ROOT/'artifacts/html-offline-candidate';N=BASE/'ui025';O=BASE/'ui024'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
n=json.loads((N/'manifest.json').read_text());oh=json.loads((O/'source-hashes.json').read_text());nh=json.loads((N/'source-hashes.json').read_text());errors=[]
for ver,h in [(N,nh),(O,oh)]:
 for p,v in h.items():
  if sha(ver/'source'/p)!=v:errors.append('frozen source mismatch '+str(ver.name)+'/'+p)
assert len(nh)==155 and len(oh)==153
changed=[p for p in oh if oh[p]!=nh.get(p)];added=[p for p in nh if p not in oh]
delta=json.loads((N/'evidence/ui-delta.json').read_text());declared={x['path'] for x in delta['changed']}
if set(changed+added)!=declared:errors.append('delta inventory differs '+str(set(changed+added)^declared))
protected=n['unchangedFrom024']['protectedPaths']+['android/app/src/main/AndroidManifest.xml']
for p in protected:
 if (N/'source'/p).read_bytes()!=(O/'source'/p).read_bytes():errors.append('protected bytes changed '+p)
for key in ['apk','sourceArchive']:
 p=N/n[key]['path']
 if sha(p)!=n[key]['sha256'] or p.stat().st_size!=n[key]['bytes']:errors.append(key+' hash/size')
 with zipfile.ZipFile(p) as z:
  if key=='sourceArchive':
   if len(z.infolist())!=155:errors.append('ZIP count')
   for i in z.infolist():
    if not i.filename.startswith('source/') or '..' in Path(i.filename).parts:errors.append('unsafe ZIP entry '+i.filename);continue
    rel=i.filename[len('source/'):]
    if rel not in nh or hashlib.sha256(z.read(i)).hexdigest()!=nh[rel]:errors.append('ZIP bytes '+rel)
  else:
   assetnames=[i for i in z.namelist() if i.startswith('assets/') and not i.endswith('/')];assets={str(p.relative_to(N/'source/android/app/src/main/assets')) for p in (N/'source/android/app/src/main/assets').iterdir() if p.is_file()}
   if {x[len('assets/'):] for x in assetnames}!=assets:errors.append('APK assets entry set')
   for i in assetnames:
    if z.read(i)!=(N/'source/android/app/src/main/assets'/i[len('assets/'):]).read_bytes():errors.append('APK asset bytes '+i)
   apk_asset_count=len(assetnames)
pages=json.loads((N/'evidence/pages/production-page-css.json').read_text());checks=[c for r in pages['reports'] for c in r['tests']];controls=[c for r in pages['reports'] for c in r['controls']]
for r in pages['reports']:
 for f in r['metadata']['css']:
  if sha(N/'source/web'/f['file'])!=f['sha256']:errors.append('page CSS metadata '+f['file'])
 if r['metadata']['decorationSha256']!=sha(N/'source/web/offline-page-icons.js'):errors.append('page decorator metadata')
 if not r['pass'] or any(not c['pass'] for c in r['tests']):errors.append('page evidence failure')
 if any(c['bounds']['height']<48 or c['scrollWidth']>c['clientWidth']+1 for c in r['controls']):errors.append('control measured size/width')
key=json.loads((N/'evidence/key/production-css-input.json').read_text())
if key['metadata']['inputSha256']!=sha(N/'source/web/offline-meet-key.js') or key['metadata']['inlineIndexSha256']!=sha(N/'source/android/app/src/main/assets/index.html'):errors.append('key evidence hash')
key_checks=len(key['tests'])
node=(N/'evidence/cflocal2/node-tests.tap').read_text();summary={k:int(re.search(r'^# '+k+r' (\d+)$',node,re.M).group(1)) for k in ['tests','pass','fail','skipped']}
java=ROOT/'.tools/java/jdk-21.0.12.1+1/Contents/Home/bin/java';sdk=ROOT/'.tools/android-sdk/build-tools/35.0.0';apk=N/n['apk']['path']
commands=[('signature',[str(java),'-jar',str(sdk/'lib/apksigner.jar'),'verify','--verbose','--print-certs',str(apk)]),('alignment',[str(sdk/'zipalign'),'-c','-v','4',str(apk)]),('badging',[str(sdk/'aapt2'),'dump','badging',str(apk)])]
results={}
for label,cmd in commands:
 r=subprocess.run(cmd,capture_output=True,text=True,timeout=30);(HERE/(label+'.log')).write_text(r.stdout+r.stderr);results[label]={'exitCode':r.returncode,'command':cmd}
 if r.returncode:errors.append(label+' failed')
 if label=='signature':
  cert=re.search(r'certificate SHA-256 digest: (\w+)',r.stdout).group(1);results[label]['certSha256']=cert
  if cert!=n['certificateSha256']:errors.append('certificate mismatch')
 if label=='badging':
  results[label]['package']=r.stdout.splitlines()[0]
  if "name='com.catforest.htmlcandidate' versionCode='16' versionName='0.2.5-html-local'" not in r.stdout:errors.append('package/version mismatch')
report={'kind':'readonly_frozen_delta_audit_no_implementation_test_rerun_or_device','errors':errors,'source025Count':len(nh),'source024Count':len(oh),'source024AllStillFrozen':True,'changedPriorPaths':changed,'newPaths':added,'protectedByteEqualCount':len(protected),'protectedByteEqualPaths':protected,'apkAssetsExactCount':apk_asset_count,'sourceZipExactCount':155,'apk':n['apk'],'sourceArchive':n['sourceArchive'],'certificate':n['certificateSha256'],'verificationCommands':results,'ownerNodeEvidenceSummary':summary,'ownerPageEvidence':{'profiles':len(pages['reports']),'checks':len(checks),'controlsMeasured':len(controls),'minimumNormalContrast':min(c['ratio'] for c in controls),'minimumDisabledContrast':min(c['disabledRatio'] for c in controls)},'ownerKeyChecks':key_checks,'sourceSha256':nh,'manifestSha256':sha(N/'manifest.json'),'readEndSourceStable':all(sha(N/'source'/p)==h for p,h in nh.items())}
(HERE/'readonly-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['errors','source025Count','source024Count','protectedByteEqualCount','apkAssetsExactCount','sourceZipExactCount','ownerNodeEvidenceSummary','ownerPageEvidence','ownerKeyChecks','readEndSourceStable']},ensure_ascii=False,indent=2));raise SystemExit(bool(errors))
