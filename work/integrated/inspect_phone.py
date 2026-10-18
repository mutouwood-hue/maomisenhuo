from pathlib import Path
from zipfile import ZipFile
import difflib,json
ROOT=Path(__file__).resolve().parents[2]
P=ROOT/'work/prd-next/phone/source'; N=ROOT/'artifacts/lock-clean-fix/phone/source'
Z=ROOT/'artifacts/html-offline-candidate/ui038/deliverables/catforest-little-moments-0.3.8-source.zip'
OUT=ROOT/'work/integrated/phone'; OUT.mkdir(parents=True,exist_ok=True)
def excluded(rel):
    parts=rel.split('/')
    return any(x in parts for x in ['node_modules','.gradle','__pycache__','preview','build']) or rel.startswith('android/app/src/main/assets/')
def text(data):
    try:
        s=data.decode('utf-8-sig')
        return None if '\x00' in s else s.replace('\r\n','\n')
    except UnicodeDecodeError: return None
with ZipFile(Z) as z:
    base={i.filename[len('source/'):]:z.read(i) for i in z.infolist() if i.filename.startswith('source/') and not i.is_dir() and not excluded(i.filename[len('source/'):])}
changes=[]; diffs=[]
for f in sorted(N.rglob('*')):
    if not f.is_file(): continue
    rel=f.relative_to(N).as_posix()
    if excluded(rel): continue
    ns=text(f.read_bytes()); bs=text(base[rel]) if rel in base else ''
    if ns is None: continue
    if ns==bs: continue
    ps=text((P/rel).read_bytes()) if (P/rel).exists() else ''
    overlap=ps!=bs and ps!=ns
    changes.append({'path':rel,'new':rel not in base,'prd_changed':ps!=bs,'overlap':overlap,'same':ps==ns})
    if overlap:
        diffs.append('\n### '+rel+' BASE→PRD\n'+''.join(difflib.unified_diff(bs.splitlines(True),ps.splitlines(True),fromfile='base',tofile='prd'))+'\nBASE→NEIGHBOR\n'+''.join(difflib.unified_diff(bs.splitlines(True),ns.splitlines(True),fromfile='base',tofile='neighbor')))
(OUT/'phone-text-changes.json').write_text(json.dumps(changes,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'phone-overlap-diffs.txt').write_text(''.join(diffs),encoding='utf-8')
print(json.dumps(changes,ensure_ascii=False,indent=2));print('OVERLAPS',sum(x['overlap'] for x in changes))
