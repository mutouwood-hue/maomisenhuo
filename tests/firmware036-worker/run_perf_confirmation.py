from pathlib import Path
import subprocess,json,os,re,statistics
R=Path.cwd();T=R/'tests/firmware036-worker';O=R/'artifacts/firmware-local-v3-perf036';D=O/'evidence/perf-confirmation';D.mkdir(exist_ok=True)
variants={'baseline':('baseline035','enabled'),'nonEspFallback':('default-fallback','enabled'),'pool':('explicit-pool','enabled'),'allocFailFallback':('explicit-pool','alloc-fail')}
def run(name,stem):
 exe,mode=variants[name];p=subprocess.run([str(T/('perf-'+exe))],capture_output=True,text=True,env=dict(os.environ,CF_POOL_MODE=mode),check=True,timeout=30);(D/(stem+'.log')).write_text(p.stdout+p.stderr);return {k:int(v) for k,v in re.findall(r'(\w+)=(\d+)',p.stdout)}
for name in variants:run(name,'warmup-'+name)
orders=[['baseline','pool','nonEspFallback','allocFailFallback'],['allocFailFallback','nonEspFallback','pool','baseline'],['pool','baseline','allocFailFallback','nonEspFallback'],['nonEspFallback','pool','baseline','allocFailFallback'],['baseline','allocFailFallback','nonEspFallback','pool']];records=[]
for i,order in enumerate(orders):
 results={n:run(n,f'trial{i}-{n}') for n in order};records.append(dict(order=order,results=results));print(i,{k:v['wallUs'] for k,v in results.items()})
summary={name:dict(medianUs=statistics.median(r['results'][name]['wallUs'] for r in records),minUs=min(r['results'][name]['wallUs'] for r in records),maxUs=max(r['results'][name]['wallUs'] for r in records),medianPairRatioVsBaseline=statistics.median(r['results'][name]['wallUs']/r['results']['baseline']['wallUs'] for r in records)) for name in variants}
assert all(r['results'][name]['flushes']==r['results']['baseline']['flushes'] and r['results'][name]['pixels']==r['results']['baseline']['pixels'] for r in records for name in variants)
(D/'confirmation.json').write_text(json.dumps(dict(hardware=False,warmupEachVariantOnce=True,noBuildDuringThisRunner=True,trials=5,records=records,summary=summary,allFlushPixelsExactBaseline=True,limits=['Other system load not controlled; host ratios only','RAM simulates externalPSRAM capability, not latency','No physicaltouch/scanout/FPS claim']),indent=2)+'\n');print(json.dumps(summary,indent=2))
