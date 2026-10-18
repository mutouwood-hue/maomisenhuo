#!/usr/bin/env python3
"""Source/package/signing metadata only. Never executes app or tests."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,zipfile,subprocess,os,re,difflib
root=Path(__file__).resolve().parents[1];candidate=root.parent;prior=candidate.parent/'ui037';evidence=candidate/'evidence'
workspace=next(p for p in root.parents if(p/'.tools').is_dir());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
build=json.loads((evidence/'android-build.json').read_text());apk=candidate/build['apk']
if build['exitCode']!=0:raise SystemExit('Build incomplete')
env=os.environ.copy();env['JAVA_HOME']=str(workspace/'.tools/java/jdk-21.0.12.1+1/Contents/Home')
sig=subprocess.run([str(workspace/'.tools/android-sdk/build-tools/35.0.0/apksigner'),'verify','--print-certs',str(apk)],env=env,capture_output=True,text=True)
(evidence/'package-signature.txt').write_text(sig.stdout+sig.stderr)
if sig.returncode:raise SystemExit('Signing metadata unavailable')
cert=re.search(r'certificate SHA-256 digest: ([0-9a-f]+)',sig.stdout).group(1)
if cert!='3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82':raise SystemExit('Upgrade signing identity differs')
excluded={'.build','.gradle','__pycache__','build','node_modules','preview','.DS_Store','local.properties'}
files=sorted(p for p in root.rglob('*')if p.is_file()and not(set(p.relative_to(root).parts)&excluded)and p.suffix not in{'.keystore','.jks','.pyc'})
hashes={str(p.relative_to(root)):sha(p)for p in files};(candidate/'source-hashes.json').write_text(json.dumps(hashes,ensure_ascii=False,indent=2)+'\n')
old=json.loads((prior/'source-hashes.json').read_text());changes=[];patch=[]
for name in sorted(set(old)|set(hashes)):
 if old.get(name)==hashes.get(name):continue
 generated=name.startswith('android/app/src/main/assets/');changes.append({'path':name,'oldSha256':old.get(name),'newSha256':hashes.get(name),'generated':generated})
 if not generated:
  try:a=(prior/'source'/name).read_text().splitlines(True)if name in old else[];b=(root/name).read_text().splitlines(True)if name in hashes else[]
  except UnicodeError:continue
  patch.extend(difflib.unified_diff(a,b,fromfile='037/source/'+name,tofile='038/source/'+name))
(evidence/'source-delta-037.patch').write_text(''.join(patch));(evidence/'source-delta-037.json').write_text(json.dumps({'against':'037/ffdabe74','changed':changes},ensure_ascii=False,indent=2)+'\n')
archive=candidate/'deliverables/catforest-little-moments-0.3.8-source.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED)as z:
 for p in files:z.write(p,'source/'+str(p.relative_to(root)))
record={
 'atUtc':datetime.now(timezone.utc).isoformat(),
 'status':'frozen_ordinary_compile_only_user_acceptance_pending',
 'packageId':'com.catforest.htmlcandidate','versionName':'0.3.8-little-moments','versionCode':29,
 'apk':{'path':str(apk.relative_to(candidate)),'bytes':apk.stat().st_size,'sha256':sha(apk)},
 'sourceArchive':{'path':str(archive.relative_to(candidate)),'bytes':archive.stat().st_size,'files':len(files),'sha256':sha(archive)},
 'certificateSha256':cert,'sourceHashes':'source-hashes.json','delta':'evidence/source-delta-037.patch',
 'baseline':'037 / user confirmed bridge crossing, two-device connection and manual ring drag',
 'requiredFirmware':'Existing050/051 care_receipt_v1 / scene_places_v1 / resume_v1; no protocol change',
 'contract':{'path':'source/contracts/2026-10-17-local-care-scenes.md','sha256':sha(root/'contracts/2026-10-17-local-care-scenes.md')},
 'scope':[
  'Finite scene-only resident/player contact: approach12s, choose8s, action4s, overall20s cap; NPC contact0.9s',
  'Unified exit releases holds/cards/membership; same pair10s cooldown and spatial separation required; player destination immediately cancels contact',
  'Scatter paths use original roads, building/river guards and swept occupancy; original037 bridge lease/traffic policy retained',
  'Future presentation uses actual local Date, never demo fixNow: exact approved title/bubble/card, pale dashed now-to-selection arcs and selected dot',
  'Solid ring bands and record markers capped at actual now; future never borrows past/planned event; empty past and inferred/demo records remain distinct',
  'Reuse original daily cat in gentle look-around animation; single owned visible animation, cleanup on past/current/tab/background/pagehide',
  'Arched bridge picking uses actual deck mesh before original graph/lease; neutral persistent navigation guide and three-second factual invalid-tap messages',
  'No new growth/events/rewards, no clock/day/save/Native/adapter/BLE/AI changes'
 ],
 'validation':{'ordinaryOfflineCompile':'evidence/android-build.json','signatureMetadata':'evidence/package-signature.txt','testsRun':False,'technicalTestsRun':False,'lintRun':False,'runtimePreviewRun':False,'deviceActions':False,'paidApiCalls':False,'secretsRead':False,'acceptance':'Compilation/package only. Parent coordinates sole device owner A; no install request issued by this thread.'},
 'remaining':[
  'Actual contact endings/separation, future wording/art/drag and navigation messages await normal user use; compilation is not runtime or visual acceptance',
  'No technical tests, execution validation, runtime previews, performance experiments or device actions',
  'Library libfile_5a6c9708401481918a85c2447769cfba unavailable through exposed read/materialize tools; no image inspection claim',
  'Existing037 care/Native/reconnect/AI/protocol behavior inherited unchanged, not revalidated',
  '037 baseline remains frozen; parent schedules any preserve-data installation; no uninstall/clear-data/rebinding'
 ]}

for name in ['manifest.json','FROZEN.json']:(candidate/name).write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:record[k]for k in ['status','apk','sourceArchive','certificateSha256']},ensure_ascii=False))
