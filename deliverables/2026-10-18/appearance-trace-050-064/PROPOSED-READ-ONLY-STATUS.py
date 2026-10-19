"""PROPOSAL ONLY. Do not execute without fresh explicit human approval.
The automatic reviewer rejected this active diagnostic request under the
existing no-technical-tests/no-automatic-interaction instruction.
"""
import sys
if '--explicit-user-approved' not in sys.argv:
    raise SystemExit('Not authorized: obtain explicit approval for this exact one-time diagnostic first.')
from pathlib import Path
import serial,time
r=Path(__file__).resolve().parent/'private-evidence'
port=serial.Serial()
port.port='/dev/cu.usbmodem1101'
port.baudrate=115200
port.timeout=.1
port.dtr=False
port.rts=False
data=bytearray()
port.open()
try:
    port.write(b'CFDIAG STATE\nCFDIAG PERF\n')
    deadline=time.monotonic()+3
    while time.monotonic()<deadline and len(data)<65536:
        chunk=port.read(4096)
        if chunk:data.extend(chunk)
finally:
    port.close()
(r/'one-time-approved-state-and-heap.log').write_bytes(data)
