from pathlib import Path
import json,subprocess,os
T=Path(__file__).resolve().parent
prior=json.loads((T/'independent-lifecycle.json').read_text());cmd=prior['compileCommand'];p=subprocess.run(cmd,capture_output=True,text=True,timeout=45);(T/'independent-compile.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr
report={'kind':'host_capability_fixture_actual_private_c','compileCommand':cmd,'cases':[]}
for name in ['shared','saturated','pool-first']:
 p=subprocess.run([str(T/'independent-lifecycle'),name],capture_output=True,text=True,env=dict(os.environ,CF_POOL_MODE='enabled',ASAN_OPTIONS='detect_leaks=0'),timeout=30);(T/(name+'.log')).write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr;report['cases'].append({'name':name,'returncode':p.returncode,'output':p.stdout.strip()});print(p.stdout.strip())
(T/'independent-lifecycle.json').write_text(json.dumps(report,indent=2)+'\n')
