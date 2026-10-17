from pathlib import Path
import json,hashlib,zipfile,re,struct,subprocess,shlex
R=Path(__file__).resolve().parents[2];T=Path(__file__).resolve().parent;N=R/'artifacts/firmware-local-v3-perf037';B=R/'artifacts/firmware-local-v3-perf036';S=N/'source';LV=R/'firmware/managed_components/lvgl__lvgl';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
m=json.loads((N/'manifest.json').read_text());f=json.loads((N/'FROZEN.json').read_text());hs=json.loads((N/'source-hashes.json').read_text());old=json.loads((B/'source-hashes.json').read_text());delta=json.loads((N/'SOURCE-DELTA.json').read_text())
assert len(hs)==107 and len(old)==107;assert f['runtimeSourceWritesStopped'] and not f['deviceTouched'];assert sha(N/'manifest.json')==f['manifestSha256'];assert sha(N/'source-hashes.json')==f['sourceHashesSha256']
assert all(sha(S/p)==h for p,h in hs.items());assert all(sha(B/'source'/p)==h for p,h in old.items())
expected={'app':'22392ed66544e517277550cb2facc4a2c8ea865641e8624e47eb73ab5b5cc9e9','elf':'c9d07eeb37d60d5afddc347973452388e13505fdbd890e6477dfbfa2f557c753','sourceZip':'088e4cfae7583be7667344cc4cba46759df29b51ef669613885fe1e054aed2f7'}
for k,want in expected.items():
 p=N/m[k]['path'];assert sha(p)==m[k]['sha256']==want
 if 'bytes' in m[k]:assert p.stat().st_size==m[k]['bytes']
raw=(N/m['app']['path']).read_bytes();assert raw[0]==0xe9 and struct.unpack_from('<I',raw,32)[0]==0xabcd5432 and struct.unpack_from('<I',raw,36)[0]==0 and raw[48:80].split(b'\0')[0]==b'0.3.7-local3';assert len(raw)<0x800000;assert raw[176:208].hex()==m['elf']['sha256']
with zipfile.ZipFile(N/m['sourceZip']['path']) as z:
 assert len(z.namelist())==len(set(z.namelist()));source_count=0
 for i in z.infolist():
  assert not i.filename.startswith('/') and '..' not in Path(i.filename).parts
  p=(R/i.filename) if i.filename.startswith('tests/firmware037-worker/') else N/i.filename
  assert p.is_file() and z.read(i)==p.read_bytes(),i.filename
  if i.filename.startswith('source/'):
   source_count+=1;assert hashlib.sha256(z.read(i)).hexdigest()==hs[i.filename[7:]]
 assert source_count==107;zip_count=len(z.namelist())
changed=sorted(p for p in hs if p not in old or hs[p]!=old[p]);assert set(changed)=={d['path'] for d in delta['deltas']};assert all(hs[d['path']]==d['candidateSha256'] and old.get(d['path'])==d['baseSha256'] for d in delta['deltas'])
assert not set(old)-set(hs);
page=(S/'main/badge_pages.c').read_text()
for before,after in [('set_label(home_hint,"轻点唤醒",face ? 438 : 390)','set_label(home_hint,"轻点唤醒",390)'),('hide(face_phase,mode==MODE_AOD || mode==MODE_OFF || (low && face==0))','hide(face_phase,low && face==0)')]:
 assert page.count(before)==1;page=page.replace(before,after,1)
assert page==(B/'source/main/badge_pages.c').read_text()
assert (S/'CMakeLists.txt').read_text()==(B/'source/CMakeLists.txt').read_text().replace('0.3.6','0.3.7')
assert (S/'tools/host_preview/preview.c').read_text()==(B/'source/tools/host_preview/preview.c').read_text().replace('firmware-local-v3-perf036','firmware-local-v3-perf037')
assert [p for p in changed if p.startswith('main/')]==['main/badge_pages.c'];assert len([p for p in old if p.startswith('main/')])==51
assert set(changed)=={'main/badge_pages.c','CMakeLists.txt','tools/host_preview/preview.c'}
for p in ['sdkconfig','sdkconfig.defaults','partitions.csv','dependencies.lock','cmake/private-bsp-integrity.cmake']:
 assert hs[p]==old[p]
assert (N/'build/partition_table/partition-table.bin').read_bytes()==(B/'build/partition_table/partition-table.bin').read_bytes()
for path,h in m['testEvidenceSha256'].items():assert sha(N/'evidence'/path)==h
# Validate every explicit source/ABI/lifecycle/allocator pin independently.
cm=(S/'cmake/private-mask-override.cmake').read_text();pins=[]
for rel,expected in re.findall(r'file\(SHA256 "\$\{CMAKE_CURRENT_LIST_DIR\}/\.\./([^"]+)" cf_mask_dependency_sha\)\s*if\(NOT cf_mask_dependency_sha STREQUAL "([0-9a-f]{64})"\)',cm):
 assert sha(S/rel)==expected; pins.append({'path':rel,'sha256':expected})
