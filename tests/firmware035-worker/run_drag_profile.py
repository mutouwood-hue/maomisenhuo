from pathlib import Path
import subprocess,json,hashlib,time
R=Path.cwd();T=R/'tests/firmware035-worker';O=R/'artifacts/firmware-local-v3-perf035';B=R/'artifacts/firmware-local-v3-perf034';P=O/'source/tools/host_preview';H=B/'host-build';LV=R/'firmware/managed_components/lvgl__lvgl';OB=H/'CMakeFiles/badge_host_preview.dir'
s=(T/'bench.c').read_text().replace('int main(void){','int unused_fixture_main(void){')
s+='''
int main(void) {
 make_fixture("main_a");fixture.connected=fixture.subscribed=true;lv_init();lv_tick_inc(1000);assert(badge_ui_start());select_page(PAGE_HOME);advance(300);
 uint64_t start=wall_us();unsigned iterations=0;unsigned long long f=bench_flushes,p=bench_pixels;
 puts("READY");fflush(stdout);
 for(unsigned j=0;j<500;j++){
  last_input=lv_tick_get();point(350,230,LV_INDEV_STATE_PRESSED);advance(40);
  for(unsigned i=1;i<=8;i++){point(350-(int)i*28,230,LV_INDEV_STATE_PRESSED);advance(40);}
  point(126,230,LV_INDEV_STATE_RELEASED);advance(260);assert(!ui_drag.active&&!ui_drag.settling);iterations++;
 }
 assert(mock_pet_calls==0);printf("PROFILE iterations=%u wallUs=%llu flushes=%llu pixels=%llu\\n",iterations,(unsigned long long)(wall_us()-start),bench_flushes-f,bench_pixels-p);return 0;
}
'''
source=T/'profile_fixture.c';source.write_text(s)
cc=['cc','-O3','-g','-std=gnu11','-UNDEBUG','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE',f'-DLV_CONF_PATH="{P}/lv_conf.h"','-I'+str(P/'stubs'),'-I'+str(O/'source/main'),'-I'+str(LV),'-I'+str(P),'-I'+str(H/'lvgl')]
assets=list(OB.rglob('assets/*.c.o'));gesture=next(OB.rglob('badge_gesture.c.o'));diag=OB/'diag_stubs.c.o';lib=H/'lvgl/lib/liblvgl.a';out=T/'profile-steady';out.mkdir(exist_ok=True)
for name,S in [('baseline034',B),('candidate035',O)]:
 inc=S/'source/main';exe=out/name;cmd=[('-I'+str(inc)) if x=='-I'+str(O/'source/main') else x for x in cc]+[f'-DBADGE_PAGES_SOURCE="{inc}/badge_pages.c"',str(source),str(inc/'badge_scene.c'),str(gesture),str(diag),*[str(p) for p in assets],str(lib),'-lm','-o',str(exe)]
 subprocess.run(cmd,check=True,capture_output=True)
 child=subprocess.Popen([str(exe)],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 lines=[]
 while True:
  line=child.stdout.readline();lines.append(line)
  if line.strip()=='READY':break
  if not line:raise RuntimeError('fixture ended before ready')
 sample=subprocess.run(['/usr/bin/sample',str(child.pid),'3','1','-file',str(out/(name+'-sample.txt'))],capture_output=True,text=True,timeout=10)
 (out/(name+'-sample-command.log')).write_text(sample.stdout+sample.stderr)
 rest=child.communicate(timeout=60)[0];(out/(name+'.log')).write_text(''.join(lines)+rest);assert child.returncode==0,(name,child.returncode)
 if sample.returncode:print('SAMPLE unavailable',name,sample.returncode,sample.stderr)
 print(name,(out/(name+'.log')).read_text().strip())
print('No 035 source changes; read-only host process profile; no devices')
