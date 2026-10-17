"""Read-only current 037 source; all builds/traces are host-only in this audit dir."""
from pathlib import Path
import hashlib,json,subprocess,sys
ROOT=Path(__file__).resolve().parents[2]; HERE=Path(__file__).resolve().parent
MAIN=ROOT/'artifacts/firmware-local-v3-perf037/source/main'
INPUT=[MAIN/n for n in ['local2_peer.c','local2_core.c','local2_peer.h','local2_core.h','local2_wire.c']]
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
before={str(p.relative_to(ROOT)):digest(p) for p in INPUT}
results=[]
def compile_run(name,fixture,args=()):
    exe=HERE/name
    cmd=['cc','-std=c11','-Wall','-Wextra','-Werror','-I',str(MAIN),str(fixture),str(MAIN/'local2_peer.c'),str(MAIN/'local2_core.c'),'-o',str(exe)]
    c=subprocess.run(cmd,capture_output=True,text=True);(HERE/(name+'-compile.log')).write_text(c.stdout+c.stderr)
    assert c.returncode==0,c.stderr
    r=subprocess.run([str(exe),*args],capture_output=True,text=True)
    (HERE/(name+'.log')).write_text(r.stdout+r.stderr)
    results.append({'name':name,'compileCommand':cmd,'exitCode':r.returncode,'lines':r.stdout.splitlines(),'fixtureSha256':digest(fixture)})
    assert r.returncode==0,r.stderr
compile_run('peer-suite',ROOT/'tests/local2-peer/test_peer.c')
compile_run('reboot-after-complete',HERE/'reboot-after-complete.c')
# Existing exact production framing extractor: redirect only its source path in memory.
script=ROOT/'tests/local2-peer/test_transport.py'
code=script.read_text().replace("artifacts/firmware-local-v2/source/main/local2_peer.c","artifacts/firmware-local-v3-perf037/source/main/local2_peer.c")
(HERE/'transport-extractor-current.py').write_text(code)
# __file__ remains the original script so its repo-root resolution is unchanged.
r=subprocess.run([sys.executable,'-c',"exec(compile("+repr(code)+","+repr(str(script))+",'exec'),{'__file__':"+repr(str(script))+",'__name__':'__main__'})"],capture_output=True,text=True)
(HERE/'framing.log').write_text(r.stdout+r.stderr)
results.append({'name':'exact-production-framing','exitCode':r.returncode,'lines':r.stdout.splitlines(),'originalExtractorSha256':digest(script),'change':'only source path redirected to current037; actual C function extraction unchanged'})
assert r.returncode==0,r.stderr
virtual=ROOT/'tests/local2-peer/virtual_encounter.c'
exe=HERE/'virtual-encounter'
cmd=['cc','-std=c11','-Wall','-Wextra','-Werror','-I',str(MAIN),str(virtual),str(MAIN/'local2_peer.c'),str(MAIN/'local2_core.c'),'-o',str(exe)]
r=subprocess.run(cmd,capture_output=True,text=True);(HERE/'virtual-compile.log').write_text(r.stdout+r.stderr);assert r.returncode==0,r.stderr
scenarios=[]
for name in ['none','one-sided','loss','disconnect','persist-failure','restart-dedup','same-counter','pending-peer']:
    out=HERE/name;out.mkdir(exist_ok=True)
    r=subprocess.run([str(exe),name,str(out)],capture_output=True,text=True)
    (out/'trace.jsonl').write_text(r.stdout);(out/'stderr.log').write_text(r.stderr)
    assert r.returncode==0,r.stderr
    trace=[json.loads(line) for line in r.stdout.splitlines()]
    assert trace[-1]=={'kind':'verdict','fault':name,'passed':True}
    states={t['endpoint']:t for t in trace if t['kind']=='state' and t['reason']=='final'}
    events={t['endpoint']:t['events'] for t in trace if t['kind']=='events'}
    scenarios.append({'scenario':name,'exitCode':r.returncode,'finalStates':states,'events':events,'traceSha256':digest(out/'trace.jsonl'),'blobs':{p.name:{'bytes':p.stat().st_size,'sha256':digest(p)} for p in out.glob('*.bin')}})
stable=all(digest(ROOT/p)==h for p,h in before.items())
report={'hostOnly':True,'hardwareVerified':False,'scope':'actual current037 peer/core C + memory atomic blob, queued virtual radio and simulated explicit consent; production framing helper extraction, not ESP/NVS/NimBLE/radio/physical UI','inputSha256':before,'sourceStable':stable,'tests':results,'virtualCompileCommand':cmd,'virtualFixtureSha256':digest(virtual),'scenarios':scenarios}
(HERE/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
assert stable
print(json.dumps({'hostOnly':True,'sourceStable':stable,'peerPassGroups':len(results[0]['lines']),'rebootPassGroups':len(results[1]['lines']),'framingPassGroups':len(results[2]['lines']),'virtualScenariosPassed':len(scenarios)},indent=2))
