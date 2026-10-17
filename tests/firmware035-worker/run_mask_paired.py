from pathlib import Path
import subprocess,re,json,statistics
T=Path('tests/firmware035-worker');out=T/'mask-workingset-paired';out.mkdir(exist_ok=True);runs=[]
orders=[[4,12,16],[16,12,4],[12,4,16],[16,4,12],[4,16,12]];base_trace=None
for i,order in enumerate(orders):
 trial={}
 for slots in order:
  p=subprocess.run([str(T/'mask-workingset-recheck'/f'cache{slots}')],capture_output=True,text=True,check=True);(out/f'trial{i}-cache{slots}.log').write_text(p.stdout+p.stderr);v={k:int(v) for k,v in re.findall(r'(\w+)=(\d+)',p.stdout)};trace=re.findall(r'TRACE (\d+) (\w+)',p.stdout)
  if base_trace is None:base_trace=trace
  assert trace==base_trace
  trial[slots]=v
 runs.append(dict(order=order,measurements=trial,ratio12vs4=trial[12]['wallUs']/trial[4]['wallUs'],ratio16vs4=trial[16]['wallUs']/trial[4]['wallUs']))
 print(i,{k:v['wallUs'] for k,v in trial.items()})
summary={str(n):dict(medianUs=statistics.median(r['measurements'][n]['wallUs'] for r in runs),minUs=min(r['measurements'][n]['wallUs'] for r in runs),maxUs=max(r['measurements'][n]['wallUs'] for r in runs)) for n in [4,12,16]}
report=dict(hardware=False,orderedPairedTrials=5,runs=runs,summary=summary,medianPairRatio12vs4=statistics.median(r['ratio12vs4'] for r in runs),medianPairRatio16vs4=statistics.median(r['ratio16vs4'] for r in runs),allContinuous40EndFrameHashesExact=True,limits=['Mac scheduling/background variability present; not a formal statistical test','No QSPI/PSRAM/physical input or scanout','Mask-only host copy, not a production patch','Do not infer per-ESP FPS or68ms reduction from this ratio'])
(out/'paired.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(summary,indent=2));print(report['medianPairRatio12vs4'],report['medianPairRatio16vs4'])
