from pathlib import Path
import hashlib,json,subprocess
R=Path(__file__).resolve().parents[2];O=Path(__file__).resolve().parent;S=R/"artifacts/firmware-local-v4-encounter040";B=S/"evidence/wire-window-r1";src=(B/"local2_peer.c").read_text()
command=['clang','-std=c11','-Wall','-Wextra','-fsanitize=address,undefined','-g','-I',str(B),'-I',str(S/'tests/stubs'),str(O/'stale_consent_fixture_040.c'),str(B/'local2_core.c'),'-o',str(O/'stale-consent-040')]
p=subprocess.run(command,text=True,capture_output=True,timeout=30);(O/'stale-consent-040-build.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr
rows=[]
for case in ['still-connected','disconnect-before-poll','new-peer-before-poll','same-peer-new-generation']:
 p=subprocess.run([str(O/'stale-consent-040'),case],capture_output=True,text=True,timeout=10);assert p.returncode==0,p.stderr;row=json.loads(p.stdout);rows.append(row);print(row)
assert rows[0]['durableConsent'] and rows[0]['persistDelta']==1 and all(not x['durableConsent'] and x['persistDelta']==0 for x in rows[1:])
(O/'stale-consent-independent-040.json').write_text(json.dumps({'virtual_fixture':True,'actualCoreAndPureFSM':True,'actualPlatformFunctionsVerbatim':['local2_peer_confirm','sync_machine_link','confirm_matches','publish_view','local2_peer_poll'],'mocked':['FreeRTOS queue','store mutex','NimBLE conn globals','transport_poll','clock','RNG'],'productionPeerSha256':hashlib.sha256(src.encode()).hexdigest(),'extractedFunctionsSha256':hashlib.sha256((O/'pinned-platform-functions-040.inc').read_bytes()).hexdigest(),'compile':command,'cases':rows},indent=2)+'\n')
