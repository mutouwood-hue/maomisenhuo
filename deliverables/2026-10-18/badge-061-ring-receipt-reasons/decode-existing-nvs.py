#!/usr/bin/env python3
"""Read already captured NVS bytes, without executing firmware or changing it."""
from pathlib import Path
import sys, json, zlib, hashlib
sys.path.insert(0, '/Users/zoumutou/coding/猫咪森活/.tools/esp-idf/components/nvs_flash/nvs_partition_tool')
from nvs_parser import NVS_Partition
out=Path(__file__).resolve().parent
raw=(out/'private-evidence/device-nvs-before.bin').read_bytes()
nvs=NVS_Partition('captured-existing',bytearray(raw))
written=[e for p in nvs.pages for e in p.entries if e.state=='Written']
names={e.data['value']:e.key for e in written if e.metadata['namespace']==0 and e.metadata['type']=='uint8_t'}
entries=[e for e in written if names.get(e.metadata['namespace'])=='cf_local2' and e.key=='state']
indexes=[e for e in entries if e.metadata['type']=='blob_index']
if len(indexes)!=1:raise SystemExit('Ambiguous current index')
index=indexes[0];blob=b''
for i in range(index.data['chunk_count']):
    chunks=[e for e in entries if e.metadata['type']=='blob_data' and e.metadata['chunk_index']==index.data['chunk_start']+i]
    if len(chunks)!=1:raise SystemExit('Ambiguous chunk')
    e=chunks[0]
    if e.metadata['crc']['original']!=e.metadata['crc']['computed'] or e.metadata['crc']['data_original']!=e.metadata['crc']['data_computed']:raise SystemExit('NVS CRC mismatch')
    blob+=b''.join(bytes(c.raw) for c in e.children)[:e.data['size']]
if len(blob)!=index.data['size'] or blob[:4]!=b'CFL2' or zlib.crc32(blob[:-4])!=int.from_bytes(blob[-4:],'little'):raise SystemExit('Core CRC mismatch')
pos=4
def take(n):
    global pos
    value=blob[pos:pos+n];pos+=n;return value
def number(n):return int.from_bytes(take(n),'little')
def string(n):return take(n).split(b'\0')[0].decode()
def gift():take(16);number(8);number(8);number(1)
schema=number(2);device=string(33);number(1)
snapshot=dict(revision=number(8),hasEpochMs=number(1),epochMs=number(8),scene=number(1),action=number(1),weather=number(1),giftState=number(1),petId=string(65),name=string(25),breed=string(17),food=number(1),mood=number(1),clean=number(1),energy=number(1),health=number(1),coins=number(8))
number(1);client=string(37);seq=number(8);string(65);take(32);number(1);number(8);number(8)
nextevent=number(8);lastack=number(8);count=number(2);peers=number(2);outgoing=number(2);number(8);number(8);string(33);number(1);gift();number(1)
actions=['idle','walk','pet','feed','water','bath','play','sleep'];events=[]
for i in range(count):
    counter=number(8);epoch=number(8);tag=number(1)
    events.append(dict(counter=counter,epochMs=epoch,action='gift' if tag&128 else actions[tag]))
    if tag&128:number(8)
for i in range(peers):gift();number(8);number(1)
for i in range(outgoing):number(1);number(8)
terminal=dict(counter=number(8),status=number(1),action=actions[number(1)],reason=string(41),saveDigest=string(65))
if schema!=3 or pos!=len(blob)-4:raise SystemExit('Unexpected current schema')
phone=json.loads((out/'PHONE-RESULTS.json').read_text());matched=next((r for r in phone['recentResults'] if r['counter']==terminal['counter']),None)
result=dict(source='Existing persistent bytes only, not a live interaction or post-change test',crcValid=True,deviceId=device,clientId=client,lastSeq=seq,lastAck=lastack,nextEvent=nextevent,pending=count,queue=events,snapshot=snapshot,terminal=terminal,phoneTerminalMatched=bool(matched and matched['saveDigest']==terminal['saveDigest'] and matched['reason']==terminal['reason'] and matched['action']==terminal['action']),phoneRecordCount=phone['recordCount'],nvsSha256=hashlib.sha256(raw).hexdigest())
(out/'DEVICE-RESULTS.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
