from pathlib import Path
import hashlib,json,subprocess
R=Path(__file__).resolve().parents[2];O=Path(__file__).resolve().parent;B=R/'artifacts/firmware-local-v4-encounter039/evidence/wire-window-r2';src=(B/'local2_peer.c').read_text()
def extract(start):
 a=src.index(start);b=src.index('{',a);depth=1;i=b+1
 while depth:
  if src[i]=='{':depth+=1
  elif src[i]=='}':depth-=1
  i+=1
 return src[a:i]
parts=[extract('void local2_peer_confirm(void)'),extract('void local2_peer_poll(uint32_t now)')]
(O/'pinned-platform-functions.inc').write_text('\n\n'.join(parts)+'\n')
command=['clang','-std=c11','-Wall','-Wextra','-I',str(B),'-I',str(R/'artifacts/firmware-local-v4-encounter039/tests/stubs'),str(O/'stale_consent_fixture.c'),str(B/'local2_core.c'),'-o',str(O/'stale-consent-r2')]
p=subprocess.run(command,text=True,capture_output=True,timeout=30);(O/'stale-consent-build.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr
rows=[]
for case in ['still-connected','disconnect-before-poll','new-peer-before-poll']:
 p=subprocess.run([str(O/'stale-consent-r2'),case],capture_output=True,text=True,timeout=10);assert p.returncode==0,p.stderr;row=json.loads(p.stdout);rows.append(row);print(row)
assert rows[0]['durableConsent'] and rows[1]['durableConsent'] and rows[2]['durableConsent']
(O/'stale-consent-r2-negative.json').write_text(json.dumps({'virtual_fixture':True,'actualCoreAndPureFSM':True,'actualPlatformFunctionsVerbatim':['local2_peer_confirm','local2_peer_poll'],'mocked':['FreeRTOS queue','store mutex','NimBLE conn globals','transport_poll','clock','RNG'],'productionPeerSha256':hashlib.sha256(src.encode()).hexdigest(),'extractedFunctionsSha256':hashlib.sha256((O/'pinned-platform-functions.inc').read_bytes()).hexdigest(),'compile':command,'cases':rows},indent=2)+'\n')
