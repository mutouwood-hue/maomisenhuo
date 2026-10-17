from pathlib import Path
import runpy,json,hashlib,types
import esptool.loader as loader
from esptool.loader import ESPLoader
from esptool.util import FatalError
R=Path(__file__).resolve().parents[2];B=R/'artifacts/device-backups/esp-usb-7c0c5f423684/2026-10-16T1052Z-3d042';O=Path(__file__).resolve().parent
# No port object is created. Actual block methods call only injected check_command.
def exercise(method):
 obj=object.__new__(ESPLoader);obj.IS_STUB=True;obj.trace=lambda *a,**k:None;calls=[]
 def rejected(*a,**k):calls.append(1);raise FatalError('independent injected pre-I/O failure')
 obj.check_command=rejected
 try:getattr(obj,method)(b'abcd',0)
 except FatalError:pass
 else:raise AssertionError('failure swallowed')
 return len(calls)
defaults={'wholeImageAttempts':ESPLoader.WRITE_FLASH_ATTEMPTS,'flashBlockAttempts':loader.WRITE_BLOCK_ATTEMPTS};old={k:exercise(k)for k in ['flash_block','flash_defl_block']};assert old=={'flash_block':3,'flash_defl_block':3}
runpy.run_path(str(B/'esptool_no_write_retry.py'),run_name='independent_review_fixture_not_main')
new={k:exercise(k)for k in ['flash_block','flash_defl_block']};assert new=={'flash_block':1,'flash_defl_block':1};assert ESPLoader.WRITE_FLASH_ATTEMPTS==1
r={'scope':'actual installed loader methods, injected FatalError before any device/port I/O','beforeDefaults':defaults,'beforeActualMethodCommandCalls':old,'afterPolicy':{'wholeImageAttempts':ESPLoader.WRITE_FLASH_ATTEMPTS,'flashBlockAttempts':loader.WRITE_BLOCK_ATTEMPTS},'afterActualMethodCommandCalls':new,'wholeImageSerialExceptionLoop':'static verified cmds range now one attempt; no reconnect/flash simulated','wrapperMainNotCalled':True,'deviceActions':False,'pins':{str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest()for p in [B/'esptool_no_write_retry.py',B/'run_stage.py']}};(O/'retry-wrapper-results.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
