#!/usr/bin/env python3
"""Authorized data-preserving upgrade; package metadata only, no app launch or UI."""
from pathlib import Path
from datetime import datetime,timezone
import json,subprocess,sys,re,hashlib
batch=Path(__file__).resolve().parent
adb='/Users/zoumutou/coding/猫咪森活/.tools/android-sdk/platform-tools/adb'
serial='ZYPZ261A01M65K0002A';package='com.catforest.htmlcandidate'
build=json.loads((batch/'build-result.json').read_text());apk=batch/build['file']
if build.get('buildExitCode')!=0 or hashlib.sha256(apk.read_bytes()).hexdigest()!=build['sha256']:
    raise SystemExit('Build artifact is not the signed package recorded for this batch.')
record={'startedAtUtc':datetime.now(timezone.utc).isoformat(),'serial':serial,'packageId':package,'method':'adb install --no-incremental -r','installed':False,'appLaunched':False,'dataCleared':False,'uninstalled':False,'commands':[]}
def run(args,log):
    result=subprocess.run([adb,'-s',serial,*args],text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    (batch/log).write_text(result.stdout)
    record['commands'].append({'command':['adb','-s',serial,*args],'exitCode':result.returncode,'log':log})
    (batch/'install-result.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
    print(log,'exit',result.returncode,flush=True)
    if result.returncode:sys.exit(result.returncode)
    return result.stdout
run(['get-state'],'phone-connection.log')
model=run(['shell','getprop','ro.product.model'],'phone-model.log').strip()
manufacturer=run(['shell','getprop','ro.product.manufacturer'],'phone-manufacturer.log').strip()
if model!='PZ261A' or manufacturer.lower()!='stepx':raise SystemExit('Device identity differs from authorized StepX PZ261A.')
def identity(text):
    value={}
    for key,pattern in [('versionCode',r'\bversionCode=(\d+)'),('versionName',r'\bversionName=([^\s]+)'),('appId',r'\b(?:appId|userId)=(\d+)'),('firstInstallTime',r'\bfirstInstallTime=([^\n\r]+)')]:
        match=re.search(pattern,text)
        if match:value[key]=int(match[1]) if key in ['versionCode','appId'] else match[1].strip()
    return value
before=run(['shell','dumpsys','package',package],'phone-before.log');record['before']=identity(before)
if record['before'].get('versionCode')!=33 or record['before'].get('versionName')!='0.4.2-touch-town':
    raise SystemExit('Installed version has changed from 042/code33; stopping to preserve concurrent work.')
result=run(['install','--no-incremental','-r',str(apk)],'phone-install.log')
if 'Success' not in result:raise SystemExit('ADB did not confirm Success.')
record.update(installed=True,installExitCode=0,manufacturer=manufacturer,model=model)
after=run(['shell','dumpsys','package',package],'phone-after.log');record['after']=identity(after)
record['metadataMatchesBuiltVersion']=record['after'].get('versionCode')==34 and record['after'].get('versionName')==build['versionName']
record['sameAppId']=record['before'].get('appId')==record['after'].get('appId')
record['sameFirstInstallTime']=record['before'].get('firstInstallTime')==record['after'].get('firstInstallTime')
record['finishedAtUtc']=datetime.now(timezone.utc).isoformat()
(batch/'install-result.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:record[k] for k in ['installed','installExitCode','before','after','sameAppId','sameFirstInstallTime','metadataMatchesBuiltVersion']},ensure_ascii=False))
if not all(record[k] for k in ['metadataMatchesBuiltVersion','sameAppId','sameFirstInstallTime']):sys.exit(2)
