#!/usr/bin/env python3
"""Compile only the production pure Kotlin rules and this host test; no Android build."""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "app/android/app/src/main/java/com/catforest/app/LocalLifeRules.kt"
TEST = Path(__file__).with_name("LocalLifeRulesTest.kt")
JAVA = next((ROOT / ".tools/java").glob("*/Contents/Home/bin/java"))
LIB = ROOT / ".tools/gradle-8.9/lib"
JSON = ROOT / ".tools/downloads/json-20240303.jar"
CP = ":".join(map(str, [JSON, *LIB.glob("kotlin-stdlib*.jar")]))
with tempfile.TemporaryDirectory(prefix="catforest-local-life-") as temp:
    compile_run = subprocess.run([str(JAVA), "-cp", str(LIB / "*"), "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-no-stdlib", "-no-reflect", "-classpath", CP, "-d", temp, str(SOURCE), str(TEST)], capture_output=True, text=True, timeout=120)
    print(compile_run.stdout + compile_run.stderr, end="")
    compile_run.check_returncode()
    run = subprocess.run([str(JAVA), "-cp", temp + ":" + CP, "LocalLifeRulesTestKt"], capture_output=True, text=True, timeout=30)
    print(run.stdout + run.stderr, end="")
    report = {"productionSource": str(SOURCE.relative_to(ROOT)), "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(), "testSha256": hashlib.sha256(TEST.read_bytes()).hexdigest(), "passed": run.stdout.count("PASS "), "exitCode": run.returncode, "output": run.stdout + run.stderr, "scope": "Production pure Kotlin helper host execution only; not APK, AtomicFile, renderer, BLE, firmware or hardware acceptance."}
    Path(__file__).with_name("latest-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    run.check_returncode()
