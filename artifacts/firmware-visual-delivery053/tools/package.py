"""Package the ordinary application build, without running application tests."""
from pathlib import Path
import hashlib,json,shutil,zipfile,stat,difflib,datetime
O=Path(__file__).resolve().parents[1];R=O.parents[1];S=O/'source';B=O.parent/'firmware-visual-delivery052/source'
D=O/'deliverables';D.mkdir(exist_ok=True);H=lambda data:hashlib.sha256(data).hexdigest()
stem='cat-forest-badge-0.5.3-day-startup'
for ext in ('bin','elf'):shutil.copyfile(O/('build/cat_forest_badge.'+ext),D/(stem+'.'+ext))
shutil.copyfile(R/'protocol/2026-10-17-local-care-scenes.md',O/'PROTOCOL.md')
rows=[];changes=[];patch=[]
for p in sorted(S.rglob('*')):
    rel=p.relative_to(S)
    if any(x in {'build','host-build','__pycache__','.DS_Store'} for x in rel.parts):continue
    if p.is_symlink():row={'path':str(rel),'kind':'symlink','target':str(p.readlink())};row['sha256']=H(row['target'].encode())
    elif p.is_file():data=p.read_bytes();row={'path':str(rel),'kind':'file','bytes':len(data),'sha256':H(data)}
    else:continue
    rows.append(row);old=B/rel
    if row['kind']=='file' and (not old.is_file() or H(old.read_bytes())!=row['sha256']):
        changes.append(row)
        if p.suffix in ('.c','.h','.txt','.cmake'):
            patch.extend(difflib.unified_diff(old.read_text(encoding='utf-8').splitlines(True) if old.is_file() else [],p.read_text(encoding='utf-8').splitlines(True),fromfile='052/'+str(rel),tofile='053/'+str(rel)))
(O/'source-hashes.json').write_text(json.dumps(rows,indent=2)+'\n')
(O/'SOURCE-DELTA.json').write_text(json.dumps({'baseline':'052','changedOrAdded':changes},indent=2)+'\n')
(O/'source-delta.patch').write_text(''.join(patch),encoding='utf-8')
z=D/(stem+'-source.zip')
with zipfile.ZipFile(z,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as f:
    for row in rows:
        p=S/row['path']
        if row['kind']=='symlink':
            info=zipfile.ZipInfo('source/'+row['path']);info.create_system=3;info.external_attr=(stat.S_IFLNK|0o777)<<16;f.writestr(info,row['target'])
        else:f.write(p,'source/'+row['path'])
    for name in ('HANDOFF.md','PROTOCOL.md','source-hashes.json','SOURCE-DELTA.json','source-delta.patch','tools/build_offline.py','tools/package.py'):f.write(O/name,name)
    for extra in sorted((O/'evidence').glob('*')):
        if extra.is_file():f.write(extra,'evidence/'+extra.name)
files=[{'path':str(p.relative_to(O)),'bytes':p.stat().st_size,'sha256':H(p.read_bytes())} for p in (D/(stem+'.bin'),D/(stem+'.elf'),z)]
manifest={'version':'0.5.3-day-startup','packagedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baseline':'0.5.2-day-expectation','artifacts':files,'sourceEntries':len(rows),'changedSourceEntries':len(changes),'build':'Ordinary ESP-IDF5.5.5 application build completed','technicalTestsRun':False,'benchmarksRun':False,'automatedApplicationValidation':False,'deviceActions':False,'phoneIntegrationRequired':False,'matchingPhone':'038 code29 preserve-data installed; ordinary startup after053','TEenabled':False,'physicalBoardRevisionVerified':False,'bufferRows':48,'dmaPairFallbackRows':10,'userHardwareAcceptance':'pending','saveReset':False,'slideRefreshIssue':'pending physical acceptance; configured48-row DMA pair and optional TE default OFF; no tests'}
(O/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(O/'FROZEN.json').write_text(json.dumps({'manifestSha256':H((O/'manifest.json').read_bytes()),'sourceHashesSha256':H((O/'source-hashes.json').read_bytes()),'runtimeStopWriting':True},indent=2)+'\n')
print(json.dumps(manifest,indent=2))
