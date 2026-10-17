#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export JAVA_HOME="$PROJECT_ROOT/.tools/java/jdk-21.0.12.1+1/Contents/Home"
export ANDROID_HOME="$PROJECT_ROOT/.tools/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export ANDROID_USER_HOME="$PROJECT_ROOT/.tools/android-user"
export GRADLE_USER_HOME="$PROJECT_ROOT/.tools/gradle-home"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PROJECT_ROOT/.tools/gradle-8.9/bin:$PATH"
if [[ ! -x "$JAVA_HOME/bin/java" ]]; then
  printf '%s\n' "Missing verified project-local JDK; see docs/build-environment.md" >&2
  exit 1
fi
mkdir -p "$ANDROID_USER_HOME" "$GRADLE_USER_HOME" "$PROJECT_ROOT/.tools/signing"
if [[ "$#" -eq 0 ]]; then
  java -version
  gradle --version
else
  exec "$@"
fi
