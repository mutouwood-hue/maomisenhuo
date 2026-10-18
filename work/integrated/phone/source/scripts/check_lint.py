#!/usr/bin/env python3
"""Analyze the real Gradle model with bundled SDK lint, without new Maven downloads."""
from pathlib import Path
import json
import os
import subprocess
import sys
import xml.etree.ElementTree as ET

root=Path(__file__).resolve().parents[1]
workspace=next(p for p in root.parents if (p/'.tools').is_dir())
tools=workspace/'.tools'
java=tools/'java/jdk-21.0.12.1+1/Contents/Home'
evidence=root.parent/'evidence'
env=os.environ.copy()
env.update(JAVA_HOME=str(java),ANDROID_HOME=str(tools/'android-sdk'),ANDROID_SDK_ROOT=str(tools/'android-sdk'),GRADLE_USER_HOME=str(tools/'gradle-home'),ANDROID_USER_HOME=str(root/'.build/android-user'))
model_command=[str(tools/'gradle-8.9/bin/gradle'),'--offline','--no-daemon','--console=plain',':app:generateDebugLintReportModel']
with (evidence/'lint-model-build.log').open('w') as log:
    model_result=subprocess.run(model_command,cwd=root/'android',env=env,stdout=log,stderr=subprocess.STDOUT)
if model_result.returncode:
    print('Gradle model generation failed; see lint-model-build.log')
    sys.exit(model_result.returncode)
classpath=os.pathsep.join(map(str,[tools/'android-sdk/cmdline-tools/latest/lib/lint-classpath.jar',tools/'gradle-8.9/lib/groovy-3.0.21.jar']))
command=[str(java/'bin/java'),'-Xmx1024m','-cp',classpath,'com.android.tools.lint.Main','--lint-model',str(root/'android/app/build/intermediates/lint_report_lint_model/debug/generateDebugLintReportModel'),'--variant','debug','--sdk-home',str(tools/'android-sdk'),'--exitcode','--xml',str(evidence/'android-lint.xml'),'--text',str(evidence/'android-lint.txt')]
with (evidence/'android-lint.log').open('w') as log:
    result=subprocess.run(command,env=env,stdout=log,stderr=subprocess.STDOUT)
issues=ET.parse(evidence/'android-lint.xml').getroot().findall('issue') if (evidence/'android-lint.xml').exists() else []
record={'runner':'SDK standalone lint 9.3.0, real AGP-generated debug model; existing Gradle Groovy runtime added to classpath','exitCode':result.returncode,'errors':sum(i.get('severity') in ['Error','Fatal'] for i in issues),'warnings':sum(i.get('severity')=='Warning' for i in issues),'issues':[{'id':i.get('id'),'severity':i.get('severity'),'message':i.get('message')} for i in issues],'standardGradleLint':'not completed; offline Maven kotlin-compiler artifact missing','installedOnDevice':False}
(evidence/'android-lint.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(record,ensure_ascii=False))
sys.exit(result.returncode)
