from pathlib import Path
import hashlib,json,zipfile,re,subprocess,ctypes as C,statistics
R=Path(__file__).resolve().parents[3];O=Path(__file__).resolve().parent;B=R/'artifacts/firmware-visual-prototype041/float-candidate';REF=B.parent/'reference-r2';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();m=json.loads((B/'manifest.json').read_text());f=json.loads((B/'FROZEN.json').read_text());hs=json.loads((B/'source-hashes.json').read_text());pins={}
assert len(hs)==41 and sha(B/'manifest.json')==f['manifestSha256'] and sha(B/'source-hashes.json')==f['sourcePinsSha256']
for p,h in hs.items():assert sha(B/p)==h;pins[str((B/p).relative_to(R))]=h
for p,h in m['evidencePins'].items():assert sha(B/p)==h;pins[str((B/p).relative_to(R))]=h
z=B/m['sourceZip']['file'];assert z.stat().st_size==180904 and sha(z)==f['sourceZipSha256']==m['sourceZip']['sha256']
with zipfile.ZipFile(z)as q:
 assert len(q.infolist())==42
 for name in q.namelist():assert q.read(name)==(B/name).read_bytes()
for p in [B/'manifest.json',B/'FROZEN.json',B/'source-hashes.json',z]:pins[str(p.relative_to(R))]=sha(p)
assert sha(REF/'manifest.json')==m['referenceR2ManifestSha256'];rh=json.loads((REF/'source-hashes.json').read_text());assert all(sha(REF/p)==h for p,h in rh.items());assert sha(REF/'source/renderer.c')=='a6b04f219b98aab3959b9b58d921ab4dc0f1bb8b4d7f7bece514073f8705252e'
a=(REF/'source/renderer.c').read_text();b=(B/'source/renderer.c').read_text();start='static void raster(';end='bool vr_frame(';assert a[:a.index(start)]==b[:b.index(start)] and a[a.index(end):]==b[b.index(end):]
class Stats(C.Structure):_fields_=[('x',C.c_int),('y',C.c_int),('w',C.c_int),('h',C.c_int),('triangles',C.c_int),('culled',C.c_int),('tested',C.c_uint64),('inside',C.c_uint64),('written',C.c_uint64),('pose_us',C.c_double),('geometry_us',C.c_double),('raster_us',C.c_double),('resident_bytes',C.c_size_t),('fixed_depth',C.c_bool),('cat_bounds',C.c_int*4),('cat_visible',C.c_uint64),('scene_rejected',C.c_uint64*8)]
libs=[];logs=[]
for label,src in [('reference',REF),('float',B)]:
 cmd=['clang','-std=c11','-O2','-Wall','-Wextra','-Werror','-ffp-contract=off','-dynamiclib',str(src/'source/renderer.c'),'-lm','-o',str(O/(label+'.dylib'))];p=subprocess.run(cmd,capture_output=True,text=True);logs.append(p.stdout+p.stderr);assert not p.returncode,p.stderr
 l=C.CDLL(str(O/(label+'.dylib')));l.vr_create.argtypes=[C.c_void_p,C.c_size_t,C.c_char_p,C.c_size_t];l.vr_create.restype=C.c_void_p;l.vr_destroy.argtypes=[C.c_void_p]
 for name in ['vr_color','vr_depth','vr_owner']:getattr(l,name).argtypes=[C.c_void_p];getattr(l,name).restype=C.c_void_p
 l.vr_frame.argtypes=[C.c_void_p,C.c_char_p]+[C.c_double]*4+[C.POINTER(Stats)];l.vr_frame.restype=C.c_bool;l.vr_world_frame.argtypes=[C.c_void_p,C.c_char_p]+[C.c_double]*7+[C.c_bool,C.POINTER(Stats)];l.vr_world_frame.restype=C.c_bool
 libs.append(l)
(O/'build.log').write_text(''.join(logs));data=C.create_string_buffer((B/'reference/pixel-cat.pcat').read_bytes());err=C.create_string_buffer(100);rs=[l.vr_create(data,len(data)-1,err,100)for l in libs];assert all(rs)
d=json.loads((B/'evidence/float-comparison.json').read_text());model={c['id']:c for c in json.loads((B/'evidence/c-cases.json').read_text())};world={c['id']:c for c in json.loads((B/'evidence/world-validation.json').read_text())['casesDetail']}
diffs=[r for r in d['modelCases']if r['rgbDifferentPixels']];chosen=[]
for channel in range(3):
 row=max(diffs,key=lambda r:r['maxChannelStepsRGB565'][channel]);
 if row['id']not in chosen:chosen.append(row['id'])
