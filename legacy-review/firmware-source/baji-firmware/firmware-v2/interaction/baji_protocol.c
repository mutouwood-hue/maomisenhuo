#include "baji_protocol.h"
#include <string.h>
bool bj_packet_decode(const uint8_t *b,size_t n,bj_packet_t *out)
{
    if(!b || !out || n!=20 || b[0]!=0x42 || b[1]!=0x4a || b[2]!=1 || b[6]>12 || b[7]!=0) return false;
    for(size_t i=8+b[6];i<20;i++) if(b[i]) return false;
    bj_packet_t p={0}; p.opcode=b[3]; p.sequence=(uint16_t)(b[4]|((uint16_t)b[5]<<8)); p.length=b[6];
    memcpy(p.payload,b+8,p.length); *out=p; return true;
}
bool bj_packet_encode(const bj_packet_t *p,uint8_t out[20])
{
    if(!p || !out || p->length>12) return false;
    uint8_t b[20]={0x42,0x4a,1}; b[3]=p->opcode; b[4]=(uint8_t)p->sequence; b[5]=(uint8_t)(p->sequence>>8); b[6]=p->length;
    memcpy(b+8,p->payload,p->length); memcpy(out,b,20); return true;
}
bool bj_packet_request_valid(const bj_packet_t *p)
{
    if(!p || !p->sequence || p->length>12) return false;
    switch(p->opcode){
    case 1: case 2: case 3: return p->length==0;
    case 4: return p->length<=BJ_BLE_PING_MAX;
    case 5: return p->length==1 && p->payload[0]<=2;
    default: return true; /* Business dispatcher returns UNSUPPORTED. */
    }
}
