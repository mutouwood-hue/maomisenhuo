#!/usr/bin/env python3
"""Host-only tests of the production peer state machine and production core."""
from pathlib import Path
import hashlib,json,subprocess,tempfile,sys
root=Path(__file__).resolve().parents[2]
main=root/'artifacts/firmware-local-v2/source/main'
files=[Path(__file__).with_name('test_peer.c'),main/'local2_peer.c',main/'local2_core.c']
with tempfile.TemporaryDirectory(prefix='catforest-peer-') as tmp:
    exe=Path(tmp)/'peer-test'
    subprocess.run(['cc','-std=c11','-Wall','-Wextra','-Werror','-I',str(main),*[str(p) for p in files],'-o',str(exe)],check=True)
    result=subprocess.run([str(exe)],capture_output=True,text=True)
    if result.returncode:
        print(result.stdout,end="");print(result.stderr,file=sys.stderr);raise SystemExit(result.returncode)
    transport=subprocess.run([sys.executable,str(Path(__file__).with_name('test_transport.py'))],check=True,capture_output=True,text=True)
    print(result.stdout+transport.stdout,end='')
    report={'scope':'pure-C production peer + core, host only; no radio or device execution','passed':(result.stdout+transport.stdout).splitlines(),'sha256':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [*files,main/'local2_peer.h',main/'local2_core.h',Path(__file__).with_name('test_transport.py')]}}
    Path(__file__).with_name('latest-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
