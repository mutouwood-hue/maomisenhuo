from pathlib import Path
import hashlib,json,re,xml.etree.ElementTree as E
R=Path(__file__).resolve().parents[3];B=R/'artifacts/device-integration/2026-10-16-ui027-emulator';O=Path(__file__).resolve().parent;C=R/'artifacts/html-offline-candidate/ui027';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();index=json.loads((B/'FINAL-INDEX.json').read_text());s=json.loads((B/'SESSION.json').read_text());pins={};assert len(index['files'])==77
for name,expected in index['files'].items():
 p=B/name;assert p.stat().st_size==expected['bytes'] and sha(p)==expected['sha256'],name;pins[str(p.relative_to(R))]=sha(p)
for row in json.loads((O/'interim-completed-files.json').read_text())['files']:assert sha(R/row['path'])==row['sha256'],row['path']
for p in [B/'FINAL-INDEX.json',C/'manifest.json',C/'FROZEN.json',C/'source-hashes.json',C/'deliverables/catforest-world-demo-0.2.7-debug.apk']:pins[str(p.relative_to(R))]=sha(p)
assert index['sourceCandidateManifestSha256']==sha(C/'manifest.json')
def nodes(stem):return list(E.parse(B/(stem+'.xml')).iter('node'))
def texts(stem):return{n.get('text')for n in nodes(stem)if n.get('text')}
def has(stem,values):assert set(values)<=texts(stem),(stem,set(values)-texts(stem))
dock=['喂食','喝水','洗澡','摸摸','睡觉','更多']
for stem in ['02-home-after-wait','08-garden-return-home','10-back-closes-guide','13-resume-from-home','15-back-street-to-home','18-long-screen-initial','21-short-360x640-home','23-short-guide-back-home','24-restored-physical-size']:has(stem,dock)
for stem in ['03-simulated-unlock-guide','09-guide-reopen','19-long-screen-guide','22-short-360x640-guide']:has(stem,['独立测试档 · 模拟成长','回到小家看看','跳过引导'])
for stem in ['05-street-entry','11-street-before-background','14-street-for-back']:has(stem,['进入原小花园','回到小家'])
has('17-reopen-fresh-fixture',['模拟一次有效相遇']);has('18-long-screen-initial',['模拟一次有效相遇','24'])
for stem in ['12-android-home-background','16-back-home-exit','25-back-exit-final']:assert any(n.get('package')=='com.android.launcher3'for n in nodes(stem))
for profile,stem in zip(s['profiles'],['02-home-after-wait','18-long-screen-initial','21-short-360x640-home']):
 web=next(n for n in nodes(stem)if n.get('class')=='android.webkit.WebView');v=list(map(int,re.findall(r'\d+',web.get('bounds'))));assert v==profile['webViewBounds'];assert[(v[2]-v[0])/2,(v[3]-v[1])/2]==profile['actualCssViewport']
for stem in ['03-simulated-unlock-guide','19-long-screen-guide','22-short-360x640-guide']:
 nd=nodes(stem);web=next(n for n in nd if n.get('class')=='android.webkit.WebView');wb=list(map(int,re.findall(r'\d+',web.get('bounds'))))
 for n in nd:
  if n.get('text')in ['回到小家看看','跳过引导']:
   x1,y1,x2,y2=map(int,re.findall(r'\d+',n.get('bounds')));assert wb[0]<=x1<x2<=wb[2]and wb[1]<=y1<y2<=wb[3];assert y2-y1>=96
assert(B/'final-wm.txt').read_text().strip()=='Physical size: 720x1280';assert(B/'final-density.txt').read_text().strip()=='Physical density: 320';fg=(B/'final-foreground.txt').read_text();assert re.search(r'topResumedActivity=.*com.android.launcher3',fg)
uids=dict(re.findall(r'package:(\S+) uid:(\d+)',(B/'final-projectUids.txt').read_text()));assert uids['com.catforest.worlddemo']=='10149'and uids['com.catforest.app']=='10148'
media=json.loads((B/'private-media.json').read_text());assert len(media['records'])==4
for rec in media['records']:
 p=B/rec['file'];m=rec['metadata']['structuredContent'];assert m['shared']is False and m['parent_ids']==[media['folder']]and int(m['size'])==p.stat().st_size;assert all(x['role']=='owner'for x in m['permissions'])and len(m['permissions'])==1
add=B/'post-index-installed-apk';ab=add/'installed-base.apk';ar=add/'READBACK.json';assert ab.stat().st_size==1065138 and sha(ab)==sha(C/'deliverables/catforest-world-demo-0.2.7-debug.apk')
for p in [ab,ar]:pins[str(p.relative_to(R))]=sha(p)
log=(B/'final-app-logcat.txt').read_text().splitlines();e=[x for x in log if re.search(r'\sE\s',x)];assert len(e)==5;assert not any(re.search('FATAL EXCEPTION|Uncaught',x)for x in log)
report={'decision':'limited_emulator_sample_flow_pass_not_physical_device_or_complete_world','confirmedP1P2':[],'environment':json.loads((B/'PREFLIGHT.json').read_text()),'profiles':s['profiles'],'rootFinalIndexFilesVerified':77,'interim50PinsUnchanged':True,'evidencePinCount':len(pins),'evidenceHashes':pins,'sessionInstalledApkSha256RootReported':s['apkInstalledSha256'],'installedApkBytesPresentInReviewed77':False,'postIndexInstalledApkBytesIndependentlyRecomputed':{'path':str(ab.relative_to(R)),'bytes':ab.stat().st_size,'sha256':sha(ab),'scope':'later read-only emulator APK readback, candidate byte-identical; original77 unchanged'},'uids':uids,'logScope':{'file':'final-app-logcat.txt','lines':len(log),'fatalExceptionOrUncaughtMatched':0,'ELevelCount':len(e),'ELevelLines':e,'rendererExitDiagnostics':'2 code -1 messages shortly after Back exit; timing only, cause not established'},'mediaMetadataRecordsVerified':4,'video':{'bytes':(B/'06-street-ground.mp4').stat().st_size,'review':'hash/size and endpoint screenshots only; no full video frame-by-frame audit'},'noReviewDeviceActions':True}
(O/'actual-evidence.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:report[k]for k in ['decision','rootFinalIndexFilesVerified','interim50PinsUnchanged','evidencePinCount','confirmedP1P2']},ensure_ascii=False))
