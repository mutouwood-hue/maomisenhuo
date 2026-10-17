from pathlib import Path
import json,hashlib,tarfile,xml.etree.ElementTree as ET,struct
R=Path(__file__).resolve().parents[2];H=Path(__file__).resolve().parent;D=R/'artifacts/device-integration/2026-10-16-ui022';C=R/'artifacts/html-offline-candidate/ui022'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rows(n):return [dict(x.attrib) for x in ET.parse(D/(n+'.xml')).iter('node')]
result=json.loads((D/'result.json').read_text());install=json.loads((D/'install.json').read_text());m=json.loads((C/'manifest.json').read_text());post=json.loads((D/'post-check.json').read_text());assert result['apkSha256']==install['apkSha256']==m['apk']['sha256']==install['installedApkReadback'].split()[0]
assert install['returnCode']==0 and not install['clearData'] and not install['grantPermissions'] and install['beforeSavedFiles']==install['afterSavedFiles'] and len(install['beforeSavedFiles'])==13
archives=[]
for name,key in [('before-022-app-data.tar','beforeSavedFiles'),('after-install-before-launch.tar','afterSavedFiles')]:
 with tarfile.open(D/name) as t:
  for p,h in install[key].items():assert hashlib.sha256(t.extractfile(p).read()).hexdigest()==h
 archives.append({'file':name,'sha256':sha(D/name),'recordedFileHashesVerified':13})
assert sha(D/'authority-final.json')==post['authoritySha256']==install['beforeSavedFiles']['./files/cflocal2-authority-main.json']
for name,v in result['media'].items():assert sha(D/name)==v['sha256'] and (D/name).stat().st_size==v['bytes']
viewed=['normal-family-six-full','normal-preview-orange','normal-preview-silver','normal-native-breed-options','normal-native-breed-selected','normal-selected-preview-readback','normal-wardrobe-top','normal-wardrobe-actual-end','short-wardrobe-end','mid-wardrobe-end','short-family-form','short-family-footer','mid-family-footer','short-family-previews','mid-family-previews','normal-family-footer','normal-closed-family','short-family-closed','mid-family-closed']
readback={}
for name,selected in [('normal-preview-orange','橘白田园猫'),('normal-preview-silver','银虎斑'),('normal-native-breed-selected','布偶猫'),('normal-selected-preview-readback','布偶猫')]:
 option=next(r for r in rows(name) if r.get('resource-id')=='adopt-breed');assert option['text']==selected;readback[name]=option['text']
for n in ['normal-wardrobe-actual-end','short-wardrobe-end','mid-wardrobe-end']:
 texts=[r.get('text','') for r in rows(n)];assert '星星小王冠' in texts and '夜空小斗篷' in texts
for p in D.glob('*wardrobe*.xml'):assert '选择这个品种' not in p.read_text()
actions=json.loads((D/'actions.json').read_text());taps=[a['tap'] for a in actions if a.get('tap')];assert not any(t.startswith(('购买','领养幼猫','安排配对','穿上试试','脱下服饰')) for t in taps)
media={n:{'pngSha256':sha(D/(n+'.png')),'xmlSha256':sha(D/(n+'.xml')),'pixels':struct.unpack('>II',(D/(n+'.png')).read_bytes()[16:24]),'pixelsViewed':True} for n in viewed}
out={'status':'limited_visual_form_pass','scope':'independent read-only review of root actual screenshots and XML; no new device operations','apkSha256':m['apk']['sha256'],'viewedFrames':media,'allResultMediaHashesRechecked':len(result['media']),'selectReadback':readback,'installArchiveChecks':archives,'authorityRawHashUnchanged':True,'authorityRevision59':'root record; raw bytes/hash verified without decoding private receipts','noSubmissionTapsInActionLog':True,'postCheckSha256':sha(D/'post-check.json'),'limits':['no actual system1.6 font-scale proof','no economy/adoption/mating/dress actions or rule completion proved','no BLE/clock/FIFO inference','AX dump checked/selected flags not used as proof of visual selected card; paint inspected in PNG']}
(H/'actual-device-evidence.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'status':out['status'],'viewedFrames':len(viewed),'allResultMediaHashes':len(result['media']),'selectReadback':readback,'archiveFilesVerified':13},ensure_ascii=False))
