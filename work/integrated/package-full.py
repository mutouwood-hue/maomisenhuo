from pathlib import Path
import zipfile, json
root=Path(__file__).resolve().parents[2]
out=root/'artifacts/integrated-delivery';out.mkdir(parents=True,exist_ok=True)
excluded={'node_modules','.gradle','build','build-windows','__pycache__','.git','.DS_Store','preview'}
archive=out/'catforest-integrated-full-source.zip'
count=0
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=3) as z:
    for folder in ['app','firmware']:
        for p in (root/folder).rglob('*'):
            rel=p.relative_to(root)
            if p.is_file() and not excluded.intersection(rel.parts) and p.name not in {'local.properties','debug.keystore'} and p.suffix not in {'.pyc','.apk','.elf','.bin'}:
                z.write(p,rel.as_posix());count+=1
    for folder in ['work/integrated/phone/evidence','work/integrated/badge/evidence']:
        base=root/folder
        if base.exists():
            for p in base.rglob('*'):
                if p.is_file() and p.suffix in {'.log','.md','.json'}:z.write(p,p.relative_to(root).as_posix());count+=1
    p=root/'work/integrated/build-badge-windows.py'
    if p.exists():z.write(p,p.relative_to(root).as_posix());count+=1
    for p in [root/'README.md',root/'protocol/integrated-care-context.md',root/'work/integrated/DELIVERY.md']:
        if p.exists():z.write(p,p.relative_to(root).as_posix());count+=1
with zipfile.ZipFile(archive) as z:
    names=z.namelist();assert len(names)==len(set(names)), 'Duplicate archive paths'
    assert 'app/android/app/src/main/AndroidManifest.xml' in names
    assert 'firmware/main/badge_pages.c' in names
print(json.dumps({'sourceArchive':str(archive),'fileCount':count,'bytes':archive.stat().st_size,'hashCalculated':False,'backupCreated':False},ensure_ascii=False))
