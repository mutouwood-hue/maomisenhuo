#!/usr/bin/env python3
"""virtual_fixture host cross-language runner. No Java, radio, SDK NVS or device."""
from pathlib import Path
import subprocess,hashlib,json,sys,shutil
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
SRC=ROOT/'artifacts/firmware-local-v2/source/main'
OLD=ROOT/'artifacts/firmware-local-v2/review/host'
CJ=ROOT/'.tools/esp-idf/components/json/cJSON'
SOURCES=[SRC/'local2_wire.c',SRC/'local2_core.c',SRC/'local2_core.h',SRC/'local2_wire.h',SRC/'local2_store.h',CJ/'cJSON.c',CJ/'cJSON.h',OLD/'stubs/mbedtls/sha256.h',HERE/'wire_cli.c',HERE/'integration.cjs',ROOT/'artifacts/local-ble-adapter/source/js/local-v2-transport.js',ROOT/'artifacts/local-ble-adapter/source/js/cflocal2-adapter.js']
def hashes():return {str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in SOURCES}
before=hashes()
cmd=['clang','-std=c11','-Wall','-Wextra','-I',str(OLD/'stubs'),'-I',str(SRC),'-I',str(CJ),str(SRC/'local2_wire.c'),str(SRC/'local2_core.c'),str(CJ/'cJSON.c'),str(HERE/'wire_cli.c'),'-o',str(HERE/'wire-cli')]
c=subprocess.run(cmd,capture_output=True,text=True)
(HERE/'compile.log').write_text(c.stdout+c.stderr)
report={'evidence':'virtual_fixture','scope':'Real JS transport+adapter ↔ production C wire/core+cJSON; test Native and host disk. Not Java/BLE/SDK NVS/device.', 'compileCommand':cmd,'compileReturncode':c.returncode,'compileWarnings':c.stderr,'sourceSha256':before}
if c.returncode==0:
 node=shutil.which('node') or '/Users/zoumutou/.nvm/versions/node/v22.19.0/bin/node'
 result=subprocess.run([node,str(HERE/'integration.cjs')],cwd=ROOT,capture_output=True,text=True,timeout=60)
 (HERE/'run.log').write_text(result.stdout+result.stderr)
 try:report.update(json.loads((HERE/'scenario-result.json').read_text()))
 except Exception:report['error']=result.stdout+result.stderr
 report['executionReturncode']=result.returncode
else:report['error']='compile failed'
report['sourceStable']=before==hashes()
(HERE/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:report.get(k) for k in ['evidence','passed','failed','sourceStable','compileReturncode','executionReturncode','error']},ensure_ascii=False,indent=2))
sys.exit(0 if c.returncode==0 and report.get('executionReturncode')==0 and report['sourceStable'] else 1)
