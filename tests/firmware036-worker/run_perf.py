from pathlib import Path
import subprocess,os,re,json,statistics
R=Path.cwd();T=R/'tests/firmware036-worker';O=R/'artifacts/firmware-local-v3-perf036';B=R/'artifacts/firmware-local-v3-perf034';P=O/'source/tools/host_preview';H=B/'host-build';LV=R/'firmware/managed_components/lvgl__lvgl';OB=H/'CMakeFiles/badge_host_preview.dir';D=O/'evidence'
s=(T/'fixtures/upstream035-profile.c').read_text().replace('../../artifacts/firmware-local-v3-perf035/source/tools/host_preview/preview.c',str(P/'preview.c')).replace('for(unsigned j=0;j<500;j++)','for(unsigned j=0;j<40;j++)');s=s.replace('puts("READY");fflush(stdout);','');fixture=T/'perf_fixture.c';fixture.write_text(s)
cc=['cc','-O3','-std=gnu11','-UNDEBUG','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE',f'-DLV_CONF_PATH="{P}/lv_conf.h"','-I'+str(P/'stubs'),'-I'+str(O/'source/main'),'-I'+str(LV),'-I'+str(P),'-I'+str(H/'lvgl'),'-I'+str(LV/'src/draw/sw')]
assets=list(OB.rglob('assets/*.c.o'));gesture=next(OB.rglob('badge_gesture.c.o'));diag=OB/'diag_stubs.c.o';lib=H/'lvgl/lib/liblvgl.a';exes={}
for name,extra in [('baseline035',[]),('default-fallback',[str(O/'source/private/lvgl_mask_pool/lv_draw_sw_mask.c')]),('explicit-pool',['-DCATFOREST_MASK_POOL_HOST_TEST=1',str(O/'source/private/lvgl_mask_pool/lv_draw_sw_mask.c'),str(T/'pool_port.c')])]:
 exe=T/('perf-'+name);cmd=cc+[str(fixture),str(O/'source/main/badge_scene.c'),*extra,str(gesture),str(diag),*[str(p) for p in assets],str(lib),'-lm','-o',str(exe)];p=subprocess.run(cmd,capture_output=True,text=True);assert p.returncode==0,p.stderr;exes[name]=exe
variants={'baseline':('baseline035','enabled'),'nonEspFallback':('default-fallback','enabled'),'pool':('explicit-pool','enabled'),'allocFailFallback':('explicit-pool','alloc-fail')}
orders=[['baseline','pool','nonEspFallback','allocFailFallback'],['allocFailFallback','nonEspFallback','pool','baseline'],['pool','baseline','allocFailFallback','nonEspFallback'],['nonEspFallback','pool','baseline','allocFailFallback'],['baseline','allocFailFallback','nonEspFallback','pool']];records=[]
for i,order in enumerate(orders):
 run={}
 for name in order:
  exe,mode=variants[name];p=subprocess.run([str(exes[exe])],capture_output=True,text=True,env=dict(os.environ,CF_POOL_MODE=mode),timeout=30);(D/f'perf-trial{i}-{name}.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr;run[name]={k:int(v) for k,v in re.findall(r'(\w+)=(\d+)',p.stdout)}
  assert run[name]['iterations']==40
 records.append(dict(order=order,results=run));print(i,{k:v['wallUs'] for k,v in run.items()})
summary={name:dict(medianUs=statistics.median(r['results'][name]['wallUs'] for r in records),minUs=min(r['results'][name]['wallUs'] for r in records),maxUs=max(r['results'][name]['wallUs'] for r in records),medianPairRatioVsBaseline=statistics.median(r['results'][name]['wallUs']/r['results']['baseline']['wallUs'] for r in records)) for name in variants}
assert all(r['results'][name]['flushes']==r['results']['baseline']['flushes'] and r['results'][name]['pixels']==r['results']['baseline']['pixels'] for r in records for name in variants)
(D/'actual-pool-host-perf.json').write_text(json.dumps(dict(hardware=False,actualPrivateImplementation=True,explicitPSRAMCapabilitySubstitutes=True,pairedTrials=5,records=records,summary=summary,allFlushAndPixelCountsExact035=True,allocationOutsideTimedWindow=True,limits=['Mac load/scheduling noise, not formal statistical inference','Host pool is RAM; actual externalPSRAM latency/DMA/physicalscanout not simulated','Not ESPFPS or tear-free result','Original fallback extremeOOM not fixed']),indent=2)+'\n');print(json.dumps(summary,indent=2))
