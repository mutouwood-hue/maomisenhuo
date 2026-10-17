from pathlib import Path
import json,hashlib,tarfile,xml.etree.ElementTree as ET,collections,struct
R=Path(__file__).resolve().parents[2];H=Path(__file__).resolve().parent;B=R/'artifacts/device-integration/2026-10-16-ui025'
sha=lambda b:hashlib.sha256(b).hexdigest();read=lambda n:json.loads((B/n).read_text())
def tar_map(n):
 with tarfile.open(B/n) as t:return {i.name:sha(t.extractfile(i).read()) for i in t if i.isfile() and any(i.name.startswith(s) for s in ['./files/','./shared_prefs/','./app_webview/Default/Local Storage/'])}
def fields(n):
 nodes=list(ET.fromstring((B/n).read_text()).iter('node'));keys=['本次读取 generation','设备已处理指令序号','设备已确认事件水位','设备待确认事件数','快照版本','快照场景','快照动作','快照天气']
 return {x.get('text'):nodes[i+1].get('text','') for i,x in enumerate(nodes) if x.get('text') in keys}
def auth(n):
 w=read(n);assert sha(w['body'].encode())==w['sha256'];return json.loads(w['body'])
def mp4_duration(p):
 # ISO BMFF movie-header duration only; no claim of decoding/visual coverage/FPS.
 data=p.read_bytes();pos=0
 def boxes(start,end):
  k=start
  while k+8<=end:
   size=struct.unpack_from('>I',data,k)[0];kind=data[k+4:k+8];header=8
   if size==1:size=struct.unpack_from('>Q',data,k+8)[0];header=16
   if size==0:size=end-k
   if size<header or k+size>end:raise ValueError('invalid box')
   yield kind,k+header,k+size;k+=size
 for kind,start,end in boxes(0,len(data)):
  if kind==b'moov':
   for sub,s,e in boxes(start,end):
    if sub==b'mvhd':
     v=data[s];offset=s+(20 if v==1 else 12);scale=struct.unpack_from('>I',data,offset)[0];duration=struct.unpack_from('>Q' if v==1 else '>I',data,offset+4)[0];return duration/scale
 raise ValueError('mvhd missing')
