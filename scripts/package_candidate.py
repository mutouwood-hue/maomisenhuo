#!/usr/bin/env python3
"""Package verified local build outputs; never install, connect, or flash."""
from datetime import datetime, timezone
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts/2026-10-15-v03-candidate"
BUILD = ROOT / "firmware/build"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def copy(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)


def main():
    global OUT
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=OUT)
    parser.add_argument('--runtime-report', type=Path, action='append', default=[], help='Actual Android report(s); metadata must match this APK')
    parser.add_argument('--supporting-evidence', type=Path, action='append', default=[], help='Additional local evidence; its own APK provenance remains authoritative')
    args = parser.parse_args()
    OUT = args.output_dir.resolve()
    assert OUT.is_relative_to(ROOT / 'artifacts'), 'Output must remain in project artifacts'
    assert OUT.name != '2026-10-15-core-candidate', 'Stable first candidate is frozen; select a new directory'
    apk = ROOT / "app/android/app/build/outputs/apk/debug/app-debug.apk"
    layout = json.loads((BUILD / "flasher_args.json").read_text())
    regression = json.loads((ROOT / "tests/protocol/latest-report.json").read_text())
    builds = json.loads((ROOT / "logs/build-result.json").read_text())
    assert builds["status"] == "passed" and all(c["exitCode"] == 0 for c in builds["checks"])
    for name, expected in builds["sourceSha256"].items():
        assert digest(ROOT / name) == expected, f"Build evidence is stale: {name}"
    assert regression["success"] and not regression["skipped"], "Incomplete host regression"
    for name, expected in regression["inputSha256"].items():
        assert digest(ROOT / name) == expected, f"Regression evidence is stale: {name}"
    with zipfile.ZipFile(apk) as archive:
        for asset in (ROOT / "app/android/app/src/main/assets").iterdir():
            if asset.is_file():
                assert archive.read("assets/" + asset.name) == asset.read_bytes(), asset.name
    copy(apk, OUT / "catforest-android-0.3.0-debug.apk")
    for offset, name in layout["flash_files"].items():
        relative = Path(name)
        assert not relative.is_absolute() and ".." not in relative.parts
        copy(BUILD / relative, OUT / "firmware" / relative)
    for name in ["cat_forest_badge.elf", "project_description.json"]:
        copy(BUILD / name, OUT / "firmware" / name)
    (OUT / "firmware/firmware-layout.json").write_text(json.dumps({
        "purpose": "Address metadata only; no device write is authorized by this package",
        "flash_files": layout["flash_files"],
        "flash_settings": layout["flash_settings"],
        "target": "esp32s3",
    }, ensure_ascii=False, indent=2) + "\n")
    for name in ["android-build.log", "firmware-build.log", "apk-verification.txt", "firmware-image-info.txt", "firmware-size.txt", "host-regression.txt", "lifecycle-regression.txt", "local-life-regression.txt", "gesture-regression.txt", "phone-feedback-regression.txt", "build-result.json"]:
        copy(ROOT / "logs" / name, OUT / "evidence" / name)
    for name in ["tests/protocol/latest-report.json", "tests/local-life/latest-report.json", "tests/visual/latest-browser-report.json", "tests/visual-round2/bridge-report.json", "tests/integration-review.md", "tests/integration-review-round2.md", "tests/integration-review-round3.md", "docs/development-status.md", "docs/build-environment.md", "docs/android-emulator-environment.md", "docs/hardware-acceptance.md", "firmware/UI-COVERAGE.md", "firmware/dependencies.lock", "firmware/sdkconfig", "firmware/main/assets/OFL-1.1.txt", "firmware/main/assets/FONT-PROVENANCE.txt"]:
        copy(ROOT / name, OUT / "evidence" / name)
    runtime = []
    for path in args.runtime_report:
        path = path.resolve(strict=True)
        assert path.is_relative_to(ROOT / 'tests/android-runtime/artifacts'), 'Only project runtime evidence is supported'
        data = json.loads(path.read_text())
        assert data['metadata']['apkSha256'] == digest(apk), 'Runtime report refers to another APK'
        assert data['metadata']['serial'] == 'emulator-5556', 'Unexpected runtime target'
        target = OUT / 'evidence/android-runtime' / path.parent.name
        assert not target.exists(), 'Duplicate runtime evidence directory'
        shutil.copytree(path.parent, target)
        runtime.append({'report': str((target / path.name).relative_to(OUT)), 'status': data['status'], 'cases': [{'name': row['name'], 'status': row['status']} for row in data['cases']]})
    supporting = []
    for path in args.supporting_evidence:
        path = path.resolve(strict=True)
        assert path.is_dir() and path.is_relative_to(ROOT / 'tests/android-runtime/artifacts'), 'Only local runtime evidence directories are supported'
        target = OUT / 'evidence/supporting' / path.name
        assert not target.exists(), 'Duplicate supporting evidence directory'
        shutil.copytree(path, target)
        supporting.append({'directory': str(target.relative_to(OUT)), 'qualification': 'Consult per-file/source metadata. Historical APK evidence does not qualify the current APK.'})
    for name in ['docs/device-backup-recovery.md', 'docs/runtime-blocker-handoff.md', 'docs/phone-rain-source-review.md', 'tests/feedback-review/review.md']:
        copy(ROOT / name, OUT / 'evidence' / name)
    for name in ['qa-rain-frames-exact.log', 'qa-wipe-frames-exact.log', 'qa-rain-startle-frames.log', 'qa-feed-frames-exact.log']:
        if (ROOT / 'logs' / name).is_file():
            copy(ROOT / 'logs' / name, OUT / 'evidence/video-frame-timestamps' / name)
    excluded = {"build", "managed_components", ".gradle", "__pycache__", ".git", ".tools", "artifacts", "logs", ".DS_Store", "sdkconfig.old", "local.properties"}
    sources = []
    for directory in ["app", "firmware", "protocol", "scripts", "tests", "docs", "assets"]:
        sources += [p for p in (ROOT / directory).rglob("*") if p.is_file() and not excluded.intersection(p.relative_to(ROOT).parts)]
    sources += [p for p in ROOT.iterdir() if p.is_file() and (p.name in {"README.md", ".gitignore"} or p.suffix in {".html", ".zip"})]
    assert all(p.suffix not in {".jks", ".keystore", ".key", ".pem"} for p in sources)
    with zipfile.ZipFile(OUT / "candidate-source.zip", "w", zipfile.ZIP_DEFLATED) as archive:
        for p in sorted(set(sources)):
            archive.write(p, p.relative_to(ROOT))
    manifest = {
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "version": "0.3.0-core-candidate",
        "scope": "Local care, wardrobe, inventory, original outdoor/clinic and one-badge BLE candidate; complete PRD and physical-device acceptance remain incomplete",
        "validation": {"androidBuild": "passed", "apkSignature": "v2 verified", "apkDerivedAssets": "byte-identical", "firmwareTargetBuild": "passed", "hostRegression": {"passed": regression["testsRun"], "skipped": 0}, "androidEmulator": runtime or 'not included', "physicalAndroid": "not performed", "realBle": "not performed", "flashing": "not performed"},
        "supportingEvidence": supporting,
        "sourceSha256": {str(p.relative_to(ROOT)): digest(p) for p in sorted(set(sources))},
        "files": {str(p.relative_to(OUT)): {"bytes": p.stat().st_size, "sha256": digest(p)} for p in sorted(OUT.rglob("*")) if p.is_file() and p.name not in {"manifest.json", "SHA256SUMS"}},
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    (OUT / "SHA256SUMS").write_text("".join(f"{digest(p)}  {p.relative_to(OUT)}\n" for p in sorted(OUT.rglob("*")) if p.is_file() and p.name != "SHA256SUMS"))
    print(OUT)


if __name__ == "__main__":
    main()
