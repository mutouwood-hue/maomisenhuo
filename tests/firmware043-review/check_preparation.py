from pathlib import Path
import json,hashlib,ast,difflib
R=Path.cwd();D=R/'artifacts/device-backups/esp-usb-7c0c5f423684';P=D/'2026-10-16T1052Z-3d042';B=D/'2026-10-16T1145Z-cache043';O=R/'tests/firmware043-review';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
expected={'run_stage.py':'cb4f0303e0b87a127101770b7655ba4713388bef008e7cd0082bf8acaeb3afb9','diagnostic_session.py':'7a32f845ea04d97bff56390702bac8a5bb73cdc7518666e865485f9849c9a5a2','esptool_no_write_retry.py':'14e37af0c6f38c2f4792e0e80d068517b5826263d7bdb6d2a0fa80880fe9b4e4'}
for n,h in expected.items():assert sha(B/n)==h;ast.parse((B/n).read_text())
assert (B/'diagnostic_session.py').read_bytes()==(P/'diagnostic_session.py').read_bytes();assert (B/'esptool_no_write_retry.py').read_bytes()==(P/'esptool_no_write_retry.py').read_bytes()
a=(P/'run_stage.py').read_text();b=(B/'run_stage.py').read_text();reverse=b
replacements=[("P = R / 'artifacts/device-backups/esp-usb-7c0c5f423684/2026-10-16T1052Z-3d042'","P = R / 'artifacts/device-backups/esp-usb-7c0c5f423684/2026-10-16T0802Z-visual038'"),("(P / 'composed-before-fullflash32MiB.bin')","(P / 'composed-current-fullflash32MiB.bin')"),('expected-ota1.bin','expected-ota1-slot8MiB.bin'),("historic = (P / 'fresh-prefix128KiB.bin')","historic = (P / 'post-activation-first128KiB.bin')"),('must remain identical to verified042 metadata','is byte-identical to verified038 metadata'),('current042','current038'),('artifacts/firmware-visual-integration042/deliverables/cat-forest-badge-0.4.2-exact3d.bin','artifacts/firmware-local-v3-visual038/deliverables/cat-forest-badge-0.3.8-local3.bin'),('b0d1704032c1067455b4355617924dadc63efa20a4ec245189e75d75b99f8bcc','fcdd98ee3fdee872abd64737f83f4d3f1077ff0f991a3f55322ed5d5e173625b')]
# Expected-ota1 references in current write path must not be transformed; only predecessor (P/) reference.
replacements[2]=("(P / 'expected-ota1.bin')","(P / 'expected-ota1-slot8MiB.bin')")
for n,o in replacements:
 assert n in reverse,n;reverse=reverse.replace(n,o)
assert reverse==a,'Unexpected operation/gate changes beyond predecessor baseline'
idx=json.loads((P/'FINAL-INDEX.json').read_text());assert sha(P/'FINAL-INDEX.json')=='c65512f51a7e76f0eed0f458e4989a9b7ae0d537342e7f02f3ce2adbf7b7943e'
for n in ['composed-before-fullflash32MiB.bin','expected-ota1.bin','fresh-prefix128KiB.bin','verify-protected.json','verify-protected.log','app-sector-readback.bin']:
 assert sha(P/n)==idx['files'][n]['sha256']
assert json.loads((P/'verify-protected.json').read_text())['wholePostImageVerified'] is True
app=(R/'artifacts/firmware-visual-integration042/deliverables/cat-forest-badge-0.4.2-exact3d.bin').read_bytes();assert hashlib.sha256(app).hexdigest()=='b0d1704032c1067455b4355617924dadc63efa20a4ec245189e75d75b99f8bcc'
old=bytearray((P/'composed-before-fullflash32MiB.bin').read_bytes());slot=(P/'expected-ota1.bin').read_bytes();assert len(old)==0x2000000 and len(slot)==0x800000;old[0x820000:0x1020000]=slot;assert old[0x820000:0x820000+len(app)]==app
assert not any((B/(n+'.json')).exists() for n in ['security','backup','verify-current','app-write','app-readback','verify-protected'])
(O/'stage-baseline-delta.diff').write_text(''.join(difflib.unified_diff(a.splitlines(keepends=True),b.splitlines(keepends=True),fromfile='042-stage163f',tofile='043-stagecb4f')))
r={'scope':'read-only static/AST and existing baseline file verification; no imports/execution of hardware script','allowedPreparationStages':['security','backup','verify-current'],'securityNote':'security enters ROM using usb_reset; no flash write, but it resets running app/RAM','writeAllowed':False,'reasonWriteBlocked':'043 candidate not frozen/reviewed; exact candidate+independent release+execution SHA gate still required','reverseBaselineDeltaExact042':True,'helperAndWrapperByteIdentical042':True,'predecessor042PhysicalVerifyAndAppReadbackEvidencePinned':True,'known042WholeImageSha256NotFreshRead':hashlib.sha256(old).hexdigest(),'executionArtifacts':[{'path':str((B/n).relative_to(R)),'sha256':h} for n,h in expected.items()],'preparationMetadataSha256':sha(B/'PREPARATION.json'),'scriptSourceSha256':sha(O/'check_preparation.py'),'allPass':True}
(O/'preparation-checks.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(json.dumps(r,ensure_ascii=False))
