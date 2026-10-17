from pathlib import Path
import subprocess,json,re
R=Path.cwd();T=R/'tests/firmware035-worker';O=R/'artifacts/firmware-local-v3-perf035';B=R/'artifacts/firmware-local-v3-perf034';P=O/'source/tools/host_preview';H=B/'host-build';LV=R/'firmware/managed_components/lvgl__lvgl';OB=H/'CMakeFiles/badge_host_preview.dir';out=T/'render-cycles';out.mkdir(exist_ok=True)
s=(T/'profile_fixture.c').read_text().replace('for(unsigned j=0;j<500;j++)','for(unsigned j=0;j<40;j++)')
fn='''static unsigned long long render_cycles,full47_cycles,full_pixels_cycles,partial_cycles,start_flush,start_pixels;
static void cycle_event(lv_event_t*e){
 if(lv_event_get_code(e)==LV_EVENT_RENDER_START){start_flush=bench_flushes;start_pixels=bench_pixels;}
 if(lv_event_get_code(e)==LV_EVENT_RENDER_READY){unsigned long long f=bench_flushes-start_flush,p=bench_pixels-start_pixels;render_cycles++;if(p==466*466)full_pixels_cycles++;else partial_cycles++;if(f==47&&p==466*466)full47_cycles++;}
}
''';s=s.replace('int main(void) {',fn+'int main(void) {');s=s.replace('puts("READY");fflush(stdout);','lv_display_add_event_cb(host_display,cycle_event,LV_EVENT_ALL,NULL);')
s=s.replace('assert(mock_pet_calls==0);printf','assert(mock_pet_calls==0);printf("CYCLES render=%llu full47=%llu fullPixels=%llu partial=%llu\\n",render_cycles,full47_cycles,full_pixels_cycles,partial_cycles);printf');fixture=out/'fixture.c';fixture.write_text(s)
cc=['cc','-O3','-std=gnu11','-UNDEBUG','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE',f'-DLV_CONF_PATH="{P}/lv_conf.h"','-I'+str(P/'stubs'),'-I'+str(O/'source/main'),'-I'+str(LV),'-I'+str(P),'-I'+str(H/'lvgl')];assets=list(OB.rglob('assets/*.c.o'));gesture=next(OB.rglob('badge_gesture.c.o'));diag=OB/'diag_stubs.c.o';lib=H/'lvgl/lib/liblvgl.a';records={}
# Absolute include because fixture is one directory deeper.
fixture.write_text(s.replace('../../artifacts/firmware-local-v3-perf035/source/tools/host_preview/preview.c',str(P/'preview.c')))
for name,S in [('baseline034',B),('candidate035',O)]:
 inc=S/'source/main';exe=out/name;cmd=[('-I'+str(inc)) if x=='-I'+str(O/'source/main') else x for x in cc]+[f'-DBADGE_PAGES_SOURCE="{inc}/badge_pages.c"',str(fixture),str(inc/'badge_scene.c'),str(gesture),str(diag),*[str(p) for p in assets],str(lib),'-lm','-o',str(exe)];subprocess.run(cmd,check=True,capture_output=True);p=subprocess.run([str(exe)],capture_output=True,text=True);(out/(name+'.log')).write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr;records[name]={k:int(v) for k,v in re.findall(r'(\w+)=(\d+)',p.stdout)};print(name,records[name])
(out/'cycles.json').write_text(json.dumps(dict(hardware=False,records=records,source='actual LV_EVENT_RENDER_START/READY and software flush callback, production synthetic horizontal drag/easeout+feedback',notPhysicalScanout=True),indent=2)+'\n')
