from pathlib import Path
import hashlib,json,zipfile,re,struct
R=Path(__file__).resolve().parents[2];H=Path(__file__).resolve().parent;N=R/'artifacts/html-offline-candidate/ui022';O=N.parent/'ui021'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
m=json.loads((N/'manifest.json').read_text());f=json.loads((N/'FROZEN.json').read_text());nh=json.loads((N/'source-hashes.json').read_text());oh=json.loads((O/'source-hashes.json').read_text())
for k in ['apk','sourceArchive','versionName','status']:assert m[k]==f[k]
assert all(nh[p]==v for p,v in oh.items() if p.startswith('web/'))
newweb=[p for p in nh if p.startswith('web/') and p not in oh];assert newweb==['web/offline-family-ui.css','web/offline-family-ui.js']
d=json.loads((N/'evidence/adoption/production-family-css.json').read_text());assert d['pass'] and d['softwareNotDevice'];assert len(d['reports'])==6;checks=0
for report in d['reports']:
 md=report['metadata'];assert report['pass'] and all(t['pass'] for t in report['tests']);checks+=len(report['tests']);assert sha(N/'source/web/offline-family-ui.js')==md['uiSha256'];assert sha(N/'source/android/app/src/main/assets/game-03.js')==md['originalGameSha256']
 for style in md['styles']:assert sha(N/'source/web'/style['file'])==style['sha256']
 for t in report['tests']:
  if '48px' in t['name']:assert t['detail']['height']>=48
  if 'contrast' in t['name']:assert t['detail']['ratio']>=4.5
assert checks==183
om=json.loads((O/'manifest.json').read_text());dex=[]
with zipfile.ZipFile(N/m['apk']['path']) as z,zipfile.ZipFile(O/om['apk']['path']) as old:
 for n in z.namelist():
  if re.fullmatch(r'classes\d*\.dex',n):
   a,b=old.read(n),z.read(n);diff=[i for i,(x,y) in enumerate(zip(a,b)) if x!=y];assert len(a)==len(b)
   if diff:
    assert n=='classes2.dex'
    # Expected generated BuildConfig versionName, checksum metadata and versionCode only.
    normalized=bytearray(b);normalized[8:32]=a[8:32]
    v=a.index(b'0.2.1-html-local');assert b[v:v+16]==b'0.2.2-html-local';normalized[v:v+16]=a[v:v+16]
    marker=b'Lcom/catforest/htmlcandidate/BuildConfig;":"';c=a.index(marker)+len(marker);assert b[c- len(marker):c]==marker
    assert re.fullmatch(b'[0-9a-f]{8}',a[c:c+8]) and re.fullmatch(b'[0-9a-f]{8}',b[c:c+8]);normalized[c:c+8]=a[c:c+8]
    strings=[];count,offset=struct.unpack_from('<II',a,56)
    for i in range(count):
     pos=struct.unpack_from('<I',a,offset+4*i)[0]
     while a[pos]&128:pos+=1
     pos+=1;strings.append(a[pos:a.index(b'\0',pos)])
    count,offset=struct.unpack_from('<II',a,64);types=[strings[struct.unpack_from('<I',a,offset+4*i)[0]] for i in range(count)]
    count,offset=struct.unpack_from('<II',a,96)
    configs=[struct.unpack_from('<8I',a,offset+32*i) for i in range(count) if types[struct.unpack_from('<I',a,offset+32*i)[0]]==b'Lcom/catforest/htmlcandidate/BuildConfig;'];assert len(configs)==1
    value=configs[0][7]+9;assert a[value]==12 and b[value]==13;normalized[value]=a[value]
    assert bytes(normalized)==a
   dex.append({'entry':n,'sha256':hashlib.sha256(b).hexdigest(),'byteEqual021':a==b,'changedBytes':len(diff),'differenceScope':'generated BuildConfig version12->13 and0.2.1->0.2.2 plus checksum fields only' if diff else 'none'})
assert dex
prior={}
for version in ['ui020','ui021']:
 base=N.parent/version;v=json.loads((base/'manifest.json').read_text());s=json.loads((base/'source-hashes.json').read_text());assert all(sha(base/'source'/p)==h for p,h in s.items())
 for key in ['apk','sourceArchive']:assert sha(base/v[key]['path'])==v[key]['sha256']
 prior[version]={'sourceCount':len(s),'allSourcesAndDeliverablesStillFrozen':True}
assert all(sha(N/'source'/p)==h for p,h in nh.items())
for file,count in [('targeted-node.tap',19),('independent-node.tap',5)]:
 t=(H/file).read_text();assert re.search(r'^# pass '+str(count)+'$',t,re.M) and re.search(r'^# fail 0$',t,re.M)
r={'status':'pass','kind':'independent_source_package_and_evidence_readback_plus_actual_Node_fixture_execution_not_device','newRuntime':newweb,'all21PriorWebFilesUnchanged':True,'compiledDexComparison021':dex,'ownerFamilyCss':{'profiles':6,'checks':checks,'evidenceSha256':sha(N/'evidence/adoption/production-family-css.json'),'sourceAssociatedAndChecksReadback':True,'notIndependentlyRerunWebKit':True},'executedNodeTests':24,'ownIndependentTests':5,'existingTargetedTests':19,'priorFrozen':prior,'sourceStableAfterTests':True,'manifestSha256':sha(N/'manifest.json'),'FROZENSha256':sha(N/'FROZEN.json')}
(H/'evidence-readback.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(json.dumps(r,ensure_ascii=False,indent=2))
