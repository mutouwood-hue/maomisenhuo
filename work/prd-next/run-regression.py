from pathlib import Path
import subprocess,json,os,zipfile
root=Path(__file__).parent
source=root/'phone/source'
results=[]
logdir=root/'regression-logs';logdir.mkdir(exist_ok=True)
for file in sorted((source/'tests').glob('*.test.cjs')):
    log=logdir/(file.stem+'.log')
    with log.open('wb') as out:
        try:
            p=subprocess.run(['node','--test',str(file.resolve())],cwd=source,stdout=out,stderr=subprocess.STDOUT,timeout=25)
            status='pass' if p.returncode==0 else 'fail'
        except subprocess.TimeoutExpired:status='timeout'
    results.append({'test':file.name,'status':status,'log':str(log.relative_to(root))})
    print(file.name,status,flush=True)
(root/'regression-results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps({state:sum(r['status']==state for r in results) for state in ['pass','fail','timeout']}),flush=True)
