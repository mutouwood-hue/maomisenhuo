from pathlib import Path
import zipfile
root = Path(__file__).resolve().parents[1]
out = root / 'deliverables' / 'warm-paws-town-source.zip'
out.parent.mkdir(exist_ok=True)
excluded = {'node_modules', '.toolchain', 'deliverables', 'www', '.gradle', 'build', '.git'}
with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for path in root.rglob('*'):
        relative = path.relative_to(root)
        if excluded.intersection(relative.parts) or not path.is_file():
            continue
        if path.name == 'local.properties' or path.suffix in {'.jks', '.keystore'}:
            continue
        archive.write(path, Path('mobile-pet') / relative)
print(out)