chosen+=['idle-h90-12','idle-h0-00'];selected=[('model',k,model[k])for k in chosen]+[('world','mat-04',world['mat-04']),('world','bowl-00',world['bowl-00'])];results=[]
for kind,key,case in selected:
 views=[]
 for l,r in zip(libs,rs):
  st=Stats();anim=case['animation'].encode()
  if kind=='model':ok=l.vr_frame(r,anim,case['seconds'],case['heading'],case['lookYaw'],case['lookPitch'],C.byref(st))
  else:ok=l.vr_world_frame(r,anim,case['seconds'],case['heading'],0,0,case['x'],case['z'],case.get('support',0),True,C.byref(st))
  assert ok
  rgb=C.string_at(l.vr_color(r),131072);zv=C.string_at(l.vr_depth(r),131072);own=C.string_at(l.vr_owner(r),65536);views.append((st,rgb,zv,own))
 sa,ra,za,oa=views[0];sb,rb,zb,ob=views[1];assert(sa.x,sa.y)==(sb.x,sb.y);av=C.cast(C.create_string_buffer(ra),C.POINTER(C.c_uint16));bv=C.cast(C.create_string_buffer(rb),C.POINTER(C.c_uint16));az=C.cast(C.create_string_buffer(za),C.POINTER(C.c_uint16));bz=C.cast(C.create_string_buffer(zb),C.POINTER(C.c_uint16));count=0;mx=[0,0,0];dz=0;examples=[]
 for i in range(65536):
  aa,bb=av[i],bv[i]
  if aa!=bb:
   count+=1;steps=[abs((aa>>11)-(bb>>11)),abs(((aa>>5)&63)-((bb>>5)&63)),abs((aa&31)-(bb&31))];mx=[max(a,b)for a,b in zip(mx,steps)];examples.append({'xy':[sa.x+i%256,sa.y+i//256],'reference':aa,'float':bb})
  if oa[i]and ob[i]:dz=max(dz,abs(az[i]-bz[i]))
 rec={'id':key,'kind':kind,'rgbDifferentPixels':count,'coverageDifferentPixels':sum(bool(x)!=bool(y)for x,y in zip(oa,ob)),'ownerDifferentPixels':sum(x!=y for x,y in zip(oa,ob)),'maxChannelStepsRGB565':mx,'maxSharedCoveredDepthDifference':dz,'writtenCountDelta':sb.written-sa.written,'examples':examples[:3]}
 expected=next(x for x in d[kind+'Cases']if x['id']==key)
 for name in ['rgbDifferentPixels','coverageDifferentPixels','ownerDifferentPixels','maxChannelStepsRGB565','maxSharedCoveredDepthDifference','writtenCountDelta']:assert rec[name]==expected[name],(key,name,rec[name],expected[name])
 results.append(rec)
for l,r in zip(libs,rs):l.vr_destroy(r)
# Recompute summaries from every stored row, without rerendering all frames.
assert sum(x['rgbDifferentPixels']for x in d['modelCases'])==24 and sum(x['rgbDifferentPixels']for x in d['worldCases'])==4
assert sum(bool(x['rgbDifferentPixels']or x['writtenCountDelta'])for x in d['modelCases'])==28
ratios=[x['float']/x['reference']for x in d['interleavedHostRasterRounds']];assert statistics.median(ratios)==d['hostRatioMedian']
s=(B/'evidence/renderer-s3.s').read_text();start=re.search(r'^raster:',s,re.M).start();end=re.search(r'^\s*\.size\s+raster,',s[start:],re.M).start()+start;lines=s[start:end].splitlines();calls=[{'line':i+1,'callee':re.search(r'call\d?\s+(\S+)',v).group(1)}for i,v in enumerate(lines)if re.search(r'call\d?\s+',v)];df=[c for c in calls if c['callee']in ['__muldf3','__adddf3','__divdf3','__subdf3']];assert df==[{'line':49,'callee':'__subdf3'}];assert next(c['line']for c in calls if c['callee']=='floorf')==90;assert any(c['line']>600 and c['callee']=='__divsf3'for c in calls)and any(c['line']>600 and c['callee']=='__floatdisf'for c in calls)
report={'decision':'sealed_exploration_metrics_supported_not_exact_not_integrated','sourceZipFiles':42,'sourcePins':41,'evidencePins':len(m['evidencePins']),'runtimeOnlyRasterDeltaVerified':True,'referenceR2TwentyPinsUnchanged':True,'independentlyRenderedSampleCount':len(results),'samples':results,'allStoredSummaryArithmeticRecomputed':True,'strictNonExactFrames':28,'hostMedianRatioRecomputed':statistics.median(ratios),'rasterStaticCallsIndependentlyParsed':calls,'staticCallCountsAreNotCycles':True,'evidenceHashes':pins};(O/'results.json').write_text(json.dumps(report,indent=2)+'\n');print({k:v for k,v in report.items()if k not in ['samples','evidenceHashes','rasterStaticCallsIndependentlyParsed']})
