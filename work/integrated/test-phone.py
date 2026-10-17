from pathlib import Path
import subprocess,os
root=Path(__file__).resolve().parents[2]
logs=root/'work/integrated/phone/evidence';logs.mkdir(parents=True,exist_ok=True)
env=dict(os.environ,JAVA_HOME='D:/黑客松/mobile-pet/.toolchain/jdk/jdk-21.0.12.1+1',PRD_JSON_JAR='D:/黑客松/mobile-pet/.toolchain/gradle-cache/caches/modules-2/files-2.1/org.json/json/20250517/d67181bbd819ccceb929b580a4e2fcb0c8b17cd8/json-20250517.jar',PYTHONUTF8='1')
env['NODE_PATH']=str(root/'work/prd-next/phone/source/node_modules')
node=os.environ.get('NODE_EXE','node')
command=[node,'--test','--test-concurrency=1',*[f'tests/{x}.test.cjs' for x in ['life-navigation-focused','prd-experience','memorial-backup-focused','native-canonical-focused','life-summary-focused','event-backup','event-browser-storage','native-durable','care-handshake','trial-analytics','day-hearts']]]
with (logs/'focused.log').open('wb') as output:
    result=subprocess.run(command,cwd=root/'app',env=env,stdout=output,stderr=subprocess.STDOUT)
print('focused exit:',result.returncode)
raise SystemExit(result.returncode)
