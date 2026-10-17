#!/usr/bin/env python3
"""Offline directed verification; writes only in this review directory. No Git/device/network/build/cleanup."""
from pathlib import Path
import subprocess,json,hashlib,re
from datetime import datetime,timezone
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1];C=ROOT/'artifacts/html-offline-candidate/ui026'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest=json.loads((C/'manifest.json').read_text());frozen=json.loads((C/'FROZEN.json').read_text());source=json.loads((C/'source-hashes.json').read_text())
assert frozen['apk']==manifest['apk'] and frozen['sourceArchive']==manifest['sourceArchive']
assert manifest['apk']['sha256']=='a780c0e48b9c2ac2c149e761171a6eb6e9098aee84507be5f6409a9527144ab8'
assert manifest['sourceArchive']['sha256']=='c422abdcf2fbad3c48c2ce966bf2da9e7b18c2cee6e7ab2bf0c5b70715549abd'
assert all(sha(C/'source'/p)==h for p,h in source.items())
commands=[('package-readonly',['python3',str(HERE/'verify_readonly.py')]),('owner-runtime-isolated-rerun',['node','--test','--test-concurrency=1',str(HERE/'runtime-rerun.test.cjs')]),('independent-runtime',['node','--test','--test-concurrency=1',str(HERE/'independent-runtime.test.cjs')])]
results=[]
for name,cmd in commands:
 r=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True,timeout=45);(HERE/(name+'.log')).write_text(r.stdout+r.stderr)
 result={'name':name,'command':cmd,'exitCode':r.returncode,'log':name+'.log'}
 for key in ['tests','pass','fail','skipped']:
  m=re.search(r'^# '+key+r' (\d+)$',r.stdout,re.M)
  if m:result[key]=int(m.group(1))
 results.append(result);assert r.returncode==0,(name,r.stdout,r.stderr)
assert all(sha(C/'source'/p)==h for p,h in source.items())
report={'atUtc':datetime.now(timezone.utc).isoformat(),'decision':'release_for_sole_integrator_preserve_data_install_and_controlled_actual_acceptance','noConfirmedP1P2InReviewedDelta':True,'scope':'frozen026 original same-session care runtime, owned write freeze, consumer defer and backup lease; not hardware feeding acceptance','apk':manifest['apk'],'sourceArchive':manifest['sourceArchive'],'certificate':manifest['certificateSha256'],'runtimeSourceHashes':manifest['runtime'],'manifestSha256':sha(C/'manifest.json'),'frozenSha256':sha(C/'FROZEN.json'),'sourceHashesSha256':sha(C/'source-hashes.json'),'source159StableBeforeAfter':True,'commands':results,'independentlyExecutedProductionDirectedCases':22,'ownerFull298NotIndependentlyRerun':True,'fixtureBoundary':'Original production vu, source/consumer, backup mount, Native JS client; explicit memory RPC/GATT ports/time. No Java/fsync/radio/device/physical-care evidence.','originalCooldownPersistence':'RAM only, original process recreation clears timestamps; durable receipt duplicates do not reseed them.','remaining':['Root fresh preserve-data install and APK readback/storage comparison','Real physical bowl three-tap feeding remains pending, empty FIFO is not a new-care pass','No new physical clock/gesture/FPS/tearfree/powerloss/bilateral gift proof','Standard Gradle lint incomplete offline; standalone lint evidence only; actual system1.6font not newly tested','Inherited schedule work pill text after recall remains outside026']}
(HERE/'decision.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'decision':report['decision'],'directedCases':22,'commands':results,'sourceStable':True},ensure_ascii=False,indent=2))
