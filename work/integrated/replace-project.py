from pathlib import Path
import shutil, zipfile, json
root=Path(__file__).resolve().parents[2]
# User explicitly authorized whole-directory replacement, without backups.
operations=[(root/'work/integrated/phone/source',root/'app'),(root/'work/integrated/badge/source',root/'firmware')]
for source,target in operations:
    assert source.is_dir(),f'Integration not ready: {source}'
    assert target.resolve() in [root/'app',root/'firmware'],f'Unexpected overwrite target: {target}'
    print(f'WHOLE REPLACEMENT: {source} -> {target}',flush=True)
    if target.exists():shutil.rmtree(target)
    shutil.copytree(source,target,ignore=shutil.ignore_patterns('node_modules','.gradle','build','build-windows','__pycache__','.DS_Store'))
shutil.copy2(root/'artifacts/lock-clean-fix/PROTOCOL.md',root/'protocol/integrated-care-context.md')
print('Complete: app and firmware replaced, no backup and no hash calculation.')
