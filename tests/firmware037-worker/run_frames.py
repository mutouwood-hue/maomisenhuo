from pathlib import Path
import subprocess,os,json,re,hashlib
R=Path.cwd();T=R/'tests/firmware037-worker';O=R/'artifacts/firmware-local-v3-perf037';B=R/'artifacts/firmware-local-v3-perf034';P=O/'source/tools/host_preview';H=B/'host-build';LV=R/'firmware/managed_components/lvgl__lvgl';OB=H/'CMakeFiles/badge_host_preview.dir';D=O/'evidence'
s=(T/'fixtures/upstream035-bench.c').read_text().replace('../../artifacts/firmware-local-v3-perf035/source/tools/host_preview/preview.c',str(P/'preview.c'))
a=s.index('#ifdef BENCH_CONTINUOUS');b=s.index('#endif',a);s=s[:a]+'''#ifdef BENCH_CONTINUOUS
    printf("SAMPLE %s %016llx\\n",tag,(unsigned long long)h);samples++;return;
'''+s[b:]
fn='''#include <CommonCrypto/CommonDigest.h>
static unsigned frame_count;
static void frame_event(lv_event_t*e){(void)e;unsigned char sha[CC_SHA256_DIGEST_LENGTH];CC_SHA256(framebuffer,sizeof(framebuffer),sha);printf("FRAME %u %u ",frame_count++,lv_tick_get());for(unsigned i=0;i<sizeof(sha);i++)printf("%02x",sha[i]);puts("");}
'''
s=s.replace('static unsigned checks,samples;',fn+'static unsigned checks,samples;')
s=s.replace('assert(badge_ui_start());select_page(PAGE_HOME);','assert(badge_ui_start());lv_display_add_event_cb(host_display,frame_event,LV_EVENT_RENDER_READY,NULL);select_page(PAGE_HOME);')
# Add40 production horizontal gestures + all easing frames, no forced redraws.
s=s.replace('    /* First context must initialize', '''    select_page(PAGE_HOME);advance(400);
    for(unsigned j=0;j<40;j++){
        last_input=lv_tick_get();point(350,230,LV_INDEV_STATE_PRESSED);advance(40);
        for(unsigned i=1;i<=8;i++){point(350-(int)i*28,230,LV_INDEV_STATE_PRESSED);advance(40);}
        point(126,230,LV_INDEV_STATE_RELEASED);advance(260);assert(!ui_drag.active&&!ui_drag.settling);
    }
    /* First context must initialize''')
fixture=T/'frame_fixture.c';fixture.write_text(s)
cc=['cc','-O3','-std=gnu11','-UNDEBUG','-DBENCH_CONTINUOUS=1','-Wno-deprecated-declarations','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE',f'-DLV_CONF_PATH="{P}/lv_conf.h"','-I'+str(P/'stubs'),'-I'+str(O/'source/main'),'-I'+str(LV),'-I'+str(P),'-I'+str(H/'lvgl'),'-I'+str(LV/'src/draw/sw')]
assets=list(OB.rglob('assets/*.c.o'));gesture=next(OB.rglob('badge_gesture.c.o'));diag=OB/'diag_stubs.c.o';lib=H/'lvgl/lib/liblvgl.a';exes={};records={}
for name,extra in [('baseline037-original-mask',[]),('private-default',[str(O/'source/private/lvgl_mask_pool/lv_draw_sw_mask.c')]),('private-simulated',['-DCATFOREST_MASK_POOL_HOST_TEST=1',str(O/'source/private/lvgl_mask_pool/lv_draw_sw_mask.c'),str(T/'pool_port.c')])]:
 exe=T/name;cmd=cc+[str(fixture),str(O/'source/main/badge_scene.c'),*extra,str(gesture),str(diag),*[str(p) for p in assets],str(lib),'-lm','-o',str(exe)];p=subprocess.run(cmd,capture_output=True,text=True);(D/(name+'-frame-build.log')).write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr;exes[name]=exe
variants=[('baseline037-original-mask','enabled'),('private-default','enabled')]+[('private-simulated',m) for m in ['enabled','unsupported','low-free','small-block','alloc-fail','misaligned','bad-cap','short-size','post-budget']]
for name,mode in variants:
 key=name+'-'+mode;p=subprocess.run([str(exes[name])],capture_output=True,text=True,env=dict(os.environ,CF_POOL_MODE=mode),timeout=60);(D/(key+'-frames.log')).write_text(p.stdout+p.stderr);assert p.returncode==0,(key,p.stderr);frames=[l for l in p.stdout.splitlines() if l.startswith('FRAME')];samples=[l for l in p.stdout.splitlines() if l.startswith('SAMPLE')];records[key]=dict(frameCount=len(frames),frames=frames,samples=samples,frameSequenceSha256=hashlib.sha256(('\n'.join(frames)).encode()).hexdigest());print(key,len(frames),records[key]['frameSequenceSha256'])
ref=records['baseline037-original-mask-enabled'];assert all(r['frames']==ref['frames'] and r['samples']==ref['samples'] for r in records.values()),'intermediate pixels changed'
(D/'all-render-frame-comparison.json').write_text(json.dumps(dict(hardware=False,allIntermediatePoolFramesExactOriginalMaskWith037Pages=True,logicalTicksAndRenderCountsExact=True,forcedFullRefreshOrSnapshotDuringWindow=False,explicitPoolSimulation=True,records=records,limits=['Host PSRAM capability simulation; not actual PSRAM latency/DMA/scanout','Precompiled LVGL engine reused; actual modified mask/pages/scene paths compiled','Existing035 eight-pixel versus034 differences inherited, not repaired']),indent=2)+'\n')
