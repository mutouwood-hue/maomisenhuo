#!/usr/bin/env python3
"""Compile exact production 20-byte framing helpers without NimBLE or devices."""
from pathlib import Path
import subprocess,tempfile
root=Path(__file__).resolve().parents[2]
source=(root/'artifacts/firmware-local-v3-perf037/source/main/local2_peer.c').read_text()
def function(name):
    start=source.index('static ',source.index(name)-20)
    brace=source.index('{',start);depth=1;end=brace+1
    while depth:
        if source[end]=='{':depth+=1
        elif source[end]=='}':depth-=1
        end+=1
    return source[start:end]
program='''#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
#include <string.h>
#include <assert.h>
#include <stdio.h>
#define L2_PEER_MESSAGE_MAX 64u
static uint8_t tx[64],rx[64],last_rx[64];
static uint16_t tx_size,tx_offset,rx_size,rx_received,last_rx_size;
static uint8_t tx_type,tx_seq,rx_type,rx_seq,last_rx_seq,last_rx_type;
static bool rx_ready;
'''+ '\n'.join(function(n) for n in ['receive_frame(','tx_frame(','tx_advance('])+'''
int main(void){
 uint8_t frame[20],saved[20];tx_size=45;tx_seq=1;tx_type=3;for(unsigned i=0;i<45;i++)tx[i]=(uint8_t)i;
 assert(tx_frame(frame));memcpy(saved,frame,20);assert(receive_frame(frame,20));assert(rx_received==14&&!rx_ready);assert(receive_frame(frame,20));assert(rx_received==14);
 frame[6]^=1;assert(!receive_frame(frame,20));frame[6]^=1;
 tx_advance();assert(tx_frame(frame));frame[3]++;assert(!receive_frame(frame,20));frame[3]--;assert(receive_frame(frame,20));tx_advance();assert(tx_frame(frame));assert(receive_frame(frame,20));tx_advance();assert(tx_frame(frame));frame[19]=1;assert(!receive_frame(frame,20));frame[19]=0;assert(receive_frame(frame,20));assert(rx_ready&&rx_received==45&&!memcmp(rx,tx,45));tx_advance();assert(!tx_frame(frame));
 assert(receive_frame(saved,20));saved[6]^=1;assert(!receive_frame(saved,20));saved[6]^=1;assert(!receive_frame(saved,19));
 tx_size=1;tx_seq=2;tx_type=4;tx[0]=99;tx_offset=0;assert(tx_frame(frame));assert(!receive_frame(frame,20));rx_ready=false;rx_received=rx_size=0;assert(receive_frame(frame,20));assert(rx_ready&&rx[0]==99);
 rx_ready=false;rx_received=rx_size=0;frame[2]=4;assert(!receive_frame(frame,20));frame[2]=3;frame[4]=65;assert(!receive_frame(frame,20));frame[4]=1;frame[0]=1;assert(!receive_frame(frame,20));frame[0]=2;frame[1]=0;assert(!receive_frame(frame,20));
 puts("PASS exact production framing: fragmented roundtrip, identical retry, corruption/padding/order/sequence/size/schema rejection, pending backpressure");return 0;
}
'''
with tempfile.TemporaryDirectory(prefix='catforest-peer-frame-') as tmp:
    path=Path(tmp)/'frame.c';path.write_text(program);exe=Path(tmp)/'frame'
    subprocess.run(['cc','-std=c11','-Wall','-Wextra','-Werror',str(path),'-o',str(exe)],check=True)
    subprocess.run([str(exe)],check=True)
