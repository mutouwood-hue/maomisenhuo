from pathlib import Path
import json,hashlib,zipfile,difflib
root=Path(__file__).resolve().parent
sha=lambda value:hashlib.sha256(value).hexdigest()
norm=lambda value:value.replace(b'\r\n',b'\n')
files={
'phone':['scripts/build_assets.py','scripts/prd_experience_patches.py','web/life-navigation.js','web/life-companion.css','web/clinic-feedback.inc.js','web/life-summary.inc.js','web/offline-device-backup.js','web/offline-event-store.js','web/offline-durable-store.js','android/app/src/main/java/com/catforest/htmlcandidate/EventDurableBridge.java','tests/life-navigation-focused.test.cjs','tests/life-navigation-focused-notes.md','tests/prd-experience.test.cjs','tests/memorial-backup-focused.test.cjs','tests/native-canonical-focused.test.cjs','tests/life-summary-focused.test.cjs','tests/native-durable.test.cjs','tests/native-durable/DurableRpcHarness.java','docs/memorial-backup-implementation.md'],
'badge':['main/badge_day_ui.inc','tests/host_day_draw/run.py','tests/host_day_draw/test_day_draw.c','tests/host_day_draw/README.md','main/badge_pages.c','main/badge_gesture.c','main/badge_gesture.h','tests/host_live_drag/run.py','tests/host_live_drag/test_live_drag.c','tests/host_live_drag/README.md']}
archives={'phone':root.parent.parent/'artifacts/html-offline-candidate/ui038/deliverables/catforest-little-moments-0.3.8-source.zip','badge':root.parent.parent/'artifacts/firmware-visual-delivery053/deliverables/cat-forest-badge-0.5.3-day-startup-source.zip'}
output=root/'deliverables';output.mkdir(exist_ok=True)
records=[]
archive=output/'prd-nonconnection-increment-v2.zip'
assert not archive.exists(),'Refuse to overwrite existing increment'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as package:
 for target,paths in files.items():
  with zipfile.ZipFile(archives[target]) as baseline:
   for relative in paths:
    full=root/target/'source'/relative;current=full.read_bytes();entry='source/'+relative
    old=baseline.read(entry) if entry in baseline.namelist() else None
    if old is not None and norm(old)==norm(current):continue
    destination=target+'/'+relative
    package.writestr('payload/'+destination,current)
    patch=''.join(difflib.unified_diff(norm(old or b'').decode('utf-8').splitlines(keepends=True),norm(current).decode('utf-8').splitlines(keepends=True),fromfile='a/'+destination,tofile='b/'+destination))
    package.writestr('patches/'+destination+'.patch',patch)
    records.append({'path':destination,'status':'added' if old is None else 'modified','baseSha256':sha(old) if old else None,'baseLfSha256':sha(norm(old)) if old else None,'newSha256':sha(current),'newLfSha256':sha(norm(current))})
 manifest={'schema':1,'automaticApply':False,'bases':{name:{'archive':p.name,'sha256':sha(p.read_bytes())} for name,p in archives.items()},'files':records,'excluded':['generated assets','original HTML','APK/bin','local.properties','dependencies/node_modules','lock-clean-fix','BLE consumers/drivers']}
 text=json.dumps(manifest,ensure_ascii=False,indent=2)
 package.writestr('manifest.json',text)
 for doc in ['IMPLEMENTATION.md','REMAINING-HANDOFF.md','REGRESSION-CLASSIFICATION.md','CONTINUATION-RESULT.md']:
  package.write(root/doc,'notes/'+doc)
  for evidence in (root/'continuation-evidence').glob('*'):
   if evidence.is_file():package.write(evidence,'evidence/'+evidence.name)
  package.write(root/'dependency-boundary.json','evidence/dependency-boundary.json')
(output/'increment-manifest-v2.json').write_text(text,encoding='utf-8')
with zipfile.ZipFile(archive) as package:
 assert package.testzip() is None
 for record in records:assert sha(package.read('payload/'+record['path']))==record['newSha256']
print(json.dumps({'archive':str(archive),'sha256':sha(archive.read_bytes()),'files':len(records),'readbackVerified':True},ensure_ascii=False))
