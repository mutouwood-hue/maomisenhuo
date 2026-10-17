#!/usr/bin/env python3
"""Start the single project AVD detached from a transient build-tool session.

No wipe, snapshot loading, APK installation, permissions or physical devices.
Requires the already prepared official SDK and AVD.
"""
import os
import argparse
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--gpu', choices=['host', 'software', 'swiftshader'], default='host')
args = parser.parse_args()
emulator = ROOT / '.tools/android-sdk/emulator/emulator'
avd_home = ROOT / '.tools/android-user/avd'
assert emulator.is_file()
assert (avd_home / 'CatForest_API35.avd/userdata-qemu.img').is_file(), 'Existing data disk required'
processes = subprocess.check_output(['ps', '-axo', 'pid=,command='], text=True)
for row in processes.splitlines():
    if str(emulator.parent) in row and ('-avd CatForest_API35' in row or '-port 5556' in row):
        raise SystemExit('Project emulator is already running; use existing emulator-5556')
env = os.environ.copy()
env['ANDROID_AVD_HOME'] = str(avd_home)
env['ANDROID_EMULATOR_HOME'] = str(ROOT / '.tools/android-user')
log_path = ROOT / 'logs/android-emulator-resume.log'
log_path.parent.mkdir(exist_ok=True)
command = ['bash', 'scripts/android-env.sh', str(emulator), '-avd', 'CatForest_API35', '-port', '5556', '-cores', '2', '-memory', '1536', '-no-audio', '-no-snapshot', '-no-boot-anim', '-camera-back', 'none', '-camera-front', 'none', '-gpu', args.gpu, '-no-window']
with log_path.open('ab') as log:
    process = subprocess.Popen(command, cwd=ROOT, env=env, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
(ROOT / '.tools/android-user/emulator.pid').write_text(str(process.pid) + '\n')
print(f'Started CatForest_API35 / emulator-5556 PID {process.pid}, GPU {args.gpu}; boot not yet confirmed. Log: {log_path}')
