from pathlib import Path
import subprocess,json,re,hashlib,shlex
R=Path.cwd();T=R/'tests/firmware035-worker';O=R/'artifacts/firmware-local-v3-perf035';B=R/'artifacts/firmware-local-v3-perf034';P=O/'source/tools/host_preview';H=B/'host-build';LV=R/'firmware/managed_components/lvgl__lvgl';OB=H/'CMakeFiles/badge_host_preview.dir';C=T/'counters';out=T/'mask-memory';out.mkdir(exist_ok=True)
mask=(C/'mask.c').read_text();decoder=C/'decoder.c';s=(C/'counter_fixture.c').read_text()
s=s.replace('extern unsigned long long prof_radius_calls','extern unsigned long long prof_mask_peak,prof_mask_construction_peak,prof_mask_cleanup_count;\nextern unsigned long long prof_radius_calls')
s=s.replace('assert(mock_pet_calls==0);printf','assert(mock_pet_calls==0);printf("MEMORY cacheBufferPeak=%llu constructionPeakIncludingTemporary=%llu cleanupCount=%llu\\n",prof_mask_peak,prof_mask_construction_peak,prof_mask_cleanup_count);printf')
s=s.replace('memset(prof_radius_miss,0,sizeof(unsigned long long)*512);','memset(prof_radius_miss,0,sizeof(unsigned long long)*512);prof_mask_peak=prof_mask_construction_peak=prof_mask_cleanup_count=0;')
fixture=out/'fixture.c';fixture.write_text(s)
cc=['cc','-O3','-std=gnu11','-UNDEBUG','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE',f'-DLV_CONF_PATH="{P}/lv_conf.h"','-I'+str(P/'stubs'),'-I'+str(O/'source/main'),'-I'+str(LV),'-I'+str(P),'-I'+str(H/'lvgl'),'-I'+str(LV/'src/draw/sw'),'-I'+str(LV/'src/libs/bin_decoder')]
assets=list(OB.rglob('assets/*.c.o'));gesture=next(OB.rglob('badge_gesture.c.o'));diag=OB/'diag_stubs.c.o';lib=H/'lvgl/lib/liblvgl.a';records={}
for slots in [4,8,12,16]:
 ms=mask.replace('#define _circle_cache                   LV_GLOBAL_DEFAULT()->sw_circle_cache',f'''static lv_draw_sw_mask_radius_circle_dsc_t profile_circle_cache[{slots}];
#define _circle_cache profile_circle_cache
unsigned long long prof_mask_peak,prof_mask_construction_peak,prof_mask_cleanup_count;
static void profile_mask_budget(lv_draw_sw_mask_radius_circle_dsc_t*c,size_t temp) {{
 size_t n=0;bool found=false;for(unsigned i=0;i<{slots};i++){{if(_circle_cache[i].buf)n+=_circle_cache[i].radius*6+6;if(c==&_circle_cache[i])found=true;}}
 if(!found&&c->buf)n+=c->radius*6+6;
 if(n>prof_mask_peak)prof_mask_peak=n;if(n+temp>prof_mask_construction_peak)prof_mask_construction_peak=n+temp;
}}''').replace('LV_DRAW_SW_CIRCLE_CACHE_SIZE',str(slots))
 ms=ms.replace('void lv_draw_sw_mask_cleanup(void)\n{','void lv_draw_sw_mask_cleanup(void)\n{prof_mask_cleanup_count++;',1)
 ms=ms.replace('    c->cir_opa = c->buf;','    profile_mask_budget(c,0);\n    c->cir_opa = c->buf;',1)
 ms=ms.replace('    int32_t * cir_x = lv_malloc_zeroed(cir_xy_size);','    int32_t * cir_x = lv_malloc_zeroed(cir_xy_size);\n    profile_mask_budget(c,cir_xy_size);',1)
 m=out/f'mask{slots}.c';m.write_text(ms);exe=out/f'cache{slots}'
 cmd=cc+[f'-DBADGE_PAGES_SOURCE="{O}/source/main/badge_pages.c"',str(fixture),str(O/'source/main/badge_scene.c'),str(m),str(decoder),str(gesture),str(diag),*[str(p) for p in assets],str(lib),'-lm','-o',str(exe)]
 subprocess.run(cmd,check=True,capture_output=True);p=subprocess.run([str(exe)],capture_output=True,text=True);(out/f'cache{slots}.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr
 records[slots]={k:int(v) for k,v in re.findall(r'(\w+)=(\d+)',p.stdout)};print(slots,records[slots])
# Verify target ABI size using actual 035 SDK compilation flags; new object only in tests.
probe=out/'target_memory_probe.c';probe.write_text('#include "lvgl.h"\n#include "src/draw/sw/lv_draw_sw_mask_private.h"\n_Static_assert(sizeof(lv_draw_sw_mask_radius_circle_dsc_t)==28,"ESP32S3 circle descriptor size");\nconst unsigned char circle_descriptor_size_proof[sizeof(lv_draw_sw_mask_radius_circle_dsc_t)]={0};\n')
commands=json.loads((O/'build/compile_commands.json').read_text());entry=next(x for x in commands if x['file'].endswith('/lv_draw_sw_mask.c'));cmd=shlex.split(entry['command']);cmd[cmd.index('-o')+1]=str(out/'target_memory_probe.o');cmd[cmd.index('-c')+1]=str(probe)
for opt in ['-MF','-MT']:
 if opt in cmd:cmd[cmd.index(opt)+1]=str(out/('target_memory_probe.d' if opt=='-MF' else 'target_memory_probe.o'))
p=subprocess.run(cmd,cwd=entry['directory'],capture_output=True,text=True);(out/'target-probe.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr
(out/'memory.json').write_text(json.dumps(dict(offline=True,hardware=False,records=records,targetDescriptorBytesStaticAssert=28,targetCompileUsesActual035SdkFlags=True,extraInternalGlobalBssVs4={str(n):(n-4)*28 for n in [8,12,16]},limits=['Mask raw allocation bytes plus temp; excludes allocator headers, global descriptors, other concurrently drawn objects and tasks','Host counters, not target heap measurement','No OOM fallback implemented; future budget gate required','No device/source/config changes']),indent=2)+'\n')
