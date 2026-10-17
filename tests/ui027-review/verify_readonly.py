from pathlib import Path
import json,hashlib,zipfile,subprocess,re
R=Path.cwd(); H=R/'tests/ui027-review'; N=R/'artifacts/html-offline-candidate/ui027'; O=N.parent/'ui026'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
f=json.loads((N/'FROZEN.json').read_text()); hs=json.loads((N/'source-hashes.json').read_text()); old=json.loads((O/'source-hashes.json').read_text()); errors=[]
assert len(hs)==180
for p,h in hs.items():
 if sha(N/'source'/p)!=h:errors.append('source '+p)
for key in ['apk','sourceArchive']:
 p=N/f[key]['path']; assert sha(p)==f[key]['sha256'] and p.stat().st_size==f[key]['bytes']
 with zipfile.ZipFile(p) as z:
  if key=='sourceArchive':
   assert len(z.infolist())==180
   for n in z.namelist():assert n.startswith('source/') and hashlib.sha256(z.read(n)).hexdigest()==hs[n[7:]]
  else:
   assets={p.name:p for p in (N/'source/android/app/src/main/assets').iterdir() if p.is_file()}
   aa=[n for n in z.namelist() if n.startswith('assets/') and not n.endswith('/')];assert len(aa)==len(assets)==40
   for n in aa:assert z.read(n)==assets[n[7:]].read_bytes()
java=R/'.tools/java/jdk-21.0.12.1+1/Contents/Home/bin/java';sdk=R/'.tools/android-sdk/build-tools/35.0.0';apk=N/f['apk']['path'];cmds={
'signature':[str(java),'-jar',str(sdk/'lib/apksigner.jar'),'verify','--verbose','--print-certs',str(apk)],
'alignment':[str(sdk/'zipalign'),'-c','-v','4',str(apk)],
'badging':[str(sdk/'aapt2'),'dump','badging',str(apk)],
'compiled-manifest':[str(sdk/'aapt2'),'dump','xmltree',str(apk),'--file','AndroidManifest.xml']}
for k,c in cmds.items():
 p=subprocess.run(c,capture_output=True,text=True,timeout=40);(H/(k+'.log')).write_text(p.stdout+p.stderr);assert p.returncode==0,(k,p.stderr)
sig=(H/'signature.log').read_text();assert f['certificateSha256'] in sig
bad=(H/'badging.log').read_text();assert "name='com.catforest.worlddemo' versionCode='18'" in bad and "launchable-activity: name='com.catforest.htmlcandidate.WorldDemoActivity'" in bad;assert 'uses-permission' not in bad
compiled=(H/'compiled-manifest.log').read_text();assert 'uses-permission' not in compiled and 'sharedUserId' not in compiled and 'MainActivity' not in compiled
changed=[p for p,h in old.items() if hs.get(p)!=h]; protected=[p for p in old if ('/java/' in p or any(k in p for k in ['adapter.js','transport.js','offline-durable-store','offline-device-events','offline-event-store','offline-care-runtime','offline-device-backup','offline-scene-map','offline-scene-sync']))]
for p in protected:assert hs.get(p)==old[p],p
report={'scope':'read-only independent source/package audit; no Android/device action','errors':errors,'sourceFiles':len(hs),'archiveExact':180,'apkAssetExact':40,'apk':f['apk'],'sourceArchive':f['sourceArchive'],'certificateSha256':f['certificateSha256'],'changedPriorPaths':changed,'protectedExact':protected,'addedPaths':[p for p in hs if p not in old],'compiledManifestNoPermissions':True,'readEndSourceStable':all(sha(N/'source'/p)==h for p,h in hs.items()),'pins':{str(p.relative_to(R)):sha(p) for p in [N/'FROZEN.json',N/'manifest.json',N/'source-hashes.json',*[N/'source'/p for p in hs]]}}
(H/'readonly-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['pins','addedPaths','changedPriorPaths','protectedExact']},ensure_ascii=False));assert not errors
