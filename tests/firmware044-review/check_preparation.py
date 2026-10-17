"""Offline source/evidence checks only. Never imports the execution script."""
from pathlib import Path
import ast
import difflib
import hashlib
import json

R = Path.cwd()
D = R / 'artifacts/device-backups/esp-usb-7c0c5f423684'
P = D / '2026-10-16T1145Z-cache043'
B = D / '2026-10-16T1209Z-warm044'
O = R / 'tests/firmware044-review'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
stage_sha = '63eefe77ea88a4bf85a970ffac9f8056d03070b7e4033280c23e00159e2a252d'
wrapper_sha = '14e37af0c6f38c2f4792e0e80d068517b5826263d7bdb6d2a0fa80880fe9b4e4'
assert sha(B / 'run_stage.py') == stage_sha
assert sha(B / 'esptool_no_write_retry.py') == wrapper_sha
assert (B / 'esptool_no_write_retry.py').read_bytes() == (P / 'esptool_no_write_retry.py').read_bytes()
for n in ['run_stage.py', 'esptool_no_write_retry.py']:
    ast.parse((B / n).read_text())
a = (P / 'run_stage.py').read_text()
b = (B / 'run_stage.py').read_text()
reverse = b
for new, old in [
    ('2026-10-16T1145Z-cache043', '2026-10-16T1052Z-3d042'),
    ('verified043 metadata', 'verified042 metadata'),
    ('current043', 'current042'),
    ('artifacts/firmware-visual-integration043/deliverables/cat-forest-badge-0.4.3-exactcache.bin',
     'artifacts/firmware-visual-integration042/deliverables/cat-forest-badge-0.4.2-exact3d.bin'),
    ('905552f2f35dc56942b226e9d8558ae98bf31e0e07765ae0c1ba81ab32e88cc2',
     'b0d1704032c1067455b4355617924dadc63efa20a4ec245189e75d75b99f8bcc')]:
    assert new in reverse
    reverse = reverse.replace(new, old)
assert reverse == a, 'Unexpected operation/gate change'
assert sha(P / 'FINAL-INDEX.json') == '6f5c491d2862426297daf117220c35a0e4822e34957a06a70c736597a7ded9b6'
index = json.loads((P / 'FINAL-INDEX.json').read_text())
assert len(index['files']) == 59
for item in index['files']:
    q = P / item['path']
    assert q.stat().st_size == item['bytes'] and sha(q) == item['sha256'], item['path']
assert json.loads((P / 'verify-protected.json').read_text())['wholePostImageVerified'] is True
assert json.loads((P / 'app-readback.json').read_text())['appAndSectorTailVerified'] is True
image = bytearray((P / 'composed-before-fullflash32MiB.bin').read_bytes())
slot = (P / 'expected-ota1.bin').read_bytes()
assert len(image) == 0x2000000 and len(slot) == 0x800000
image[0x820000:0x1020000] = slot
app_path = R / 'artifacts/firmware-visual-integration043/deliverables/cat-forest-badge-0.4.3-exactcache.bin'
app = app_path.read_bytes()
assert len(app) == 7723088 and sha(app_path) == '905552f2f35dc56942b226e9d8558ae98bf31e0e07765ae0c1ba81ab32e88cc2'
assert image[0x820000:0x820000 + len(app)] == app
for n in ['CANDIDATE.json', 'review-release.json', 'diagnostic_session.py']:
    assert not (B / n).exists(), 'Preparation snapshot changed: ' + n
for n in ['security', 'backup', 'verify-current', 'app-write', 'app-readback', 'verify-protected']:
    assert not (B / (n + '.json')).exists(), 'Stage has already been attempted: ' + n
(O / 'preparation-delta.diff').write_text(''.join(difflib.unified_diff(
    a.splitlines(True), b.splitlines(True), fromfile='043-stage', tofile='044-stage')))
pins = [B / 'run_stage.py', B / 'esptool_no_write_retry.py', B / 'PREPARATION.json',
        P / 'FINAL-INDEX.json', app_path, O / 'check_preparation.py']
report = {
    'scope': 'Offline source/AST and sealed historical file checks, no script imports or hardware calls',
    'allPass': True,
    'allowedPreparationOnly': ['security', 'backup', 'verify-current'],
    'securityResetsAppToRom': True,
    'writeRelease': False,
    'predecessorDeltaExact': True,
    'wrapperByteIdentical': True,
    'all59PriorPinsExact': True,
    'known043ComposedImageSha256NotFreshRead': hashlib.sha256(image).hexdigest(),
    'freshPrefixAndFullPhysicalDigestStillRequired': True,
    'candidateReleaseAndNewHelperStillRequired': True,
    'pins': [{'path': str(q.relative_to(R)), 'bytes': q.stat().st_size, 'sha256': sha(q)} for q in pins]
}
(O / 'preparation-checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False))
