#!/usr/bin/env python3
"""Build the isolated candidate using existing workspace toolchain/cache, without installing."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone

root = Path(__file__).resolve().parents[1]
workspace = next(p for p in root.parents if (p/'.tools').is_dir())
evidence = root.parent / 'evidence'
evidence.mkdir(exist_ok=True)
subprocess.run([sys.executable, str(root/'scripts/build_assets.py')], check=True)
java = workspace / '.tools/java/jdk-21.0.12.1+1/Contents/Home'
gradle = workspace / '.tools/gradle-8.9/bin/gradle'
sdk = workspace / '.tools/android-sdk'
assert java.is_dir() and gradle.is_file() and (sdk/'platforms/android-35/android.jar').is_file()
(root/'android/local.properties').write_text('sdk.dir='+str(sdk)+'\n')
build = root/'.build'
build.mkdir(exist_ok=True)
keystore = build/'debug.keystore'
if not keystore.exists():
    subprocess.run([str(java/'bin/keytool'), '-genkeypair', '-keystore', str(keystore), '-storepass', 'android', '-alias', 'androiddebugkey', '-keypass', 'android', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-dname', 'CN=Isolated HTML Debug,O=Local Candidate,C=CN'], check=True, capture_output=True)
env = os.environ.copy()
env.update(JAVA_HOME=str(java), ANDROID_HOME=str(sdk), ANDROID_SDK_ROOT=str(sdk), GRADLE_USER_HOME=str(workspace/'.tools/gradle-home'), ANDROID_USER_HOME=str(build/'android-user'))
offline = '--online' not in sys.argv
with_lint = '--with-lint' in sys.argv
command = [str(gradle), *(['--offline'] if offline else []), '--no-daemon', '--console=plain', ':app:assembleDebug', *([':app:lintDebug'] if with_lint else [])]
with (evidence/'android-build.log').open('w') as log:
    result = subprocess.run(command, cwd=root/'android', env=env, stdout=log, stderr=subprocess.STDOUT)
record = {'atUtc': datetime.now(timezone.utc).isoformat(), 'command': command, 'exitCode': result.returncode, 'offlineGradle': offline, 'lintRequested': with_lint, 'installedOnDevice': False}
if result.returncode == 0:
    apk=root/'android/app/build/outputs/apk/debug/app-debug.apk'
    target=root.parent/'deliverables/catforest-little-moments-0.3.8-debug.apk'
    target.parent.mkdir(exist_ok=True)
    shutil.copy2(apk, target)
    record.update(apk=str(target.relative_to(root.parent)), bytes=target.stat().st_size, sha256=hashlib.sha256(target.read_bytes()).hexdigest(), packageId='com.catforest.htmlcandidate')
(evidence/'android-build.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(record,ensure_ascii=False))
sys.exit(result.returncode)
