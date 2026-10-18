"""Assemble the final integrated delivery bundle.

Source: the two project trees now occupying app/ and firmware/ (already the
full overwrite of the neighbour phone + badge work), plus the build products in
work/integrated. No hashes, no backups: the user asked for a fast bundle.

Run: python work/integrated/package-integrated.py
"""
from pathlib import Path
import json
import shutil
import zipfile

root = Path(__file__).resolve().parents[2]
out = root / "artifacts" / "integrated-delivery"
out.mkdir(parents=True, exist_ok=True)

# Vendored ESP-IDF components (230 MB) are reproducible from dependencies.lock
# and are not project source, so they stay out of the source archive.
EXCLUDED_PARTS = {
    "node_modules", ".gradle", "build", "build-windows", "root-build",
    "root-windows-build", "windows-build", "__pycache__", ".git", ".DS_Store",
    "preview", "managed_components",
}
EXCLUDED_NAMES = {"local.properties", "debug.keystore"}
EXCLUDED_SUFFIX = {".pyc", ".apk", ".elf", ".bin", ".map"}

archive = out / "catforest-integrated-full-source.zip"
count = 0
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=3) as z:
    for folder in ("app", "firmware"):
        for p in (root / folder).rglob("*"):
            rel = p.relative_to(root)
            if not p.is_file():
                continue
            if EXCLUDED_PARTS.intersection(rel.parts) or p.name in EXCLUDED_NAMES or p.suffix in EXCLUDED_SUFFIX:
                continue
            z.write(p, rel.as_posix())
            count += 1
    for extra in (
        "README.md",
        "protocol/integrated-care-context.md",
        "work/integrated/DELIVERY.md",
        "work/integrated/DELIVERY-INTEGRATED.md",
        "work/integrated/build-badge-windows.py",
        "work/integrated/package-integrated.py",
        "work/integrated/test-phone.py",
    ):
        p = root / extra
        if p.exists():
            z.write(p, extra)
            count += 1
    for folder in ("work/integrated/phone/evidence", "work/integrated/badge/evidence"):
        base = root / folder
        if not base.exists():
            continue
        for p in base.rglob("*"):
            if p.is_file() and p.suffix in {".log", ".md", ".json"}:
                z.write(p, p.relative_to(root).as_posix())
                count += 1

with zipfile.ZipFile(archive) as z:
    names = z.namelist()
    assert len(names) == len(set(names)), "duplicate archive paths"
    assert "app/android/app/src/main/AndroidManifest.xml" in names
    assert "firmware/main/badge_pages.c" in names
    assert not any(n.startswith("firmware/managed_components/") for n in names)

# Build products travel beside the source archive.
products = {}
apk = root / "app/android/app/build/outputs/apk/release/app-release-unsigned.apk"
bin_image = root / "work/integrated/badge/root-build/cat_forest_badge.bin"
for src, name in ((apk, "catforest-app-release-unsigned.apk"),
                  (bin_image, "cat_forest_badge.bin")):
    if src.exists():
        dst = out / name
        shutil.copy2(src, dst)
        products[name] = dst.stat().st_size

for log in (
    "work/integrated/badge/host-live-drag.log",
    "work/integrated/badge/host-day-draw.log",
    "work/integrated/badge/syntax.log",
    "work/integrated/badge/syntax-results.json",
    "work/integrated/phone/evidence/focused.log",
    "work/integrated/phone/evidence/assets.log",
):
    p = root / log
    if p.exists():
        shutil.copy2(p, out / p.name)

print(json.dumps({
    "sourceArchive": str(archive),
    "sourceFiles": count,
    "sourceBytes": archive.stat().st_size,
    "products": products,
    "excludedFromSource": sorted(EXCLUDED_PARTS),
}, ensure_ascii=False, indent=2))