install=read('install.json');before=tar_map('before-025-app-data.tar');after=tar_map('after-install-before-launch.tar');assert before==after==install['beforeSavedFiles']==install['afterSavedFiles'] and len(before)==13
expected='ea08d990f5210f5e8cf831b77cea60f39b2826270604148f84a38432be786c88';assert install['apkSha256']==expected and install['installedApkReadback'].startswith(expected) and install['returnCode']==0
away=fields('away-read-complete.xml');home=fields('home-read-complete.xml');assert away==fields('away-state-fields.xml') and home==fields('home-state-fields.xml')
assert away==dict(zip(['本次读取 generation','设备已处理指令序号','设备已确认事件水位','设备待确认事件数','快照版本','快照场景','快照动作','快照天气'],['2','29','9','0','20','在外出游（away）','休息（idle）','晴天（clear）']))
assert home==dict(zip(away,['2','31','9','0','22','在家（home）','休息（idle）','晴天（clear）']))
text=lambda n:' '.join(x.get('text','') for x in ET.fromstring((B/n).read_text()).iter('node'))
assert '小橘出门啦' in text('cold-start.xml') and '叫它回家' in text('before-original-recall.xml');assert '小橘出门啦' not in text('after-original-recall.xml') and '叫它回家' not in text('after-original-recall.xml')
assert '小橘跟去了' in text('after-original-recall.xml')
actions=read('actions.json');recall=[x for x in actions if x.get('tap')=='叫它回家'];assert len(recall)==1
baseline=auth('baseline-authority.json');loop=auth('after-loop-authority.json');changed=[k for k in baseline['entries'] if baseline['entries'][k]!=loop['entries'].get(k)];assert changed==['cat-cflocal2-journal-v1']
ledger=json.loads(loop['entries']['cat-cflocal2-event-ledger-v1']);game=json.loads(loop['entries']['pixel-cat-pet-v1']);social=json.loads(loop['entries']['pg-social-v1']);assert len(ledger['records'])==9 and len(social['dex']['deviceReceipts'])==9 and game['coins']==24 and game['cats'][0]['xp']==67;statuses=dict(collections.Counter(v['status'] for v in ledger['records'].values()));assert statuses=={'applied':8,'quarantined':1}
result={'scope':'interim actual loop evidence; stability/final Root handoff not yet incorporated','status':'pass_loop_only_pending_final','apkSha256':expected,'installFilesByteIdentical':len(before),'awayRead':away,'homeRead':home,'originalRecallAction':recall[0],'overlayRemovedButOriginalSchedulePillPersists':True,'baselineAuthorityRevision':baseline['revision'],'afterLoopAuthorityRevision':loop['revision'],'authorityChangedEntries':changed,'ledgerRecords':9,'ledgerStatuses':statuses,'socialReceipts':9,'coins':game['coins'],'xp':game['cats'][0]['xp'],'counts':game['cats'][0]['counts'],'videos':{p.name:{'bytes':p.stat().st_size,'mvhdDurationSeconds':mp4_duration(p),'sha256':sha(p.read_bytes()),'decodedOrFullVisualReviewed':False} for p in B.glob('*.mp4')},'evidenceHashes':{p.name:sha(p.read_bytes()) for p in B.iterdir() if p.is_file() and p.suffix in ['.png','.xml','.json']},'limits':['No independent device action','Screenshot chain is primary; video durations are container metadata, not whole-loop continuous visual pass','BLE clock unavailable; no fresh direct USB calibration observation inferred','No new game reward or bilateral gift/encounter was tested','Await Root final stability/post evidence before ACTUAL conclusion']}
(H/'actual-evidence-interim.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'status':'pass_loop_pending_final','installFiles':13,'awaySeq':29,'homeSeq':31,'records':9,'videos':{k:v['mvhdDurationSeconds'] for k,v in result['videos'].items()}}))
# Final handoff is checked separately; interim evidence remains preserved.
if (B/'authority-final.json').exists() and (B/'post-readback.json').exists():
 import re,datetime
 final=auth('authority-final.json');assert final['revision']==81
 protected=['pixel-cat-pet-v1','pg-social-v1','cat-cflocal2-source-identities-v1','cat-cflocal2-event-ledger-v1']
 assert all(final['entries'][k]==baseline['entries'][k] for k in protected)
 assert [k for k in baseline['entries'] if baseline['entries'][k]!=final['entries'].get(k)]==['cat-cflocal2-journal-v1']
 journal=json.loads(final['entries']['cat-cflocal2-journal-v1']);assert all(x['pending'] is None for x in journal['devices'].values())
 f=fields('final-read-complete.xml');assert f==fields('final-state-fields.xml');assert f==dict(zip(away,['2','36','9','0','27','在家（home）','休息（idle）','晴天（clear）']))
 observation=read('room-observation.json');assert observation['completed'] and observation['elapsedSeconds']==303.684 and len(observation['samples'])==5
 memory=[]
 for cp in ['room-start','room-60','room-120','room-180','room-240','room-300']:
  meta=read(cp+'-meta.json');assert meta['pid']=='10921';assert meta['authorityCapturedJsonSha256']==sha((B/(cp+'-authority.json')).read_bytes())
  text=(B/(cp+'-activity.txt')).read_text();top=re.search(r'topResumedActivity=.*',text);assert top and 'com.catforest.htmlcandidate' in top[0]
  st=auth(cp+'-authority.json');assert all(st['entries'][k]==baseline['entries'][k] for k in protected)
  mem=(B/(cp+'-meminfo.txt')).read_text();assert '** MEMINFO in pid 10921 [com.catforest.htmlcandidate] **' in mem
  memory.append({'checkpoint':cp,'atUtc':meta['atUtc'],'pssKB':int(re.search(r'TOTAL PSS:\s*(\d+)',mem)[1]),'nativePrivateDirtyKB':int(re.search(r'Native Heap:\s*(\d+)',mem)[1]),'graphicsPrivateDirtyKB':int(re.search(r'Graphics:\s*(\d+)',mem)[1])})
 summary=read('stability-summary.json');assert [x['pssKB'] for x in memory]==[x['pssKB'] for x in summary['memorySamples']]
 logs=(B/'room-main-process-logcat.txt').read_text();assert len(logs.splitlines())==summary['mainProcessLogLines']==40
 selected=[x for x in logs.splitlines() if re.search(r'FATAL EXCEPTION|Fatal signal|uncaught|ANR in com.catforest|SIGSEGV',x,re.I)];assert not selected
 gpu={'shaderCompilationFailed':logs.count('Shader compilation failed'),'pipelineCreateFailed':logs.count('Pipeline create failed')};assert gpu=={'shaderCompilationFailed':2,'pipelineCreateFailed':2}
 post=read('post-readback.json');assert post['wmSize']=='Physical size: 1200x2670' and post['wmDensity']=='Physical density: 520' and not post['screenrecordPid'];assert 'STATE_DISCONNECTED' in post['bluetooth'];assert 'QuickstepLauncher' in re.search(r'topResumedActivity=.*',post['activity'])[0]
 result.update(scope='final limited actual original companion loop, core readonly demo and finite foreground observation',status='pass_limited_actual_scope',nativeFinalRevision=81,finalRead=f,protectedEntryBytesUnchanged=protected,journalPending=None,stability={'seconds':303.684,'pid':'10921','fiveSamePidForegroundSamples':True,'memory':memory,'memoryStartPredatesTimedObservation':True,'mainProcessLogLines':40,'selectedFatalUncaughtMatches':selected,'nonfatalGpuMessages':gpu,'notWholeOSRendererOrLongTermGuarantee':True},release={'wmRestored':True,'Home':True,'bleDisconnected':True,'screenrecordPidEmpty':True},evidenceHashes={p.name:sha(p.read_bytes()) for p in B.iterdir() if p.is_file() and p.suffix in ['.png','.xml','.json']})
 result['limits']=['Independent read-only review of Root device actions; no reviewer device/network operations','State persistence/reader linkage only, not optical badge animation or precise clock validity','Two nonfatal Adreno shader compilation + two pipeline failure messages retained; not all graphics logs clean','Memory sample start precedes corrected timed window; no leak/continuousFPS guarantee','Existing schedule pill stays outward after private recall; inherited presentation mismatch','No new care/gift/reward/bilateral or power-loss test; original9status retained','Separate videos not asserted complete continuous whole loop; container duration only independently parsed']
 (H/'actual-evidence.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'status':result['status'],'finalSeq':36,'finalRevision':27,'nativeFinal':81,'stabilitySeconds':303.684,'gpuMessages':gpu,'postReleased':True}))
if result['status']=='pass_limited_actual_scope':
 totals={cp:[int(x) for x in re.findall(r'Total frames rendered:\s*(\d+)',(B/(cp+'-gfxinfo.txt')).read_text())] for cp in ['room-start','room-300']}
 assert all(v and all(x==0 for x in v) for v in totals.values())
 result['stability']['gfxinfoTotalFrames']=totals;result['stability']['gfxinfoUsableForPerformance']=False
 (H/'actual-evidence.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
