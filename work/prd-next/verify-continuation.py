from pathlib import Path
import subprocess, os, json, hashlib
from datetime import datetime, timezone
root=Path(__file__).resolve().parent
phone=root/'phone/source'; badge=root/'badge/source'; logs=root/'continuation-evidence';logs.mkdir(exist_ok=True)
env=dict(os.environ, PYTHONUTF8='1', JAVA_HOME='D:/黑客松/mobile-pet/.toolchain/jdk/jdk-21.0.12.1+1', PRD_JSON_JAR='D:/黑客松/mobile-pet/.toolchain/gradle-cache/caches/modules-2/files-2.1/org.json/json/20250517/d67181bbd819ccceb929b580a4e2fcb0c8b17cd8/json-20250517.jar')
commands=[('assets',phone,['python','scripts/build_assets.py']),('phone-focused',phone,['node','--test','--test-concurrency=1',*[f'tests/{name}.test.cjs' for name in ['life-navigation-focused','prd-experience','memorial-backup-focused','native-canonical-focused','life-summary-focused','event-backup','event-browser-storage','native-durable']]]),('badge-day-draw',badge,['python','tests/host_day_draw/run.py']),('badge-live-drag',badge,['python','tests/host_live_drag/run.py'])]
results=[]
for name,cwd,command in commands:
    with (logs/(name+'.log')).open('wb') as out:
        result=subprocess.run(command,cwd=cwd,env=env,stdout=out,stderr=subprocess.STDOUT,timeout=180)
    results.append(dict(name=name,command=command,exitCode=result.returncode,log=name+'.log'))
    print(name,result.returncode,flush=True)
    if result.returncode:break
files=[phone/'web/life-navigation.js',phone/'tests/life-navigation-focused.test.cjs',badge/'main/badge_day_ui.inc',badge/'tests/host_day_draw/test_day_draw.c',badge/'main/badge_pages.c',badge/'main/badge_gesture.c']
report=dict(atUtc=datetime.now(timezone.utc).isoformat(),results=results,sourceHashes={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files},hardwareTested=False,fullRepositoryPassed=False)
(logs/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
raise SystemExit(0 if len(results)==len(commands) and all(x['exitCode']==0 for x in results) else 1)
