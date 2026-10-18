from pathlib import Path
import shutil,difflib,json
r=Path(r'D:/黑客松/新建文件夹/maomishenhuo')
clean=r/'artifacts/lock-clean-fix/badge/source';prd=r/'work/prd-next/badge/source';target=r/'work/integrated/badge/source'
assert target.resolve()==r/'work/integrated/badge/source'
base=(target.parent/'053-original-badge-pages.txt').read_text(encoding='utf-8').splitlines(True)
left=(clean/'main/badge_pages.c').read_text(encoding='utf-8')
right=(prd/'main/badge_pages.c').read_text(encoding='utf-8').splitlines(True)
patches=[]
for group in difflib.SequenceMatcher(None,base,right,autojunk=False).get_grouped_opcodes(3):
    a,b=group[0][1],group[-1][2];c,d=group[0][3],group[-1][4]
    old=''.join(base[a:b]);new=''.join(right[c:d])
    if not old:
        # Insert using unique preceding source line; no guessed locations.
        anchor=''.join(base[max(0,a-2):a]);assert anchor and left.count(anchor)==1
        left=left.replace(anchor,anchor+new,1)
    else:
        assert left.count(old)==1,('overlapping/ambiguous PRD hunk',a,b)
        left=left.replace(old,new,1)
    patches.append({'original_start_line':a+1,'original_end_line':b,'prd_start_line':c+1,'prd_end_line':d})
# Entire approved CLEAN source is the substrate, not PRD's old page/core/wire tree.
if target.exists():
    # Observe existing destination text before explicitly authorized full replacement.
    for p in target.rglob('*'):
        if p.is_file() and p.suffix in {'.c','.h','.inc','.md','.txt','.py','.json','.cmake'}:
            p.read_bytes()
    shutil.rmtree(target)
shutil.copytree(clean,target,symlinks=True,ignore=lambda folder,names:[n for n in names if n=='build' or n.startswith('build-') or n in {'__pycache__','.cache','.pytest_cache'}])
(target/'main/badge_pages.c').write_text(left,encoding='utf-8')
for name in ['badge_gesture.c','badge_gesture.h','badge_day_ui.inc']:
    (target/'main'/name).read_text(encoding='utf-8')
    shutil.copyfile(prd/'main'/name,target/'main'/name)
for name in ['host_live_drag','host_day_draw']:
    dst=target/'tests'/name
    if dst.exists():shutil.rmtree(dst)
    shutil.copytree(prd/'tests'/name,dst)
for name in ['local2_core.c','local2_core.h','local2_wire.c','local2_wire.h','local2_ble.c','badge_ui_targets.h']:
    assert (target/'main'/name).read_bytes()==(clean/'main'/name).read_bytes(),name
assert 'care_icons[5],*care_bath_hint' in left and 'HIT_BATH' in left and 'static bool drag_release' in left
(target.parent/'badge-text-merge.json').write_text(json.dumps({'base':'053 original ZIP text','substrate':str(clean),'prd_hunks':patches,'neighbor_files':'exact original bytes, no hashing','excluded':['build','build-*','__pycache__','.cache','.pytest_cache']},indent=2),encoding='utf-8')
print('READY SOURCE: merged',len(patches),'nonoverlapping textual PRD hunks; neighbor core/wire/BLE/targets intact')
