from pathlib import Path
import sys,subprocess,struct,hashlib,json,zlib,datetime
if datetime.datetime.now(datetime.timezone.utc)>=datetime.datetime(2026,10,18,15,57,tzinfo=datetime.timezone.utc):raise SystemExit("Paused: insufficient time before authorized16:00 UTC deadline")
r=Path('deliverables/2026-10-18/badge-068-soft-color-candidate')
base=[sys.executable,'-m','esptool','--chip','esp32s3','-p','/dev/cu.usbmodem1101','-b','460800','--before','default_reset','--after','hard_reset']
def read(offset,size,name):
    command=base+['read_flash',hex(offset),hex(size),str(r/(name+'.bin'))]
    with(r/('read-'+name+'.log')).open('w')as log:p=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT)
    if p.returncode:raise SystemExit('Read failed: '+name)
    if 'MAC: 7c:0c:5f:42:36:84'not in(r/('read-'+name+'.log')).read_text():raise SystemExit('Unexpected device')
    return(r/(name+'.bin')).read_bytes()
raw=read(0x8000,0x1000,'partition-table-before');parts=[];md5=False
for i in range(0,len(raw),32):
    row=raw[i:i+32];magic=struct.unpack_from('<H',row)[0]
    if magic==0xebeb:md5=hashlib.md5(raw[:i]).digest()==row[16:32];break
    if magic==0xffff:break
    if magic!=0x50aa:raise SystemExit('Unknown partition entry')
    _,kind,sub,offset,size,label,flags=struct.unpack('<HBBII16sI',row)
    parts.append(dict(name=label.split(b'\0')[0].decode(),type=kind,subtype=sub,offset=offset,size=size,flags=flags))
assert md5 and raw==Path('firmware/build/partition_table/partition-table.bin').read_bytes().ljust(4096,b'\xff')
ota=next(p for p in parts if p['type']==1 and p['subtype']==0)
data=read(ota['offset'],ota['size'],'otadata-before');copies=[]
for i in [0,4096]:
    seq=struct.unpack_from('<I',data,i)[0];state,crc=struct.unpack_from('<II',data,i+24);expected=zlib.crc32(data[i:i+4],0xffffffff)&0xffffffff
    copies.append(dict(seq=seq,state=state,crc=crc,expectedCrc=expected,valid=seq!=0xffffffff and state not in [3,4]and crc==expected))
valid=[c for c in copies if c['valid']];assert valid
apps=sorted([p for p in parts if p['type']==0 and 16<=p['subtype']<=31],key=lambda p:p['subtype'])
chosen=max(valid,key=lambda c:c['seq']);target=apps[(chosen['seq']-1)%len(apps)]
header=read(target['offset'],0x1000,'app-header-before');assert header[0]==0xe9 and struct.unpack_from('<I',header,32)[0]==0xabcd5432
before={'version':header[48:80].split(b'\0')[0].decode(),'project':header[80:112].split(b'\0')[0].decode()}
(r/'DEVICE-APP-BEFORE.json').write_text(json.dumps(before,indent=2)+'\n')
image=r/'cat_forest_badge-0.6.8-soft-color.bin';size=image.stat().st_size;assert size<=target['size']
plan={'partitionTableMd5Valid':md5,'matchesBuildLayout':True,'partitions':parts,'otaCopies':copies,'selected':target,'artifact':image.name,'bytes':size,'freeBytes':target['size']-size,'sha256':hashlib.sha256(image.read_bytes()).hexdigest(),'writeScope':'one app partition only; no NVS/otadata/bootloader/partition-table/assets write'}
(r/'FLASH-PLAN.json').write_text(json.dumps(plan,indent=2)+'\n');print(json.dumps({'before':before,'target':target,'bytes':size,'freeBytes':plan['freeBytes']}))
