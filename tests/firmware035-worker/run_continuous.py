exec((__import__('pathlib').Path('tests/firmware035-worker/run_bench.py')).read_text().split('results={}')[0])
import os,array,shutil
out={};dirs={}
for name,S in [('baseline034',B),('candidate035',O)]:
    exe=T/(name+'-continuous');raw=T/(name+'-raw');raw.mkdir(exist_ok=True);dirs[name]=raw
    inc=S/'source/main';cmd=[('-I'+str(inc)) if x=='-I'+str(O/'source/main') else x for x in cc]+['-DBENCH_CONTINUOUS=1',f'-DBADGE_PAGES_SOURCE="{inc}/badge_pages.c"',str(T/'bench.c'),str(inc/'badge_scene.c'),str(gesture),str(diag),*[str(p) for p in assets],str(lib),'-lm','-o',str(exe)]
    subprocess.run(cmd,check=True,capture_output=True);p=subprocess.run([str(exe)],env=dict(os.environ,BENCH_RAW_DIR=str(raw)),capture_output=True,text=True);(D/(name+'-continuous.log')).write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr
    out[name]=dict(metrics=[l for l in p.stdout.splitlines() if l.startswith('METRIC')],samples={l.split()[1]:l.split()[2] for l in p.stdout.splitlines() if l.startswith('SAMPLE')})
diffs={}
for k,h in out['baseline034']['samples'].items():
    if h==out['candidate035']['samples'][k]:continue
    a=array.array('H');a.frombytes((dirs['baseline034']/(k+'.rgb565')).read_bytes());b=array.array('H');b.frombytes((dirs['candidate035']/(k+'.rgb565')).read_bytes());dev=[[i,a[i],b[i]] for i in range(len(a)) if a[i]!=b[i]];ch=lambda n:((n>>11)&31,(n>>5)&63,n&31);ids=[v[0] for v in dev]
    diffs[k]=dict(pixels=len(dev),bounds=[min(i%466 for i in ids),min(i//466 for i in ids),max(i%466 for i in ids),max(i//466 for i in ids)],maxRgb565ChannelDelta=[max(abs(ch(v[1])[c]-ch(v[2])[c]) for v in dev) for c in range(3)],differentPixels=dev)
report=dict(hardware=False,continuous=True,forcedFullRefreshOrSnapshotDuringSamples=False,fixture='same actual production timer/scene/drag/release/easeout; synthetic host state/input',sampleCount=len(out['baseline034']['samples']),sampleHashes=out,partialDifferenceCount=len(diffs),partialDifferenceCases=diffs,limits=['No physical scanout/input proof','Disclosed exact differences; do not declare pixel-complete'])
(D/'continuous-partial-comparison.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('continuous samples',report['sampleCount'],'different cases',len(diffs));print(json.dumps({k:{n:v for n,v in r.items() if n!='differentPixels'} for k,r in diffs.items()},indent=2))
for p in dirs.values():shutil.rmtree(p)
