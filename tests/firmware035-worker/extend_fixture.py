from pathlib import Path
p=Path('tests/firmware035-worker/bench.c');s=p.read_text();a=s.index('    if(memcmp(saved,framebuffer');b=s.index('    if(!exact_snapshot)',a);s=s[:a]+'''    unsigned diff=0;for(unsigned i=0;i<466*466;i++)if(saved[i]!=framebuffer[i]){
        diff++;printf("DEVIATION %s %u %u %u\\n",tag,i,saved[i],framebuffer[i]);
    }
    printf("FULL %s %016llx\\n",tag,(unsigned long long)pixel_hash(framebuffer,sizeof(framebuffer)));
'''+s[b:];insert='''static void measure_drag(void) {
    select_page(PAGE_HOME);advance(400);face=0;update_face();advance(200);last_input=lv_tick_get();
    unsigned saved_calls=mock_pet_calls;
    unsigned long long f=bench_flushes,p=bench_pixels;uint64_t t=wall_us();
    point(350,230,LV_INDEV_STATE_PRESSED);advance(40);
    for(unsigned i=1;i<=8;i++){point(350-(int)i*28,230,LV_INDEV_STATE_PRESSED);advance(40);}
    point(126,230,LV_INDEV_STATE_RELEASED);advance(260);
    t=wall_us()-t;
    printf("METRIC horizontal-drag-commit-easeout 1 %llu %llu %llu\\n",(unsigned long long)t,bench_flushes-f,bench_pixels-p);
    assert(face==1);assert(!ui_drag.active&&!ui_drag.settling);assert(mock_pet_calls==saved_calls);checks+=3;
    sample("horizontal-drag-final");
    f=bench_flushes;p=bench_pixels;t=wall_us();
    point(280,230,LV_INDEV_STATE_PRESSED);advance(40);point(254,230,LV_INDEV_STATE_PRESSED);advance(40);
    point(254,230,LV_INDEV_STATE_RELEASED);advance(260);t=wall_us()-t;
    printf("METRIC horizontal-drag-rebound 1 %llu %llu %llu\\n",(unsigned long long)t,bench_flushes-f,bench_pixels-p);
    assert(face==1);assert(!ui_drag.active&&!ui_drag.settling);assert(mock_pet_calls==saved_calls);checks+=3;sample("horizontal-rebound-final");
}
''';s=s.replace('int main(void){',insert+'int main(void){');s=s.replace('    /* First context must initialize','    measure_drag();\n    /* First context must initialize');p.write_text(s)
