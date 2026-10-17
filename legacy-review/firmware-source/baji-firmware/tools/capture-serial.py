"""Read the badge's serial log for N seconds into a UTF-8 file.

Usage: capture.py PORT OUT_PATH SECONDS

The badge is on a native USB-JTAG/serial port, so the board is reset by toggling RTS
(setDTR False, setRTS True, pause, setRTS False) and the log is read from the start of
boot. Deliberately dependency-light: pyserial only, no shell pipeline.

This is a development aid kept OUTSIDE build/ (which is scratch) so that cleaning scratch
files cannot break the verification flow.
"""
import io
import sys
import time

import serial

port = sys.argv[1] if len(sys.argv) > 1 else "COM3"
out = sys.argv[2] if len(sys.argv) > 2 else "capture.txt"
secs = float(sys.argv[3]) if len(sys.argv) > 3 else 20.0

s = serial.Serial(port, 115200, timeout=0.2)
s.setDTR(False)
s.setRTS(True)
time.sleep(0.12)
s.setRTS(False)
s.reset_input_buffer()

buf = bytearray()
t0 = time.time()
while time.time() - t0 < secs:
    buf += s.read(4096)
s.close()

io.open(out, "w", encoding="utf-8", newline="\n").write(buf.decode("utf-8", "replace"))
print("captured %d bytes" % len(buf))
