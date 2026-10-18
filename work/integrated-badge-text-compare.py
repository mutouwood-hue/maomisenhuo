from pathlib import Path
from zipfile import ZipFile
import difflib
r=Path(r'D:/黑客松/新建文件夹/maomishenhuo')
z=r/'artifacts/firmware-visual-delivery053/deliverables/cat-forest-badge-0.5.3-day-startup-source.zip'
with ZipFile(z) as archive:
    names=[n for n in archive.namelist() if n.endswith('/main/badge_pages.c') or n=='main/badge_pages.c']
    assert len(names)==1,names
    base=archive.read(names[0]).decode('utf-8')
out=r/'work/integrated/badge';out.mkdir(parents=True,exist_ok=True)
(out/'053-original-badge-pages.txt').write_text(base,encoding='utf-8')
for name,src in [('clean',r/'artifacts/lock-clean-fix/badge/source/main/badge_pages.c'),('prd',r/'work/prd-next/badge/source/main/badge_pages.c')]:
    text=src.read_text(encoding='utf-8')
    (out/f'053-to-{name}-pages.diff.txt').write_text(''.join(difflib.unified_diff(base.splitlines(True),text.splitlines(True),fromfile='053-original-ZIP',tofile=name)),encoding='utf-8')
    print(name, 'text diff lines', len(list(difflib.unified_diff(base.splitlines(),text.splitlines()))))