assert len(pins)==6;assert sha(LV/'src/draw/sw/lv_draw_sw_mask.c')=='e1f852a16219644ae2d8a08c8bb49865a6f5af1bb3e2115ec3e423de46675c22';assert (S/'private/lvgl_mask_pool/LICENCE.txt').read_bytes()==(LV/'LICENCE.txt').read_bytes()
commands=json.loads((N/'build/compile_commands.json').read_text());masks=[e for e in commands if Path(e['file']).name=='lv_draw_sw_mask.c'];assert len(masks)==1 and Path(masks[0]['file']).resolve()==(S/'private/lvgl_mask_pool/lv_draw_sw_mask.c').resolve();entry=masks[0];cmd=shlex.split(entry['command']);assert '-DESP_PLATFORM' in cmd and not any('CATFOREST_MASK_POOL_HOST_TEST' in a or 'CF_PRIVATE' in a or 'CF_THREAD_TEST' in a for a in cmd)
actual=json.loads((N/'evidence/actual-mask-compile-command.json').read_text());assert actual==entry
# Compiler writes only this review directory. Preserve real compile flags; strengthen warnings.
obj=N/'build'/cmd[cmd.index('-o')+1];cmd[cmd.index('-o')+1]=str(T/'private-werror.o')
for flag in ['-MF','-MT']:
 if flag in cmd:cmd[cmd.index(flag)+1]=str(T/('private-werror.d' if flag=='-MF' else 'private-werror.o'))
r=subprocess.run(cmd+['-Wall','-Wextra','-Werror'],cwd=entry['directory'],capture_output=True,text=True,timeout=45);(T/'private-target-werror.log').write_text(r.stdout+r.stderr);assert r.returncode==0,r.stderr
compiler=Path(cmd[0]);nm=compiler.with_name(compiler.name.removesuffix('gcc')+'nm');ar=compiler.with_name(compiler.name.removesuffix('gcc')+'ar');size=compiler.with_name(compiler.name.removesuffix('gcc')+'size')
old_entry=next(e for e in json.loads((B/'build/compile_commands.json').read_text()) if Path(e['file']).name=='lv_draw_sw_mask.c');old_cmd=shlex.split(old_entry['command']);old_obj=Path(old_entry['directory'])/old_cmd[old_cmd.index('-o')+1]
def globals(p):
 out=subprocess.check_output([str(nm),'-g','--defined-only',str(p)],text=True);return sorted(l.split()[-1] for l in out.splitlines() if len(l.split())>=3)
assert globals(T/'private-werror.o')==globals(obj)==globals(old_obj)
lib=N/'build/esp-idf/lvgl__lvgl/liblvgl__lvgl.a';members=subprocess.check_output([str(ar),'t',str(lib)],text=True).splitlines();assert sum(Path(x).name=='lv_draw_sw_mask.c.obj' for x in members)==1
nmout=subprocess.check_output([str(nm),'-S','--size-sort',str(N/m['elf']['path'])],text=True);(T/'elf-symbols.txt').write_text(nmout);private_symbols=[]
for l in nmout.splitlines():
 v=l.split()
 if len(v)==4 and v[3].startswith('cf_mask_') and v[2].lower()=='b':private_symbols.append({'name':v[3],'bytes':int(v[1],16)})
assert sum(s['bytes'] for s in private_symbols)==347
sections={}
for v,root in [('036',B),('037',N)]:
 out=subprocess.check_output([str(size),'-A',str(root/json.loads((root/'manifest.json').read_text())['elf']['path'])],text=True);(T/(v+'-elf-sections.txt')).write_text(out);sections[v]={l.split()[0]:int(l.split()[1]) for l in out.splitlines() if len(l.split())==3 and l.split()[0].startswith('.')}
assert sections['037']['.dram0.bss']==sections['036']['.dram0.bss'] and sections['037']['.dram0.data']==sections['036']['.dram0.data']
u=(LV/'src/draw/sw/lv_draw_sw_mask.c').read_text();c=(S/'private/lvgl_mask_pool/lv_draw_sw_mask.c').read_text();mark='    uint32_t y_8th_cnt = 0;';a=u[u.rindex(mark):u.rindex('    lv_free(cir_x);')];b=c[c.rindex(mark):c.rindex('    if(pool_slot<0)lv_free(cir_x);')];assert a==b
assert all(sha(S/p)==h for p,h in hs.items())
report={'kind':'offline_frozen_package_and_target_tu_review','errors':[],'app':m['app'],'elf':m['elf'],'sourceZip':m['sourceZip'],'appEmbeddedElfShaMatches':True,'source107Stable':True,'old036Source107Stable':True,'otherMain50Exact036':True,'zipTotalEntries':zip_count,'changedSourcePaths':changed,'pinnedDependencies':pins,'targetExactlyOneMaskTUAndNoHostMacros':True,'targetWerrorExit':r.returncode,'targetWerrorCommand':cmd+['-Wall','-Wextra','-Werror'],'same11PublicSymbols036':globals(obj),'privateSymbols':private_symbols,'privateBssBytes':347,'actualDramBssDelta':0,'AAcoreSHA256':hashlib.sha256(a.encode()).hexdigest(),'ownerEvidenceHashesVerified':m['testEvidenceSha256'],'sourceHashes':hs,'sourceFrozenManifestSha256':sha(N/'manifest.json')}
(T/'frozen-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['errors','source107Stable','old036Source107Stable','otherMain50Exact036','zipTotalEntries','targetExactlyOneMaskTUAndNoHostMacros','targetWerrorExit','privateBssBytes','actualDramBssDelta']},indent=2))
