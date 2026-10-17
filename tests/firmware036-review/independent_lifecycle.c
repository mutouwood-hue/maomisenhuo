/* Actual private implementation; explicit host pool capability shim, not ESP. */
#define main owner_unit_main
#include "mask_unit.c"
#undef main
static uint64_t held_hash(lv_draw_sw_mask_radius_param_t *p){
 uint64_t h=1469598103934665603ULL;int r=p->cfg.radius;
 for(int y=-2;y<2*r+2;y++){lv_opa_t row[610];memset(row,255,sizeof(row));void*m[]={p,NULL};lv_draw_sw_mask_res_t status=lv_draw_sw_mask_apply(m,row,-2,y,2*r+4);h=hash_bytes(h,&status,sizeof(status));h=hash_bytes(h,row,2*r+4);}return h;
}
static void shared_owner(void){
 lv_area_t a={0,0,465,465};lv_draw_sw_mask_radius_param_t p,q,fallback;
 lv_draw_sw_mask_radius_init(&p,&a,233,false);lv_draw_sw_mask_radius_init(&q,&a,233,false);CHECK(p.circle==q.circle&&p.circle->used_cnt==2);uint64_t expected=held_hash(&p);
 for(int r=1;r<=232;r++)raster(r,false);lv_draw_sw_mask_cleanup();CHECK(held_hash(&p)==expected&&p.circle->used_cnt==2);
 lv_draw_sw_mask_deinit();CHECK(cf_mask_deinit_pending&&cf_test_live==1);lv_draw_sw_mask_radius_init(&fallback,&a,160,false);CHECK(cf_mask_slot(fallback.circle)<0);CHECK(held_hash(&q)==expected);
 lv_draw_sw_mask_free_param(&p);CHECK(p.circle==NULL&&q.circle->used_cnt==1&&cf_test_live==1);lv_draw_sw_mask_free_param(&p);CHECK(q.circle->used_cnt==1);lv_draw_sw_mask_free_param(&fallback);CHECK(held_hash(&q)==expected);
 lv_draw_sw_mask_init();CHECK(cf_mask_deinit_pending&&cf_test_alloc_calls==1);lv_draw_sw_mask_free_param(&q);CHECK(cf_test_live==0&&cf_test_free_calls==1);lv_draw_sw_mask_deinit();CHECK(!cf_mask_mutex_initialized);lv_draw_sw_mask_init();CHECK(cf_test_live==1&&cf_test_alloc_calls==2);CHECK(raster(233,false)==expected);
}
static void saturated_reverse(void){
 lv_area_t a={0,0,465,465};lv_draw_sw_mask_radius_param_t p[17];uint64_t hashes[17];
 for(int i=0;i<17;i++){lv_draw_sw_mask_radius_init(&p[i],&a,20+i,i%2);CHECK((cf_mask_slot(p[i].circle)>=0)==(i<12));hashes[i]=held_hash(&p[i]);}
 CHECK(cf_mask_legacy_temporary_refs==1);lv_draw_sw_mask_deinit();CHECK(cf_mask_deinit_pending);lv_draw_sw_mask_cleanup();for(int i=0;i<17;i++)CHECK(held_hash(&p[i])==hashes[i]);
 // Temporary first, then legacy cached, then pooled: no live slice may be freed.
 for(int i=16;i>=12;i--){lv_draw_sw_mask_free_param(&p[i]);lv_draw_sw_mask_free_param(&p[i]);CHECK(cf_test_live==1);}CHECK(cf_mask_legacy_temporary_refs==0);
 for(int i=11;i>=1;i--){lv_draw_sw_mask_free_param(&p[i]);CHECK(cf_test_live==1&&held_hash(&p[0])==hashes[0]);}
 lv_draw_sw_mask_free_param(&p[0]);CHECK(cf_test_live==0&&cf_test_free_calls==1);lv_draw_sw_mask_init();CHECK(!cf_mask_deinit_pending&&cf_test_live==1);
}
static void pool_first_and_pending_fallback(void){
 lv_area_t a={0,0,599,599};lv_draw_sw_mask_radius_param_t p,old[5],newp;
 lv_draw_sw_mask_radius_init(&p,&a,233,false);for(int i=0;i<5;i++)lv_draw_sw_mask_radius_init(&old[i],&a,240+i,false);CHECK(cf_mask_legacy_temporary_refs==1);uint64_t expected=held_hash(&old[4]);
 lv_draw_sw_mask_deinit();lv_draw_sw_mask_free_param(&p);CHECK(cf_test_live==0&&cf_mask_deinit_pending&&cf_mask_mutex_initialized);lv_draw_sw_mask_init();CHECK(cf_test_alloc_calls==1&&cf_mask_deinit_pending);CHECK(held_hash(&old[4])==expected);
 lv_draw_sw_mask_radius_init(&newp,&a,200,false);CHECK(cf_mask_slot(newp.circle)<0&&cf_mask_legacy_temporary_refs==2);lv_draw_sw_mask_free_param(&newp);for(int i=0;i<5;i++)lv_draw_sw_mask_free_param(&old[i]);CHECK(!cf_mask_any_referenced()&&cf_mask_legacy_temporary_refs==0);lv_draw_sw_mask_deinit();CHECK(!cf_mask_mutex_initialized);lv_draw_sw_mask_init();CHECK(cf_test_live==1&&cf_test_alloc_calls==2);
}
int main(int argc,char**argv){assert(argc==2);lv_init();if(!strcmp(argv[1],"shared"))shared_owner();else if(!strcmp(argv[1],"saturated"))saturated_reverse();else if(!strcmp(argv[1],"pool-first"))pool_first_and_pending_fallback();else abort();lv_draw_sw_mask_cleanup();lv_draw_sw_mask_deinit();cf_test_guards();CHECK(cf_test_live==0);printf("INDEPENDENT %s CHECKS %u ALLOC %u FREE %u\n",argv[1],checks,cf_test_alloc_calls,cf_test_free_calls);return 0;}
