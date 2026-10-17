#include "baji_protocol.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
int main(void) {
    bj_packet_t p={.opcode=4,.sequence=65535,.length=10},q={0};
    uint8_t b[20],bad[20]; unsigned checks=0;
#define CHECK(x) do { assert(x); checks++; } while(0)
    CHECK(bj_packet_encode(&p,b)); CHECK(bj_packet_decode(b,20,&q));
    CHECK(q.sequence==65535 && q.length==10); CHECK(bj_packet_request_valid(&q));
    for(size_t n=0;n<40;n++) if(n!=20) CHECK(!bj_packet_decode(b,n,&q));
    for(unsigned i=0;i<3;i++){memcpy(bad,b,20);bad[i]^=1;CHECK(!bj_packet_decode(bad,20,&q));}
    memcpy(bad,b,20);bad[7]=1;CHECK(!bj_packet_decode(bad,20,&q));
    for(unsigned n=13;n<256;n++){memcpy(bad,b,20);bad[6]=(uint8_t)n;CHECK(!bj_packet_decode(bad,20,&q));}
    for(unsigned n=0;n<=12;n++) {
        p.length=(uint8_t)n;CHECK(bj_packet_encode(&p,b));CHECK(bj_packet_decode(b,20,&q));
        CHECK(bj_packet_request_valid(&q)==(n<=10));
        for(unsigned i=8+n;i<20;i++){memcpy(bad,b,20);bad[i]=1;CHECK(!bj_packet_decode(bad,20,&q));}
    }
    for(unsigned op=1;op<=3;op++){p.opcode=(uint8_t)op;p.length=0;CHECK(bj_packet_request_valid(&p));p.length=1;CHECK(!bj_packet_request_valid(&p));}
    p.opcode=5;p.length=1;
    for(unsigned f=0;f<256;f++){p.payload[0]=(uint8_t)f;CHECK(bj_packet_request_valid(&p)==(f<=2));}
    p.sequence=0;CHECK(!bj_packet_request_valid(&p));p.length=13;CHECK(!bj_packet_encode(&p,b));
    CHECK(!bj_packet_decode(NULL,20,&q));CHECK(!bj_packet_decode(b,20,NULL));
    CHECK(!bj_packet_encode(NULL,b));CHECK(!bj_packet_encode(&p,NULL));CHECK(!bj_packet_request_valid(NULL));
    printf("protocol: %u checks, 0 failures\n",checks);return 0;
}
