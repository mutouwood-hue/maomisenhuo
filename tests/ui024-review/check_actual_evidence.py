from pathlib import Path
import json,hashlib,tarfile,xml.etree.ElementTree as ET,re,collections
R=Path(__file__).resolve().parents[2];H=Path(__file__).resolve().parent;B=R/'artifacts/device-integration/2026-10-16-ui024'
sha=lambda b:hashlib.sha256(b).hexdigest();read=lambda n:json.loads((B/n).read_text())
def mapped_tar(name):
 out={}
 with tarfile.open(B/name) as t:
  for i in t.getmembers():
   if i.isfile() and any(i.name.startswith(prefix) for prefix in ['./shared_prefs/','./files/','./app_webview/Default/Local Storage/']):out[i.name]=sha(t.extractfile(i).read())
 return out
install=read('install.json');before=mapped_tar('before-024-app-data.tar');after=mapped_tar('after-install-before-launch.tar');assert before==after==install['beforeSavedFiles']==install['afterSavedFiles'];assert len(before)==12
expected='0eb37ca588fefe4858a017400f5cf4e6af46178596d9082956ad00a7bba72022';assert install['apkSha256']==expected and install['installedApkReadback'].startswith(expected) and install['returnCode']==0
names=['authority-cold-start.json','authority-before-refresh.json','authority-after-refresh.json','authority-final.json'];authorities=[];bodyhashes={}
for n in names:
 w=read(n);assert sha(w['body'].encode())==w['sha256'];bodyhashes[n]=w['sha256'];authorities.append(json.loads(w['body']))
cold,before_read,after_read,final=authorities;assert before_read==after_read==final
changed=[k for k,v in cold['entries'].items() if v!=final['entries'].get(k)];assert changed==['cat-cflocal2-journal-v1'];assert cold['revision']==63 and final['revision']==65
ledger=json.loads(final['entries']['cat-cflocal2-event-ledger-v1']);social=json.loads(final['entries']['pg-social-v1']);pet=json.loads(final['entries']['pixel-cat-pet-v1']);journal=json.loads(final['entries']['cat-cflocal2-journal-v1'])
assert len(ledger['records'])==9 and ledger['pending'] is None and len(social['dex']['deviceReceipts'])==9 and pet['coins']==24
statuses=dict(collections.Counter(v['status'] for v in ledger['records'].values()));assert statuses=={'applied':8,'quarantined':1};assert all(v['pending'] is None for v in journal['devices'].values())
export=read('actual-local-export.json');expmeta=read('local-export-readback.json');assert (B/'actual-local-export.json').stat().st_size==1464 and sha((B/'actual-local-export.json').read_bytes())==expmeta['sha256']
assert export['schema']=='catforest-local-device-diagnostics-v1' and export['validity']=='same_connection_observation';o=export['observation'];device=o['device']
assert o['generation']==2 and device['lastSeq']==28 and device['lastAck']==9 and device['pending']==0 and device['snapshot']['revision']==19
assert o['readTimeSource']=='phone_Date.now' and o['clock']=={'status':'not_provided_by_ble'}
assert set(device)=={'deviceId','clientId','lastSeq','lastAck','pending','storageError','hasSnapshot','snapshot'};assert set(device['snapshot'])=={'petId','revision','scene','action','weather'}
post=read('post-readback.json');assert post['wmSize']=='Physical size: 1200x2670' and post['wmDensity']=='Physical density: 520' and 'topResumedActivity=ActivityRecord' in post['activity'] and 'QuickstepLauncher' in post['activity'];assert 'STATE_DISCONNECTED' in post['bluetooth']
xml=ET.fromstring((B/'returned-from-save-stale.xml').read_text());text=' '.join(n.get('text','') for n in xml.iter('node'));assert '已过期' in text and '已请求本机保存位置' in text
refresh=[n for n in xml.iter('node') if n.get('text')=='刷新连接详情'];assert refresh and refresh[0].get('enabled')=='false'
layouts=[]
for name in ['normal-details-actual-end','short-details-end','mid-details-end']:
 x=ET.fromstring((B/(name+'.xml')).read_text());texts=[n for n in x.iter('node') if '照料、家庭与图鉴保存在这台手机' in n.get('text','')];assert texts
 close=[n for n in x.iter('node') if n.get('content-desc')=='关闭吧唧'];assert close
 layouts.append({'name':name,'footerBounds':texts[0].get('bounds'),'closeBounds':close[0].get('bounds'),'footerVisible':True})
result={'kind':'independent read-only review of Root actual device evidence, no reviewer device actions','status':'limited_pass','apkSha256':expected,'installMappedFiles':len(before),'installBeforeLaunchExact':True,'authorityBodyHashes':bodyhashes,'authorityWrapperFileHashes':{n:sha((B/n).read_bytes()) for n in names},'wholeAuthorityEqualOnlyExplicitRefreshAndFinalWindow':True,'coldAuthorityRevision':63,'finalAuthorityRevision':65,'coldToFinalChangedEntries':changed,'unchangedRecords':len(ledger['records']),'socialDeviceReceipts':len(social['dex']['deviceReceipts']),'ledgerStatuses':statuses,'ledgerPending':None,'coins':pet['coins'],'xp':pet['cats'][0]['xp'],'petCounts':pet['cats'][0]['counts'],'export':{'bytes':1464,'sha256':expmeta['sha256'],'savedViaSystemPicker':True,'validAtExportStart':export['validity'],'generation':2,'lastSeq':28,'lastAck':9,'pending':0,'snapshotRevision':19,'clock':'not_provided_by_ble'},'returnedCacheExpiredRefreshDisabled':True,'layouts':layouts,'restoredWMHomeAndDisconnected':True,'evidenceFilesSha256':{p.name:sha(p.read_bytes()) for p in B.iterdir() if p.is_file() and p.suffix in ['.png','.xml','.json']},'limits':['Native byte equality is explicit sample windows; cold-to-final journal legitimately advances','No assertion live WebView stats never decay','No actual BUSY/failure/systemfont1.6 forced; software tests separate','Original outing overlay + device home/idle require a separate scene-mapping acceptance, not diagnosed from visual overlay alone','No new events/rewards/power-loss test']}
(H/'actual-evidence.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'status':'pass','mappedFiles':12,'ledgerRecords':9,'coins':24,'onlyChangedEntry':changed,'exportBytes':1464,'layouts':3}))
