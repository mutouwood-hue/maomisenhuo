# Protocol regression and hardware acceptance

Run from the project root:

```sh
python3 -m unittest discover -s tests/protocol -p 'test_*.py' -v
```

To retain a dated JSON report with exact production-source hashes:

```sh
bash scripts/android-env.sh python3 tests/protocol/run_regression.py --require-all
```

The project wrapper selects the existing verified JDK. The default output is `tests/protocol/latest-report.json`. `--require-all` treats missing dependencies/skipped classes as an incomplete regression, and returns a failure exit status. The report explicitly excludes real-device acceptance. With Java/Kotlin environment variables already configured, invoking the Python runner directly is equivalent.

The Python tests require only Python 3's standard library. The production firmware RX-loop tests also require an existing `cc` compiler and write temporary build products outside the repository. State tests compile **the production `firmware/main/badge_state.c`** against the real cJSON source with controlled host substitutes for ESP clock, mutex, MAC and NVS. Point at the cJSON source in the downloaded ESP-IDF tree when it is not found automatically:

```sh
CJSON_DIR=/absolute/path/to/cJSON python3 -m unittest discover -s tests/protocol -p 'test_*.py' -v
```

Missing compiler/cJSON produces an explicit skipped class. A skipped test is not evidence of correctness. No SDK is installed, no Bluetooth permission is granted, no GATT session is opened and no device storage is written by this suite.

`test_android_state.py` also executes the production Kotlin `PetStore.kt` when an existing Java/Kotlin compiler and the JVM `org.json` jar are available. It uses controlled host `Context.filesDir` and `AtomicFile` adapters so that write failures and independent process restarts are reproducible. Android framework storage behavior remains a device/instrumentation concern. Configure existing tools as necessary:

```sh
JAVA_HOME=/existing/jdk JSON_JAR=/existing/json.jar KOTLINC=/existing/kotlinc \
  python3 -m unittest discover -s tests/protocol -p 'test_*.py' -v
```

An existing Gradle distribution's compiler jars can be selected instead with `KOTLIN_COMPILER_CLASSPATH='/existing/gradle/lib/*'`; `kotlinc` need not be installed separately. The test auto-detects Gradle Kotlin jars and `json-*.jar` under the project `.tools` directory. Missing tools are explicitly skipped; this suite never downloads them.

## Scope

| Layer | What the tests establish | What remains outside the test |
| --- | --- | --- |
| Frozen contract oracle and shared fixtures | Strict number/range validation, LF and UTF-8 byte limits, split/coalesced recovery, event-once expectations and commit failure semantics | Oracle passing alone does not prove either production endpoint |
| Production firmware RX loop compiled on host | Actual source byte framing, every UTF-8 split point, exact 2048-byte boundary, oversize/NUL recovery | NimBLE callback/radio, encryption and actual cJSON validation |
| Production firmware state source with real cJSON | Snapshot/revision protection, durable event sequence, queue bounds, simulated commit failures, ACK removal and restart | Real NVS crash behavior, concurrency timing, target compiler/ABI and physical flash |
| Android production state with JVM org.json | Executes production Kotlin state methods: real save/restore, dedup after restart, mood clamp, typed fields, commit failure, corrupt save protection | Host Context/AtomicFile are substitutes; Android device lifecycle, Android AtomicFile and actual GATT require platform testing |

The contract is [`protocol/v1/README.md`](../protocol/v1/README.md). Test expectations are derived from that document. Tests must fail on a protocol regression instead of silently accepting a different production result. The fixture and oracle tests are development tools, never the final acceptance substitute.

## Required real-device record

For the Android phone and one approved flashed badge, record exact APK/firmware hash, model/OS, board markings, port and time. The user must grant Android Bluetooth permission and confirm pairing; hardware flashing needs explicit approval. Verify pairing/passkey, actual snapshot display and tap input, lost connection and reconnect, app/process restart and badge reboot, offline queue replay without repeated rewards, persistence/backup restore, rejected-message recovery, full queue feedback, display/touch orientation, memory and power observations. Check state on both endpoints after each recovery. The second badge and two-device social flow require separate later acceptance; availability of one board cannot establish it.
