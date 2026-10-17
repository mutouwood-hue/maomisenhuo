from pathlib import Path
p=Path('artifacts/firmware-local-v3-visual038/source/main/badge_pages.c');s=p.read_text()
s=s.replace('has_target,to_face,commit;','has_target,to_face,commit,bounded_face;')
s=s.replace('    home_scene=badge_scene_create(pages[PAGE_HOME]);','    home_scene=badge_scene_create(pages[PAGE_HOME]);badge_scene_enable_world(home_scene);')
s=s.replace('    hide(face_heading,face==0);set_label(face_heading,face==2?"时间环 · 心动":"24 小时时间环",94);','    hide(face_heading,false);set_label(face_heading,"小猫",94);')
s=s.replace('    set_label(home_link,"",face?60:100);lv_obj_set_pos(home_bt,188,(face?60:100)-8);','    set_label(home_link,"",415);lv_obj_set_pos(home_bt,188,407);')
s=s.replace('    hide(heart_legend,face!=2);hide(ring_missing,!face);','    hide(heart_legend,true);hide(ring_missing,true);')
s=s.replace('    face_heading=title(pages[PAGE_HOME],64,190,"此刻的陪伴");','    face_heading=title(pages[PAGE_HOME],94,190,"小猫");lv_label_set_long_mode(face_heading,LV_LABEL_LONG_MODE_DOTS);')
s=s.replace('    if(fresh) {\n        live_context=true;','    /* Visual trust is RAM-only: disconnect unsubscribes immediately. Reconnect\n     * alone never replays persisted context; require a new accepted revision. */\n    if(!v.connected || !v.subscribed)live_context=false;\n    if(fresh) {\n        live_context=v.connected && v.subscribed;')
# Replace only home state presentation, retaining complete device/status details.
a=s.index('    if(available) {\n        snprintf(text,sizeof(text),"%s%s",live_context',s.index('static void refresh_state(void)\n{'))
b=s.index('    if(domain.has_gift)',a)
s=s[:a]+'''    const char *short_state=!available ? "等你连手机" : !live_context ? "上次状态" : domain.snapshot.scene==L2_SCENE_HOME ? "在家陪你" : domain.snapshot.scene==L2_SCENE_DEPARTING ? "准备出门" : domain.snapshot.scene==L2_SCENE_RETURNING ? "正在回家" : "在外面玩";
    if(available && observed_action==L2_ACTION_SLEEP)short_state="窝里休息";
    set_label(face_phase,short_state,126);
    set_label(face_weather,live_context ? weather_name(domain.snapshot.weather) : "",face?354:363);
    set_label(face_action,observed_action==L2_ACTION_IDLE ? "" : action_name(observed_action),389);
    hide(face_heading,false);set_label(face_heading,available && safe_pet_name(domain.snapshot.pet.name) ? domain.snapshot.pet.name : "小猫",94);
    const char *small_mark=!domain.ready || domain.storage_error ? "存档异常" : domain.pending_events ? "待确认" : !v.connected || !v.subscribed ? "离线" : "";
    set_label(home_link,small_mark,415);hide(home_link,mode==MODE_AOD || mode==MODE_OFF || !small_mark[0]);
    hide(home_bt,mode==MODE_AOD || mode==MODE_OFF || !small_mark[0]);
''' +s[b:]
# Name fonts checked against active24 including its same-size supplement.
key='static void refresh_state(void)\n{'
name='''static bool safe_pet_name(const char *text)
{
    if(!text || !text[0])return false;
    const unsigned char *p=(const unsigned char*)text;unsigned chars=0;
    while(*p){uint32_t cp;unsigned n;if(*p<128){cp=*p;n=1;}else if((*p&0xe0)==0xc0){cp=*p&31;n=2;}else if((*p&0xf0)==0xe0){cp=*p&15;n=3;}else if((*p&0xf8)==0xf0){cp=*p&7;n=4;}else return false;
        for(unsigned i=1;i<n;i++){if(!p[i]||(p[i]&0xc0)!=0x80)return false;cp=(cp<<6)|(p[i]&63);}if(cp<32||cp==127)return false;
        lv_font_glyph_dsc_t d;if(!lv_font_get_glyph_dsc(&local2_font24,&d,cp,0)||d.is_placeholder)return false;p+=n;if(++chars>16)return false;
    }return true;
}
'''
s=s.replace(key,name+key)
# Bounded horizontal carousel: fixed backdrop/rings/HUD, cat pixels track gesture.
s=s.replace('    (void)unused;ui_drag.offset=offset;','''    (void)unused;ui_drag.offset=offset;
    if(ui_drag.bounded_face){
        int sign=ui_drag.direction==BADGE_GESTURE_RIGHT?1:-1;
        badge_scene_set_slide_offset(home_scene,offset);
        badge_scene_set_slide_offset(peek_scene,offset-sign*466);return;
    }''')
s=s.replace('    lv_anim_delete(&ui_drag,drag_apply);ui_drag=(ui_drag_t){0};','    lv_anim_delete(&ui_drag,drag_apply);badge_scene_set_slide_offset(home_scene,0);badge_scene_set_slide_offset(peek_scene,0);ui_drag=(ui_drag_t){0};')
s=s.replace('    ui_drag.settling=false;ui_drag.active=false;','    ui_drag.settling=false;ui_drag.active=false;badge_scene_set_slide_offset(home_scene,0);badge_scene_set_slide_offset(peek_scene,0);')
s=s.replace('.has_target=has_target,.axis=gesture.axis','.has_target=has_target,.bounded_face=face_target && observed_action!=L2_ACTION_SLEEP,.axis=gesture.axis')
s=s.replace('if(face_target)update_home_peek(next_face);hide(preview,false);','''if(face_target){update_home_peek(next_face);badge_scene_set_overlay(peek_scene,ui_drag.bounded_face);lv_obj_set_style_bg_opa(peek_root,ui_drag.bounded_face?LV_OPA_TRANSP:LV_OPA_COVER,0);
            if(ui_drag.bounded_face){for(unsigned i=0;i<5;i++)hide(peek_arcs[i],true);for(unsigned i=0;i<2;i++)hide(peek_rings[i],true);for(unsigned i=0;i<4;i++)hide(peek_hours[i],true);lv_obj_t *parts[]={peek_heading,peek_weather,peek_action,peek_marker,peek_heart,peek_clock,peek_phase,peek_missing};for(unsigned i=0;i<sizeof(parts)/sizeof(parts[0]);i++)hide(parts[i],true);}}
            hide(preview,false);''')
p.write_text(s)
p=Path('artifacts/firmware-local-v3-visual038/source/main/badge_scene.c');s=p.read_text().replace('if(!s||s->slide_x==dx)return;s->slide_x=dx;set_frame(s,s->frame);','if(!s||s->slide_x==dx)return;int delta=dx-s->slide_x;s->slide_x=dx;lv_obj_set_x(s->cat,lv_obj_get_x(s->cat)+delta);');p.write_text(s)
