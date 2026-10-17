from pathlib import Path
import json,hashlib,re,tarfile,xml.etree.ElementTree as ET,struct
R=Path(__file__).resolve().parents[2];H=Path(__file__).resolve().parent;D=R/'artifacts/device-integration/2026-10-16-ui021';C=R/'artifacts/html-offline-candidate/ui021'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rows(name):return [dict(n.attrib) for n in ET.parse(D/(name+'.xml')).iter('node')]
def text(name):return [n.get('text','') for n in rows(name)]
def rect(s):return list(map(int,re.findall(r'\d+',s)))
def area(a,b):return max(0,min(a[2],b[2])-max(a[0],b[0]))*max(0,min(a[3],b[3])-max(a[1],b[1]))
names=['normal-bath-first','short-bath-first','normal-bath-after-tip-window','short-bath-tip-expired','normal-bath-view-switched','short-bath-view-switched','normal-bath-cancelled','short-bath-cancelled','short-recall-start','normal-recall-active','short-recall-active','normal-recall-actually-active','short-recall-stable-recorded','short-recall-result','normal-recall-actually-stable','normal-recall-result','normal-badge-disconnected-icons','cold-start-preserved','short-event-neutral-choice','normal-rain-neutral-choice','normal-meet-icons','short-meet-buttons-icons','short-badge-icons']
evidence={}
for n in names:
 p=D/(n+'.png');wh=struct.unpack('>II',p.read_bytes()[16:24]);evidence[n]={'pngSha256':sha(p),'xmlSha256':sha(D/(n+'.xml')),'physicalPixels':wh,'reviewerViewedPixels':True}
separation={}
for profile in ['normal','short']:
 n=profile+'-bath-first';rs=rows(n);tip=next(r for r in rs if r.get('text')=='双指拖动可以转视角');notice=next(r for r in rs if r.get('resource-id')=='action-status' and r.get('text')=='洗香香…');a,b=rect(tip['bounds']),rect(notice['bounds']);assert area(a,b)==0
 separation[profile]={'tip':a,'notice':b,'intersectionPixelsSquared':0,'verticalGapPixels':b[1]-a[3]}
 for suffix in (['-bath-after-tip-window'] if profile=='normal' else ['-bath-tip-expired']):
  ts=text(profile+suffix);assert '双指拖动可以转视角' not in ts and '洗香香…' in ts
 ts=text(profile+'-bath-cancelled');assert not any('洗香香' in t or '双指拖动可以转视角' in t or t=='先休息' for t in ts)
for n in ['short-recall-active','short-recall-stable-recorded','normal-recall-actually-active','normal-recall-actually-stable']:assert '召回小猫' in text(n)
for n in ['short-recall-result','normal-recall-result']:assert '自由活动' in text(n) and '小猫听见你了，点击地面继续带路。' in text(n)
assert '蝴蝶停在花上' in text('short-recall-start') and '召回小猫' not in text('short-recall-start')
assert '忽然飘来小雨' in text('normal-recall-active') and '召回小猫' not in text('normal-recall-active')
install=json.loads((D/'install.json').read_text());manifest=json.loads((C/'manifest.json').read_text());assert install['returnCode']==0 and install['clearData']==False and install['grantPermissions']==False
assert install['apkSha256']==manifest['apk']['sha256'] and install['installedApkReadback'].split()[0]==manifest['apk']['sha256']
assert install['byteIdentical'] and install['beforeSavedFiles']==install['afterSavedFiles']
# Hash archived file streams only; do not decode saves, authority receipts or private keys.
archives=[]
for filename,key in [('before-021-app-data.tar','beforeSavedFiles'),('after-install-before-launch.tar','afterSavedFiles')]:
 with tarfile.open(D/filename) as t:
  for name,expected in install[key].items():assert hashlib.sha256(t.extractfile(name).read()).hexdigest()==expected
 archives.append({'file':filename,'recordedStorageFilesVerified':len(install[key]),'sha256':sha(D/filename)})
actions=json.loads((D/'actions.json').read_text());timeline=[{k:v for k,v in a.items() if k in ['atUtc','snapshot','tap']} for a in actions if a.get('snapshot') in names or a.get('tap') in ['先休息','换个视角','安静绕过去','在树荫旁避雨','自由活动','召回小猫','回家']]
result={'kind':'read_only_independent_review_of_root_device_captures','apkSha256':install['apkSha256'],'installRecordSha256':sha(D/'install.json'),'installStorageByteEqualityRecheckedFromArchiveStreams':archives,'separation':separation,'viewed':evidence,'timeline':timeline,'limits':['static PNG/XML does not prove absence of transient250ms flicker','MP4 files not reviewed/decoded here; AVAsset exact-frame review belongs to root','install readback is root record crosschecked against candidate; reviewer did not query device','archive hash agreement applies before launch; no post-game storage or receipt/clock/FIFO inference']}
(H/'actual-device-evidence.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'viewedPNGAndXML':len(names),'separation':separation,'verifiedArchiveFilesPerSnapshot':len(install['beforeSavedFiles'])},indent=2))
