#!/usr/bin/env python3
"""Production asset/APK packaging only; no tests, lint, UI or device interaction."""
from pathlib import Path
import hashlib,json,os,shutil,subprocess,sys
from datetime import datetime,timezone
batch=Path(__file__).resolve().parent
root=batch.parents[2]
toolchain=Path('/Users/zoumutou/coding/猫咪森活/.tools')
java=toolchain/'java/jdk-21.0.12.1+1/Contents/Home'
sdk=toolchain/'android-sdk'
env=os.environ.copy()
env.update(JAVA_HOME=str(java),ANDROID_HOME=str(sdk),ANDROID_SDK_ROOT=str(sdk),GRADLE_USER_HOME=str(toolchain/'gradle-home'),ANDROID_USER_HOME=str(root/'app/.build/android-user'),CATFOREST_TOWN_EVIDENCE_DIR=str(batch))
env['PATH']=str(java/'bin')+os.pathsep+env.get('PATH','')
record={'startedAtUtc':datetime.now(timezone.utc).isoformat(),'sourceRoot':str(root),'sourceBaseline':'b8ca479ee4dd99eab0c5fb8bc6404d9827851748','versionName':'0.4.5-sticky-guide','versionCode':36,'technicalTestsExecuted':False,'lintExecuted':False,'browserQAExecuted':False,'simulatedInteractionExecuted':False,'commands':[]}
def run(command,log,cwd=root):
    with (batch/log).open('w') as f:
        result=subprocess.run(command,cwd=cwd,env=env,stdout=f,stderr=subprocess.STDOUT)
    record['commands'].append({'command':list(map(str,command)),'log':log,'exitCode':result.returncode})
    (batch/'build-result.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
    print(log, 'exit',result.returncode,flush=True)
    if result.returncode:sys.exit(result.returncode)
    return (batch/log).read_text()
run([sys.executable,'app/scripts/build_assets.py'],'assets-build.log')
run([str(toolchain/'gradle-8.9/bin/gradle'),'--offline','--no-daemon','--console=plain',':app:assembleDebug','-x','test','-x','lint'],'phone-build.log',root/'app/android')
apk=batch/'catforest-0.4.5-sticky-guide-debug.apk'
shutil.copy2(root/'app/android/app/build/outputs/apk/debug/app-debug.apk',apk)
sig=run([str(sdk/'build-tools/35.0.0/apksigner'),'verify','--print-certs',str(apk)],'phone-signature.log')
expected='3408671bfff5d9b12886b90465f474ad5ecd630784b2945e955d4c152051ad82'
if 'Signer #1 certificate SHA-256 digest: '+expected not in sig:
    raise SystemExit('Original public certificate did not match; installation stopped.')
meta=run([str(sdk/'build-tools/35.0.0/aapt'),'dump','badging',str(apk)],'phone-package.log')
if "package: name='com.catforest.htmlcandidate' versionCode='36' versionName='0.4.5-sticky-guide'" not in meta or "application-label:'猫咪森活'" not in meta:
    raise SystemExit('Package/version/label identity mismatch; installation stopped.')
record.update(file=apk.name,bytes=apk.stat().st_size,sha256=hashlib.sha256(apk.read_bytes()).hexdigest(),packageId='com.catforest.htmlcandidate',applicationLabel='猫咪森活',publicCertificateSha256=expected,buildType='debug',buildExitCode=0,finishedAtUtc=datetime.now(timezone.utc).isoformat())
(batch/'build-result.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:record[k] for k in ['file','bytes','sha256','versionName','versionCode','buildExitCode']},ensure_ascii=False))
