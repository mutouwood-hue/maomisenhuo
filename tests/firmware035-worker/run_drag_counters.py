from pathlib import Path
import subprocess,json,hashlib,re
R=Path.cwd();T=R/'tests/firmware035-worker';O=R/'artifacts/firmware-local-v3-perf035';B=R/'artifacts/firmware-local-v3-perf034';P=O/'source/tools/host_preview';H=B/'host-build';LV=R/'firmware/managed_components/lvgl__lvgl';OB=H/'CMakeFiles/badge_host_preview.dir';out=T/'counters';out.mkdir(exist_ok=True)
mask=LV/'src/draw/sw/lv_draw_sw_mask.c';decoder=LV/'src/libs/bin_decoder/lv_bin_decoder.c';ms=mask.read_text();ds=decoder.read_text()
ms=ms.replace('#define CIRCLE_CACHE_LIFE_MAX','unsigned long long prof_radius_calls,prof_radius_hits,prof_radius_misses,prof_radius_miss[512];\n#define CIRCLE_CACHE_LIFE_MAX',1)
needle='''    int32_t w = lv_area_get_width(rect);''';ms=ms.replace(needle,'    prof_radius_calls++;\n'+needle,1)
ms=ms.replace('''        if(_circle_cache[i].radius == radius) {''','''        if(_circle_cache[i].radius == radius) {prof_radius_hits++;''',1)
ms=ms.replace('''    circ_calc_aa4(param->circle, radius);''','''    prof_radius_misses++;if(radius>=0&&radius<512)prof_radius_miss[radius]++;
    circ_calc_aa4(param->circle, radius);''',1)
ds=ds.replace('''lv_result_t lv_bin_decoder_open(lv_image_decoder_t * decoder, lv_image_decoder_dsc_t * dsc)
{''','''unsigned long long prof_decoder_open,prof_decoder_area,prof_indexed_lines,prof_indexed_pixels;
lv_result_t lv_bin_decoder_open(lv_image_decoder_t * decoder, lv_image_decoder_dsc_t * dsc)
{prof_decoder_open++;''',1)
ds=ds.replace('''                                    const lv_area_t * full_area, lv_area_t * decoded_area)
{''','''                                    const lv_area_t * full_area, lv_area_t * decoded_area)
{prof_decoder_area++;''',1)
ds=ds.replace('''                                       int32_t w_px, const uint8_t * in, lv_color32_t * out)
{''','''                                       int32_t w_px, const uint8_t * in, lv_color32_t * out)
{prof_indexed_lines++;prof_indexed_pixels+=w_px;''',1)
(out/'mask.c').write_text(ms);(out/'decoder.c').write_text(ds)
s=(T/'profile_fixture.c').read_text().replace('for(unsigned j=0;j<500;j++)','for(unsigned j=0;j<40;j++)');s=s.replace('int main(void) {','extern unsigned long long prof_radius_calls,prof_radius_hits,prof_radius_misses,prof_radius_miss[512],prof_decoder_open,prof_decoder_area,prof_indexed_lines,prof_indexed_pixels;\nint main(void) {')
s=s.replace('puts("READY");fflush(stdout);','prof_radius_calls=prof_radius_hits=prof_radius_misses=prof_decoder_open=prof_decoder_area=prof_indexed_lines=prof_indexed_pixels=0;memset(prof_radius_miss,0,sizeof(unsigned long long)*512);')
s=s.replace('assert(mock_pet_calls==0);printf','''assert(mock_pet_calls==0);printf("COUNTERS radiusCalls=%llu radiusHits=%llu radiusMisses=%llu decoderOpen=%llu decoderArea=%llu indexedLines=%llu indexedPixels=%llu\\n",prof_radius_calls,prof_radius_hits,prof_radius_misses,prof_decoder_open,prof_decoder_area,prof_indexed_lines,prof_indexed_pixels);for(unsigned i=0;i<512;i++)if(prof_radius_miss[i])printf("RADIUS %u %llu\\n",i,prof_radius_miss[i]);printf''')
s=s.replace('../../artifacts/firmware-local-v3-perf035/source/tools/host_preview/preview.c',str(P/'preview.c'))
fixture=out/'counter_fixture.c';fixture.write_text(s)
cc=['cc','-O3','-std=gnu11','-UNDEBUG','-DLV_KCONFIG_IGNORE','-DLV_LVGL_H_INCLUDE_SIMPLE',f'-DLV_CONF_PATH="{P}/lv_conf.h"','-I'+str(P/'stubs'),'-I'+str(O/'source/main'),'-I'+str(LV),'-I'+str(P),'-I'+str(H/'lvgl'),'-I'+str(mask.parent),'-I'+str(decoder.parent)]
assets=list(OB.rglob('assets/*.c.o'));gesture=next(OB.rglob('badge_gesture.c.o'));diag=OB/'diag_stubs.c.o';lib=H/'lvgl/lib/liblvgl.a';records={}
for name,S in [('baseline034',B),('candidate035',O)]:
 inc=S/'source/main';exe=out/name;cmd=[('-I'+str(inc)) if x=='-I'+str(O/'source/main') else x for x in cc]+[f'-DBADGE_PAGES_SOURCE="{inc}/badge_pages.c"',str(fixture),str(inc/'badge_scene.c'),str(out/'mask.c'),str(out/'decoder.c'),str(gesture),str(diag),*[str(p) for p in assets],str(lib),'-lm','-o',str(exe)]
 subprocess.run(cmd,check=True);p=subprocess.run([str(exe)],capture_output=True,text=True);(out/(name+'.log')).write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr;print(name,p.stdout);records[name]=dict(counters={k:int(v) for k,v in re.findall(r'(\w+)=(\d+)',p.stdout)},radiusMissHistogram={int(k):int(v) for k,v in re.findall(r'RADIUS (\d+) (\d+)',p.stdout)})
(out/'counts.json').write_text(json.dumps(dict(hardware=False,productionSourceReadOnly=True,LVGLHostOnlyCounterCopies=True,runtimeConfigCircleCache4=True,runtimeConfigImageCache0=True,runtimeConfigBinRamLoadFalse=True,sourceSha256={str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [mask,decoder]},records=records,limits=['Counters include actual synthetic production drag/settle plus inter-gesture poll/feedback','Not ESP cycle attribution or physical DMA/scanout']),indent=2)+'\n')
