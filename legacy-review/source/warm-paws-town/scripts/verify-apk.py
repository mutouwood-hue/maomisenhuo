from pathlib import Path
from hashlib import sha256
import zipfile
import json
root = Path(__file__).resolve().parents[1]
apk = root / 'deliverables/warm-paws-town-0.1.0-debug.apk'
with zipfile.ZipFile(apk) as archive:
    names = set(archive.namelist())
    expected = ['index.html','native-bridge.js','ble-local.js','ble-local.css'] + [f'game-{i:02}.js' for i in range(1,7)]
    for filename in expected:
        packaged = archive.read('assets/public/' + filename)
        source = (root / 'www' / filename).read_bytes()
        if packaged != source:
            raise RuntimeError('Packaged asset differs: ' + filename)
    assert 'AndroidManifest.xml' in names
    assert 'classes.dex' in names
report = {'apk': apk.name, 'bytes': apk.stat().st_size, 'sha256': sha256(apk.read_bytes()).hexdigest(), 'assetsVerified': expected, 'scope': 'APK archive and web resources integrity; not device runtime'}
(root/'deliverables/apk-integrity.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
