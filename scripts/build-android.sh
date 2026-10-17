#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"
SIGNING_FILE="$PROJECT_ROOT/.tools/signing/catforest-debug.keystore"
if [[ ! -f "$SIGNING_FILE" ]]; then
  # Standard local Android debug signing, never a production or account key.
  bash scripts/android-env.sh keytool -genkeypair -keystore "$SIGNING_FILE" -storepass android -alias androiddebugkey -keypass android -dname "CN=Android Debug,O=Android,C=US" -keyalg RSA -keysize 2048 -validity 10000
  chmod 600 "$SIGNING_FILE"
fi
exec bash scripts/android-env.sh gradle -p app/android --no-daemon --max-workers=2 --console=plain "$@" :app:assembleDebug
