from pathlib import Path
import subprocess,hashlib,json,statistics
R=Path.cwd();T=R/'tests/firmware035-worker';O=R/'artifacts/firmware-local-v3-perf035';B=R/'artifacts/firmware-local-v3-perf034';H=B/'host-build';P=O/'source/tools/host_preview';LV=R/'firmware/managed_components/lvgl__lvgl';OB=H/'CMakeFiles/badge_host_preview.dir';D=O/'evidence';D.mkdir(exist_ok=True)
cc=['cc','-O3','-std=gnu11','-UNDEBUG','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE',f'-DLV_CONF_PATH="{P}/lv_conf.h"','-I'+str(P/'stubs'),'-I'+str(O/'source/main'),'-I'+str(LV),'-I'+str(P),'-I'+str(H/'lvgl')]
assets=list(OB.rglob('assets/*.c.o'));assert len(assets)==12,len(assets)
gesture=next(OB.rglob('badge_gesture.c.o'));diag=OB/'diag_stubs.c.o';lib=H/'lvgl/lib/liblvgl.a'
# Ablation sources byte-exact respective production source, relocated only for include resolution.
scene_only=T/'scene_only_pages.c';scene_only.write_bytes((B/'source/main/badge_pages.c').read_bytes())
results={}
variants=[('baseline034',B/'source/main/badge_pages.c',B/'source/main/badge_scene.c'),('sceneOnly',scene_only,O/'source/main/badge_scene.c'),('labelsOnly',O/'source/main/badge_pages.c',B/'source/main/badge_scene.c'),('candidate035',O/'source/main/badge_pages.c',O/'source/main/badge_scene.c')]
for name,pages,scene in variants:
    exe=T/name;inc=pages.parent if name=='baseline034' else O/'source/main'
    cmd=[('-I'+str(inc)) if x=='-I'+str(O/'source/main') else x for x in cc]+[f'-DBADGE_PAGES_SOURCE="{pages}"',str(T/'bench.c'),str(scene),str(gesture),str(diag),*[str(p) for p in assets],str(lib),'-lm','-o',str(exe)]
    subprocess.run(cmd,check=True,capture_output=True)
    run=subprocess.run([str(exe)],capture_output=True,text=True);(D/(name+'.log')).write_text(run.stdout+run.stderr);assert run.returncode==0,(name,run.returncode,run.stderr)
    samples={};full={};metrics=[];dev={};snapshot_dif=[];assertions=None
    for l in run.stdout.splitlines():
        a=l.split()
        if a[0]=='SAMPLE':samples[a[1]]=a[2]
        elif a[0]=='FULL':full[a[1]]=a[2]
        elif a[0]=='DEVIATION':dev.setdefault(a[1],[]).append([int(v) for v in a[2:]])
        elif a[0]=='SNAPSHOT_PARTITION_DIFFERENCE':snapshot_dif.append(a[1])
        elif a[0]=='METRIC':metrics.append(dict(case=a[1],repeats=int(a[2]),hostWallUs=int(a[3]),flushes=int(a[4]),pixels=int(a[5])))
        elif a[0]=='CHECKS':assertions=int(a[1])
    results[name]=dict(metrics=metrics,samples=samples,forcedFullPartialRasterHashes=full,partialVsFullDeviations=dev,snapshotPartitionDifferenceCases=snapshot_dif,checks=assertions)
base=results['baseline034'];cand=results['candidate035'];assert all(v['forcedFullPartialRasterHashes']==base['forcedFullPartialRasterHashes'] for v in results.values()),'full raster mismatch'
diffs=[k for k in base['samples'] if base['samples'][k]!=cand['samples'][k]]
def bounds(v):
    ids=[r[0] for r in v];ch=lambda n:((n>>11)&31,(n>>5)&63,n&31)
    return dict(pixels=len(v),bounds=[min(i%466 for i in ids),min(i//466 for i in ids),max(i%466 for i in ids),max(i//466 for i in ids)],maxRgb565ChannelDelta=[max(abs(ch(r[1])[c]-ch(r[2])[c]) for r in v) for c in range(3)]) if ids else dict(pixels=0)
residual={n:{k:bounds(v) for k,v in d['partialVsFullDeviations'].items()} for n,d in results.items()}
report=dict(offline=True,hardware=False,softwareFlushMemcpy=True,partialRows=10,twoBuffersBytesEach=9320,rounder='exact native even-aligned area rule',results=results,fullRasterAllVariantsAllSamplesIdentical=True,sampleCount=len(cand['samples']),partialFramebufferDifferentCases=diffs,residualSummary=residual,baselineHasPartialRasterResiduals=bool(base['partialVsFullDeviations']),oracle='record actual PARTIAL framebuffer; then forced whole-root draw using same PARTIAL renderer at same logical time; snapshot also evaluated but partition blending differs',readOnlyObjects={str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in assets+[gesture,diag,lib]},limits=['Host wall time is not ESP render duration, DMA timing, physical FPS or tear-free proof','Synthetic production drag path does not prove actual touch/scanout','FULL oracle calls excluded from timing; they reset sampled framebuffer between samples','Partial-vs-full residuals are disclosed, not declared pixel-complete','No device operations'])
(D/'partial10-ablation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({n:v['metrics'] for n,v in results.items()},indent=2));print('Full raster identical',report['sampleCount'],'partial differences',diffs);print(json.dumps(residual,indent=2))
