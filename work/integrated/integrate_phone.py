from pathlib import Path
import shutil,json
ROOT=Path(__file__).resolve().parents[2]
P=ROOT/'work/prd-next/phone/source';N=ROOT/'artifacts/lock-clean-fix/phone/source';OUT=ROOT/'work/integrated/phone';T=OUT/'source'
assert T.resolve()==Path('D:/黑客松/新建文件夹/maomishenhuo/work/integrated/phone/source').resolve()
def excluded(rel):
    parts=rel.split('/')
    return any(x in parts for x in ['node_modules','.gradle','__pycache__','preview','build']) or rel.startswith('android/app/src/main/assets/')
if T.exists():
    raise SystemExit('Target exists; inspect before replacement')
T.mkdir(parents=True)
copied=[]
for f in P.rglob('*'):
    if not f.is_file():continue
    rel=f.relative_to(P).as_posix()
    if excluded(rel):continue
    target=T/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,target);copied.append(rel)
changes=json.loads((OUT/'phone-text-changes.json').read_text(encoding='utf-8'))
for c in changes:
    rel=c['path']
    if c['overlap']:
        assert rel=='android/local.properties','Unresolved business conflict: '+rel
        # 两边同一SDK的转义表现不同；保留PRD可读且有效的正斜杠配置。
        continue
    target=T/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(N/rel,target)
report={'copiedPrdFiles':copied,'neighborChanges':changes,'resolvedConflicts':[{'path':'android/local.properties','resolution':'Same existing SDK; retain PRD forward-slash path'}],'excluded':'node_modules, build, .gradle, __pycache__, preview, generated android assets; assets regenerated'}
(OUT/'integration-files.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('COPIED_PRD',len(copied),'NEIGHBOR_OVERWRITE',len(changes)-1,'LOCAL_CONFIG_RESOLUTION',1)
