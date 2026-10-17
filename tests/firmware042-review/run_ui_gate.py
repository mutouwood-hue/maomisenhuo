from pathlib import Path
import subprocess,json,hashlib
R=Path.cwd();O=R/'tests/firmware042-review';S=R/'artifacts/firmware-visual-integration042/source';OLD=R/'artifacts/firmware-local-v3-perf034/host-build';LV=R/'firmware/managed_components/lvgl__lvgl';src=(S/'tools/host_preview/preview.c').read_text();tag='#include BADGE_PAGES_SOURCE'
stub='''#include "badge_renderer_panel.h"
static vr_stats_t renderer_fixture_stats={.x=130,.y=130,.w=256,.h=256};
static uint16_t renderer_fixture_pixels[256*256];static bool renderer_fixture_valid=true;
const vr_stats_t *badge_renderer_stats(void){return renderer_fixture_valid?&renderer_fixture_stats:NULL;}
const uint16_t *badge_renderer_pixels(void){return renderer_fixture_valid?renderer_fixture_pixels:NULL;}
bool host_renderer_prepare(unsigned sample){(void)sample;renderer_fixture_valid=true;return true;}
'''
src=src.replace(tag,stub+'\n'+tag)
extra=r'''
static void prep_render_gate(void){select_page(PAGE_HOME);face=0;update_face();mode=MODE_PLAY;last_input=lv_tick_get();navigation_started=last_input-300;observed_action=L2_ACTION_IDLE;previous.pairing=false;fixture.connected=fixture.subscribed=false;domain_fixture.ready=true;domain_fixture.storage_error=domain_fixture.busy=false;renderer_fixture_valid=true;badge_ui_renderer_clear();refresh_state();}
static void independent_renderer_gate_checks(void){
 unsigned care_before=mock_pet_calls;prep_render_gate();CHECK(badge_ui_renderer_begin());CHECK(badge_ui_renderer_publish());CHECK(home_scene); /* actual scene has exact descriptor, fixture only pixel source */
 CHECK(badge_ui_renderer_begin());navigate(PAGE_CARE);navigate(PAGE_HOME);navigation_started=lv_tick_get()-300;CHECK(!badge_ui_renderer_publish());
 prep_render_gate();CHECK(badge_ui_renderer_begin());set_mode(MODE_COMP);set_mode(MODE_PLAY);CHECK(!badge_ui_renderer_publish());
 prep_render_gate();CHECK(badge_ui_renderer_begin());domain_fixture.snapshot.revision++;CHECK(!badge_ui_renderer_publish());
 prep_render_gate();CHECK(badge_ui_renderer_begin());domain_fixture.care_change++;CHECK(!badge_ui_renderer_publish());
 prep_render_gate();CHECK(badge_ui_renderer_begin());domain_fixture.gift_change++;CHECK(!badge_ui_renderer_publish());
 prep_render_gate();CHECK(badge_ui_renderer_begin());fixture.connected=true;CHECK(!badge_ui_renderer_publish());
 prep_render_gate();CHECK(badge_ui_renderer_begin());fixture.subscribed=true;CHECK(!badge_ui_renderer_publish());
 prep_render_gate();CHECK(badge_ui_renderer_begin());renderer_fixture_valid=false;CHECK(!badge_ui_renderer_publish());
 prep_render_gate();CHECK(badge_ui_renderer_begin());touch(460,460,70);CHECK(!badge_ui_renderer_publish());CHECK(mock_pet_calls==care_before);
 prep_render_gate();CHECK(badge_ui_renderer_begin());badge_ui_renderer_clear();CHECK(!badge_ui_renderer_publish());
 prep_render_gate();face=1;update_face();CHECK(!badge_ui_renderer_begin());face=0;update_face();set_mode(MODE_AOD);CHECK(!badge_ui_renderer_begin());
 prep_render_gate();CHECK(badge_ui_renderer_begin());CHECK(badge_ui_renderer_publish());lv_obj_invalidate(stage_root);lv_refr_now(host_display);badge_ui_renderer_clear();lv_obj_invalidate(stage_root);lv_refr_now(host_display);CHECK(mock_pet_calls==care_before);
}
'''
src=src.replace('int main(int argc,char **argv)',extra+'\nint main(int argc,char **argv)').replace('same_size_font_checks();','same_size_font_checks();\nif(!strcmp(argv[1],"independent_renderer"))independent_renderer_gate_checks();');local=O/'ui-gate-generated.c';local.write_text(src)
flags=['clang','-std=gnu11','-O2','-UNDEBUG','-DLV_LVGL_H_INCLUDE_SIMPLE','-DLV_KCONFIG_IGNORE','-DLV_CONF_PATH="'+str(S/'tools/host_preview/lv_conf.h')+'"','-DBADGE_PAGES_SOURCE="'+str(S/'main/badge_pages.c')+'"','-I'+str(S/'tools/host_preview/stubs'),'-I'+str(S/'main'),'-I'+str(LV),'-I'+str(S/'tools/host_preview'),'-I'+str(OLD/'lvgl')]
objects=[];log=[]
for name,p in [('pages',local),('diag',S/'tools/host_preview/diag_stubs.c'),('scene',S/'main/badge_scene.c')]:
 obj=O/('ui-gate-'+name+'.o');r=subprocess.run(flags+['-c',str(p),'-o',str(obj)],capture_output=True,text=True,timeout=45);log.append(r.stdout+r.stderr);assert not r.returncode,r.stderr;objects.append(obj)
for n in ['badge_gesture.c','local2_fonts.c','badge_f16.c','badge_f20.c','badge_f24.c','badge_n40.c','cat_idle.c','cat_paw.c','game_assets.c','game_idle.c','game_pet.c','game_walk.c','game_attention.c']:objects.append(next(OLD.rglob(n+'.o')))
r=subprocess.run(['clang++',*map(str,objects),str(OLD/'lvgl/lib/liblvgl.a'),'-lm','-o',str(O/'ui-gate')],capture_output=True,text=True,timeout=45);log.append(r.stdout+r.stderr);(O/'ui-gate-build.log').write_text(''.join(log));assert not r.returncode,r.stderr
r=subprocess.run([str(O/'ui-gate'),'independent_renderer',str(O/'ui-gate-result')],capture_output=True,text=True,timeout=60);(O/'ui-gate-run.log').write_text(r.stdout+r.stderr);assert not r.returncode,r.stderr
j=json.loads((O/'ui-gate-result.json').read_text());print({k:j[k]for k in ['input_assertions_passed','mock_pet_calls','missing_glyph_count']})
