from pathlib import Path
import datetime,hashlib,json,subprocess,sys
if datetime.datetime.now(datetime.timezone.utc)>=datetime.datetime(2026,10,18,15,57,tzinfo=datetime.timezone.utc):raise SystemExit("Paused: insufficient time for a safe app-only flash before16:00 UTC")
r=Path('deliverables/2026-10-18/badge-068-soft-color-candidate')
receipt=r/'FLASH-RECEIPT.json'
if receipt.exists():raise SystemExit('Existing flash receipt; inspect it before any further write')
plan=json.loads((r/'FLASH-PLAN.json').read_text());before=json.loads((r/'DEVICE-APP-BEFORE.json').read_text())
assert plan['partitionTableMd5Valid']and plan['matchesBuildLayout']
assert plan['selected']['name']=='ota_1'and plan['selected']['offset']==0x820000 and plan['selected']['size']==0x800000
assert before['project']=='cat_forest_badge'and before['version']=='0.6.7-linear-color'
assert 'MAC: 7c:0c:5f:42:36:84'in(r/'read-app-header-before.log').read_text()
image=r/plan['artifact'];digest=hashlib.sha256(image.read_bytes()).hexdigest()
assert digest==plan['sha256']and image.stat().st_size==plan['bytes']<=plan['selected']['size']
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
command=[sys.executable,'-m','esptool','--chip','esp32s3','-p','/dev/cu.usbmodem1101','-b','460800','--before','default_reset','--after','hard_reset','write_flash','--flash_mode','keep','--flash_freq','keep','--flash_size','keep',hex(plan['selected']['offset']),str(image.resolve())]
info={'startedAtUtc':now(),'applicationOnly':True,'target':plan['selected']['name'],'offset':plan['selected']['offset'],'file':image.name,'bytes':image.stat().st_size,'sha256':digest,'command':command,'writesNvs':False,'writesOtadata':False,'writesPartitionTable':False,'writesBootloader':False,'writesAssetsPartitions':False,'hardwareAcceptance':'not performed; color candidate pending user visual selection'}
receipt.write_text(json.dumps(info,indent=2)+'\n')
with(r/'flash-app-only.log').open('w')as log:p=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT)
log=(r/'flash-app-only.log').read_text();info.update(finishedAtUtc=now(),exitCode=p.returncode,esptoolHashVerified='Hash of data verified.'in log,deployed=p.returncode==0 and 'Hash of data verified.'in log)
receipt.write_text(json.dumps(info,indent=2)+'\n');print(json.dumps(info))
if not info['deployed']:raise SystemExit('Application flash incomplete; inspect receipt and log')

# Only read the normal production startup log after the standard flash reset.
import os,select,time
fd=os.open('/dev/cu.usbmodem1101',os.O_RDONLY|os.O_NOCTTY|os.O_NONBLOCK)
boot=bytearray();deadline=time.monotonic()+14
try:
    while time.monotonic()<deadline and len(boot)<131072:
        ready,_,_=select.select([fd],[],[],.1)
        if ready:
            try:
                chunk=os.read(fd,8192)
                if chunk:boot.extend(chunk)
            except BlockingIOError:pass
finally:os.close(fd)
(r/'production-startup.log').write_bytes(boot)
print('Normal production startup saved; no diagnostic command sent.')
