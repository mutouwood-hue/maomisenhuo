"""Root-only explicit stages. No selector/NVS/boot writes or automatic retries."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess
import sys
import time

B = Path(__file__).resolve().parent
R = B.parents[3]
P = R / 'artifacts/device-backups/esp-usb-7c0c5f423684/2026-10-16T0802Z-visual038'
STAGES = ('security', 'backup', 'verify-current', 'app-write', 'app-readback', 'verify-protected')
stage = sys.argv[1]
assert stage in STAGES
sha = lambda data: hashlib.sha256(data).hexdigest()

def prior(name):
    x = json.loads((B / (name + '.json')).read_text())
    assert x['returncode'] == 0
    return x

base = [str(R / '.tools/idf-tools/python_env/idf5.5_py3.13_env/bin/python'), '-u', str(B / 'esptool_no_write_retry.py'),
        '--chip', 'esp32s3', '--port', '/dev/cu.usbmodem2101', '--baud', '460800',
        '--before', 'no_reset', '--after', 'no_reset', '--connect-attempts', '3']
keep = ['--flash_mode', 'keep', '--flash_freq', 'keep', '--flash_size', 'keep']
app = None
selection = None
if stage in ('app-write', 'app-readback', 'verify-protected'):
    selection = json.loads((B / 'CANDIDATE.json').read_text())
    gate = json.loads((B / 'review-release.json').read_text())
    assert gate['released'] is True and gate['appSha256'] == selection['sha256']
    for item in gate['independentDecisions']:
        assert sha((R / item['path']).read_bytes()) == item['sha256']
    app = (R / selection['path']).read_bytes()
    assert len(app) == selection['bytes'] and sha(app) == selection['sha256']
    assert 0 < len(app) < 0x800000
    meta = prior('backup')
    assert meta['activeAppOffset'] == 0x820000 and meta['selectorUnchanged']
    assert prior('verify-current')['wholeCurrentImageVerified']
    sectorlen = (len(app) + 4095) & ~4095

if stage == 'security':
    base[base.index('no_reset')] = 'usb_reset'
    base[base.index('460800')] = '115200'
    extra = ['--no-stub', 'get_security_info']
elif stage == 'backup':
    assert prior('security')['sameDeviceSecurityVerified']
    extra = ['read_flash', '--flash_size', '32MB', '--no-progress', '0', '0x20000', str(B / 'fresh-prefix128KiB.bin')]
elif stage == 'verify-current':
    assert prior('backup')['freshPrefixAndLayoutVerified']
    extra = ['verify_flash', *keep, '0', str(B / 'before-prefix.bin'), '0x20000', str(B / 'before-ota0.bin'),
             '0x820000', str(B / 'before-ota1.bin'), '0x1020000', str(B / 'before-assets-tail.bin')]
elif stage == 'app-write':
    expected = bytearray((B / 'before-ota1.bin').read_bytes())
    expected[:len(app)] = app
    expected[len(app):sectorlen] = b'\xff' * (sectorlen - len(app))
    (B / 'expected-ota1.bin').write_bytes(expected)
    extra = ['write_flash', *keep, '--no-progress', '0x820000', str(R / selection['path'])]
elif stage == 'app-readback':
    prior('app-write')
    extra = ['read_flash', '--flash_size', '32MB', '--no-progress', '0x820000', hex(sectorlen), str(B / 'app-sector-readback.bin')]
else:
    assert prior('app-readback')['appAndSectorTailVerified']
    extra = ['verify_flash', *keep, '0', str(B / 'before-prefix.bin'), '0x20000', str(B / 'before-ota0.bin'),
             '0x820000', str(B / 'expected-ota1.bin'), '0x1020000', str(B / 'before-assets-tail.bin')]

j = B / (stage + '.json')
assert not j.exists(), 'An uncertain stage must be investigated; no automatic repeat'
d = {'startedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'stage': stage,
     'argv': base + extra, 'selectorWrite': False, 'nvsWrite': False,
     'appWrite': stage == 'app-write', 'automaticRetry': False}
j.write_text(json.dumps(d, indent=2) + '\n')
start = time.monotonic()
print(json.dumps({'stage': stage, 'status': 'started'}), flush=True)
with (B / (stage + '.log')).open('wb') as f:
    p = subprocess.Popen(base + extra, stdout=f, stderr=subprocess.STDOUT)
    while p.poll() is None:
        try:
            p.wait(timeout=20)
        except subprocess.TimeoutExpired:
            print(json.dumps({'stage': stage, 'elapsedSeconds': round(time.monotonic() - start)}), flush=True)
d.update(returncode=p.returncode, elapsedSeconds=time.monotonic() - start,
         finishedAtUtc=datetime.datetime.now(datetime.timezone.utc).isoformat())
j.write_text(json.dumps(d, indent=2) + '\n')
log = (B / (stage + '.log')).read_text(errors='replace')
print(log[-2000:], flush=True)
assert p.returncode == 0, 'STOP; inspect uncertain stage'

if stage == 'security':
    assert '7c:0c:5f:42:36:84' in log.lower()
    assert 'Secure Boot: Disabled' in log and 'Flash Encryption: Disabled' in log
    d['sameDeviceSecurityVerified'] = True
elif stage == 'backup':
    fresh = (B / 'fresh-prefix128KiB.bin').read_bytes()
    assert len(fresh) == 0x20000
    old = bytearray((P / 'composed-current-fullflash32MiB.bin').read_bytes())
    assert len(old) == 0x2000000
    old[0x820000:0x1020000] = (P / 'expected-ota1-slot8MiB.bin').read_bytes()
    historic = (P / 'post-activation-first128KiB.bin').read_bytes()
    assert fresh[:0x9000] == historic[:0x9000]
    assert fresh[0x11000:] == historic[0x11000:]
    assert sha(fresh[0x8000:0x8c00]) == 'a83d5badd3817619dc7dbd12fda088c39004b91e14413b24d20f2dd0b9097be4'
    # Latest selector is byte-identical to verified038 metadata: copy1 seq2 selects OTA1.
    assert sha(fresh[0x13000:0x14000]) == 'f5ab818d800af4e3e1efd4c91587ff9019dfc243adb0bc2ef0c7eb4a0c9df16d'
    old[:0x20000] = fresh
    current038 = (R / 'artifacts/firmware-local-v3-visual038/deliverables/cat-forest-badge-0.3.8-local3.bin').read_bytes()
    assert sha(current038) == 'fcdd98ee3fdee872abd64737f83f4d3f1077ff0f991a3f55322ed5d5e173625b'
    assert old[0x820000:0x820000 + len(current038)] == current038
    for filename, begin, end in [('before-prefix.bin', 0, 0x20000), ('before-ota0.bin', 0x20000, 0x820000),
                                  ('before-ota1.bin', 0x820000, 0x1020000), ('before-assets-tail.bin', 0x1020000, 0x2000000)]:
        (B / filename).write_bytes(old[begin:end])
    (B / 'composed-before-fullflash32MiB.bin').write_bytes(old)
    d.update(freshPrefixAndLayoutVerified=True, activeAppOffset=0x820000, selectorUnchanged=True,
             physicalReadBytes=len(fresh), freshFullPhysicalRead=False,
             backupMethod='fresh physical prefix + historically verified immutable ranges; full physical digest verification required next',
             backupSha256=sha(old), nvsSha256=sha(fresh[0x9000:0x11000]), nvsDecoded=False)
elif stage == 'verify-current':
    d['wholeCurrentImageVerified'] = True
elif stage == 'app-readback':
    read = (B / 'app-sector-readback.bin').read_bytes()
    assert len(read) == sectorlen and read[:len(app)] == app
    assert read[len(app):] == b'\xff' * (sectorlen - len(app))
    d.update(appAndSectorTailVerified=True, readbackSha256=sha(read), appSha256=sha(app))
elif stage == 'verify-protected':
    d['wholePostImageVerified'] = True
    d['bootPartitionNvsPhySelectorAssetsOtherSlotUnchanged'] = True
j.write_text(json.dumps(d, indent=2) + '\n')
print(json.dumps({k: v for k, v in d.items() if k != 'argv'}, indent=2), flush=True)
