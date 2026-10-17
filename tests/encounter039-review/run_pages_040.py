from pathlib import Path
import subprocess,json,hashlib
R=Path.cwd();O=R/'tests/encounter039-review';S=R/'artifacts/firmware-local-v4-encounter040/source';OLD=R/'artifacts/firmware-local-v3-perf034/host-build';LV=R/'firmware/managed_components/lvgl__lvgl';src=(S/'tools/host_preview/preview.c').read_text()
# Test harness only: actual production pages included verbatim, fixture peer call records intent.
src=src.replace('void local2_peer_confirm(const l2_peer_confirm_token_t *token) {if(token&&token->valid)peer_fixture.local_confirmed=true;}','static unsigned confirm_calls; static l2_peer_confirm_token_t sent_intent;\nvoid local2_peer_confirm(const l2_peer_confirm_token_t *token) {if(token&&token->valid){confirm_calls++;sent_intent=*token;peer_fixture.local_confirmed=true;}}')
extra=r'''
static void independent_intent_checks(void) {
 select_page(PAGE_MEET);peer_fixture.phase=L2P_CONFIRM;peer_fixture.discoverable=peer_fixture.connected=true;
 memset(&peer_fixture.confirm_token,0,sizeof(peer_fixture.confirm_token));
 l2_peer_confirm_token_t *t=&peer_fixture.confirm_token;t->valid=true;t->link_generation=1;t->connection_handle=7;
 strcpy(t->peer_id,"22222222222222222222222222222222");t->local_counter=1;t->remote_counter=2;t->fingerprint[0]=1;
 unsigned original_care=mock_pet_calls;
 for(unsigned field=0;field<6;field++) {
   peer_fixture.local_confirmed=false;refresh_state();unsigned n=confirm_calls;
   point(123,308,LV_INDEV_STATE_PRESSED);advance(70);
   if(field==0)t->peer_id[0]='3';
   if(field==1)t->link_generation++;
   if(field==2)t->connection_handle++;
   if(field==3)t->local_counter++;
   if(field==4)t->remote_counter++;
   if(field==5)t->fingerprint[0]++;
   refresh_state();point(123,308,LV_INDEV_STATE_RELEASED);advance(70);
   CHECK(confirm_calls==n);CHECK(!peer_fixture.local_confirmed);CHECK(mock_pet_calls==original_care);
   touch(123,308,70);CHECK(confirm_calls==n+1);CHECK(peer_fixture.local_confirmed);CHECK(!memcmp(&sent_intent,t,sizeof(*t)));CHECK(mock_pet_calls==original_care);
 }
 peer_fixture.local_confirmed=false;refresh_state();unsigned n=confirm_calls;
 point(123,308,LV_INDEV_STATE_PRESSED);advance(70);t->valid=false;refresh_state();
 point(123,308,LV_INDEV_STATE_RELEASED);advance(70);CHECK(confirm_calls==n);CHECK(!peer_fixture.local_confirmed);
}
'''
assert src.count('int main(int argc,char **argv)')==1
src=src.replace('int main(int argc,char **argv)',extra+'\nint main(int argc,char **argv)').replace('same_size_font_checks();','same_size_font_checks();\n    if(!strcmp(argv[1],"independent_intent"))independent_intent_checks();')
local=O/'pages040-generated.c';local.write_text(src)
flags=['clang','-std=gnu11','-O2','-UNDEBUG','-DLV_LVGL_H_INCLUDE_SIMPLE','-DLV_KCONFIG_IGNORE','-DLV_CONF_PATH="'+str(S/'tools/host_preview/lv_conf.h')+'"','-DBADGE_PAGES_SOURCE="'+str(S/'main/badge_pages.c')+'"','-I'+str(S/'tools/host_preview/stubs'),'-I'+str(S/'main'),'-I'+str(LV),'-I'+str(S/'tools/host_preview'),'-I'+str(OLD/'lvgl')]
objects=[];logs=[]
for name,source in [('pages',local),('diag',S/'tools/host_preview/diag_stubs.c'),('scene',S/'main/badge_scene.c')]:
 obj=O/('pages040-'+name+'.o');cmd=flags+['-c',str(source),'-o',str(obj)];p=subprocess.run(cmd,capture_output=True,text=True,timeout=45);logs.append(p.stdout+p.stderr);assert p.returncode==0,p.stderr;objects.append(obj)
for n in ['badge_gesture.c','local2_fonts.c','badge_f16.c','badge_f20.c','badge_f24.c','badge_n40.c','cat_idle.c','cat_paw.c','game_assets.c','game_idle.c','game_pet.c','game_walk.c','game_attention.c']:objects.append(next(OLD.rglob(n+'.o')))
exe=O/'pages040';p=subprocess.run(['clang++',*map(str,objects),str(OLD/'lvgl/lib/liblvgl.a'),'-lm','-o',str(exe)],text=True,capture_output=True,timeout=45);logs.append(p.stdout+p.stderr);(O/'pages040-build.log').write_text(''.join(logs));assert p.returncode==0,p.stderr
rows=[]
for case in ['independent_intent','input_test']:
 stem=O/('pages040-'+case);p=subprocess.run([str(exe),case,str(stem)],capture_output=True,text=True,timeout=60);(stem.with_suffix('.log')).write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr;row=json.loads(stem.with_suffix('.json').read_text());rows.append({'case':case,'assertions':row['input_assertions_passed'],'missingGlyphs':row['missing_glyph_count']});print(rows[-1])
(O/'pages040-independent-report.json').write_text(json.dumps({'virtual_fixture':True,'actualProductionPagesSha256':hashlib.sha256((S/'main/badge_pages.c').read_bytes()).hexdigest(),'actualLVGL':True,'peerQueueBoundaryStubbed':'records actual token; actual poll separately verified','originalHostPreviewReused':True,'newIndependentCases':['peer identity','link generation','connection handle','local counter','remote counter','fingerprint','valid=false'],'cases':rows},indent=2)+'\n')
