/* Pure host test: runner extracts the unchanged production drag block into an include.
 * No firmware, BLE, storage, display driver or device is linked. */
#include <assert.h>
#include <stdio.h>
#include "badge_gesture.h"
#include "badge_ui_contract.h"
typedef enum { PAGE_BOOT, PAGE_PAIR, PAGE_GUIDE, PAGE_HOME, PAGE_CARE, PAGE_CARE_ACTION,
 PAGE_STATUS, PAGE_SETTINGS, PAGE_DEVICE, PAGE_TOUCH, PAGE_VOICE, PAGE_WELCOME, PAGE_MEET, PAGE_COUNT } page_t;
typedef struct {int x,y;bool hidden,press_lock;} lv_obj_t;
typedef struct lv_anim_t {void *var;void (*exec)(void *,int32_t);void (*done)(struct lv_anim_t *);int from,to;unsigned duration;} lv_anim_t;
#define LV_OBJ_FLAG_HIDDEN 1
#define LV_OBJ_FLAG_PRESS_LOCK 2
static lv_obj_t objects[PAGE_COUNT],peek,root,modal,reset;
static lv_obj_t *pages[PAGE_COUNT],*peek_root=&peek,*stage_root=&root,*reset_layer=&reset;
static page_t current_page=PAGE_HOME;
static badge_gesture_t gesture;
static bool presentation_contact,contact_cancelled,ignore_contact,held_action,drag_completing;
static struct {bool pairing,bound;} previous;
static uint32_t clock_ms,navigation_started;
static unsigned navigations;
static bool fail_anim;
static lv_anim_t running;
typedef struct {bool active,settling,has_target,to_face,commit,bounded_face;int axis,offset;page_t from,target;unsigned face;badge_gesture_kind_t direction;} ui_drag_t;
static ui_drag_t ui_drag;
static uint32_t lv_tick_get(void){return clock_ms;}
static void hide(lv_obj_t *o,bool value){o->hidden=value;}
static bool lv_obj_has_flag(lv_obj_t *o,int flag){return flag==LV_OBJ_FLAG_HIDDEN?o->hidden:o->press_lock;}
static void lv_obj_add_flag(lv_obj_t *o,int flag){if(flag==LV_OBJ_FLAG_PRESS_LOCK)o->press_lock=true;}
static void lv_obj_remove_flag(lv_obj_t *o,int flag){if(flag==LV_OBJ_FLAG_PRESS_LOCK)o->press_lock=false;}
static void lv_obj_set_pos(lv_obj_t *o,int x,int y){o->x=x;o->y=y;}
static void lv_obj_move_foreground(lv_obj_t *o){(void)o;}
static bool gift_modal(void){return !modal.hidden;}
static bool transitioning(void){return ui_drag.settling;}
static void lv_anim_delete(void *v,void (*cb)(void *,int32_t)){(void)v;(void)cb;running=(lv_anim_t){0};}
static void lv_anim_init(lv_anim_t *a){*a=(lv_anim_t){0};}
static void lv_anim_set_var(lv_anim_t *a,void *v){a->var=v;}
static void lv_anim_set_exec_cb(lv_anim_t *a,void (*cb)(void *,int32_t)){a->exec=cb;}
static void lv_anim_set_values(lv_anim_t *a,int x,int y){a->from=x;a->to=y;}
static void lv_anim_set_duration(lv_anim_t *a,unsigned ms){a->duration=ms;}
static void lv_anim_path_ease_out(void){}
static void lv_anim_set_path_cb(lv_anim_t *a,void (*cb)(void)){(void)a;(void)cb;}
static void lv_anim_set_completed_cb(lv_anim_t *a,void (*cb)(lv_anim_t *)){a->done=cb;}
static lv_anim_t *lv_anim_start(lv_anim_t *a){if(fail_anim)return NULL;running=*a;return &running;}
static void navigate(page_t p){assert(drag_completing);current_page=p;navigations++;for(unsigned i=0;i<PAGE_COUNT;i++){hide(pages[i],i!=(unsigned)p);lv_obj_set_pos(pages[i],0,0);}}
#include "production_drag.inc"
static void finish(void){lv_anim_t a=running;assert(a.exec&&a.done);a.exec(a.var,a.to);a.done(&a);}
static void fresh(page_t page){presentation_contact=false;drag_cancel();current_page=page;for(unsigned i=0;i<PAGE_COUNT;i++){pages[i]=&objects[i];objects[i]=(lv_obj_t){.hidden=i!=(unsigned)page};}modal.hidden=reset.hidden=true;gesture=(badge_gesture_t){0};ignore_contact=held_action=contact_cancelled=fail_anim=false;previous.pairing=false;clock_ms=1000;}
static void begin(int x,int y){presentation_contact=true;badge_gesture_begin(&gesture,x,y,clock_ms);}
static void move(int x,int y){badge_gesture_move(&gesture,x,y);drag_update();}
static void release(int x,int y,unsigned ms){clock_ms+=ms;presentation_contact=false;badge_gesture_kind_t k=badge_gesture_end(&gesture,x,y,clock_ms);assert(drag_release(k));}
static void restored(void){for(unsigned i=0;i<PAGE_COUNT;i++){assert(!objects[i].x&&!objects[i].y&&!objects[i].press_lock);assert(objects[i].hidden==(i!=(unsigned)current_page));}assert(!ui_drag.active&&!ui_drag.settling&&peek.hidden);assert(navigation_started<=clock_ms);}
static void gesture_checks(void){
 badge_gesture_t g={0};badge_gesture_begin(&g,233,233,0);badge_gesture_move(&g,240,240);assert(!g.axis);badge_gesture_move(&g,233,221);assert(g.axis==2);badge_gesture_move(&g,400,220);assert(g.axis==2);
 assert(badge_gesture_end(&g,400,220,100)==BADGE_GESTURE_NONE);
 g=(badge_gesture_t){0};badge_gesture_begin(&g,233,350,0);assert(badge_gesture_end(&g,233,211,800)==BADGE_GESTURE_NONE);
 g=(badge_gesture_t){0};badge_gesture_begin(&g,233,350,0);assert(badge_gesture_end(&g,233,210,800)==BADGE_GESTURE_UP);
 g=(badge_gesture_t){0};badge_gesture_begin(&g,233,350,0);assert(badge_gesture_end(&g,233,300,500)==BADGE_GESTURE_UP);
 assert(badge_gesture_drag_offset(-900,BADGE_GESTURE_UP,true)==-466);
 assert(badge_gesture_drag_offset(50,BADGE_GESTURE_UP,true)==0);
 assert(badge_gesture_drag_offset(200,BADGE_GESTURE_DOWN,false)==28);
}
int main(void){
 for(unsigned i=0;i<PAGE_COUNT;i++)pages[i]=&objects[i];gesture_checks();
 fresh(PAGE_HOME);unsigned n=navigations;begin(233,300);move(233,260);assert(ui_drag.active&&ui_drag.has_target);assert(ui_drag.target==PAGE_CARE&&ui_drag.offset==-40);assert(objects[PAGE_HOME].y==-40&&objects[PAGE_CARE].y==426);assert(!objects[PAGE_CARE].hidden&&objects[PAGE_HOME].press_lock);assert(current_page==PAGE_HOME&&navigations==n);release(233,260,80);assert(!ui_drag.commit&&running.duration==180);finish();assert(current_page==PAGE_HOME&&navigations==n);restored();
 fresh(PAGE_HOME);begin(233,350);move(233,210);release(233,210,800);assert(ui_drag.commit&&running.duration==200&&current_page==PAGE_HOME);finish();assert(current_page==PAGE_CARE&&navigations==n+1);restored();
 fresh(PAGE_HOME);begin(233,300);move(233,220);move(233,420);assert(ui_drag.target==PAGE_CARE&&ui_drag.direction==BADGE_GESTURE_UP&&ui_drag.offset==0);release(233,420,200);assert(!ui_drag.commit);finish();assert(current_page==PAGE_HOME);restored();
 fresh(PAGE_STATUS);begin(233,200);move(233,400);assert(!ui_drag.has_target&&ui_drag.offset==28);release(233,400,100);finish();assert(current_page==PAGE_STATUS);restored();
 fresh(PAGE_CARE);begin(233,150);move(400,210);assert(ui_drag.axis==1&&!ui_drag.has_target);move(233,350);assert(ui_drag.axis==1&&ui_drag.target==PAGE_CARE);release(233,350,100);finish();restored();
 fresh(PAGE_CARE);begin(233,150);move(233,300);release(233,300,100);finish();assert(current_page==PAGE_HOME);restored();
 fresh(PAGE_STATUS);begin(233,350);move(233,200);release(233,200,100);finish();assert(current_page==PAGE_HOME);restored();
 fresh(PAGE_SETTINGS);begin(150,233);move(300,233);release(300,233,100);finish();assert(current_page==PAGE_STATUS);restored();
 fresh(PAGE_HOME);begin(233,300);move(233,220);drag_cancel();assert(contact_cancelled&&!gesture.active&&ignore_contact);restored();
 fresh(PAGE_HOME);begin(233,300);move(233,220);modal.hidden=false;drag_update();assert(contact_cancelled);restored();
 fresh(PAGE_HOME);begin(233,300);move(233,220);reset.hidden=false;drag_update();assert(contact_cancelled);restored();
 fresh(PAGE_HOME);begin(233,350);move(233,210);fail_anim=true;release(233,210,100);assert(current_page==PAGE_HOME);restored();
 fresh(PAGE_HOME);begin(320,233);move(180,233);assert(!ui_drag.active);presentation_contact=false;gesture.active=false;release_transition(BADGE_GESTURE_LEFT);assert(running.duration==120&&!ui_drag.active);finish();restored();
 puts("PASS: production drag object lifecycle + gesture contract (pure host)");return 0;
}
