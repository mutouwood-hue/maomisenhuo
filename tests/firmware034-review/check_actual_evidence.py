from pathlib import Path
import json,hashlib,importlib.util,sys,re
sys.dont_write_bytecode=True
R=Path(__file__).resolve().parents[2];H=Path(__file__).resolve().parent;B=R/'artifacts/device-backups/esp-usb-7c0c5f423684/2026-10-16T0205Z-safe10';N=R/'artifacts/firmware-local-v3-perf034'
sha=lambda x:hashlib.sha256(x).hexdigest()
read=lambda n:json.loads((B/n).read_text())
def payload(name):
 text=(B/name).read_text();return json.loads(text[text.index('{'):])
manifest=json.loads((N/'manifest.json').read_text());app=(N/manifest['app']['path']).read_bytes();assert sha(app)==manifest['app']['sha256']
prefix=(B/'before-first128KiB.bin').read_bytes();fresh=(B/'fresh-prefix128KiB.bin').read_bytes();assert prefix==fresh
copy=(B/'selector-copy1-fresh.bin').read_bytes();assert copy==prefix[0x13000:0x14000]
cleared=prefix[:0x13000]+b'\xff'*4096+prefix[0x14000:];assert (B/'selector-cleared-first128KiB.bin').read_bytes()==cleared
assert (B/'post-activation-first128KiB.bin').read_bytes()==prefix
old=(B/'before-ota1-slot8MiB.bin').read_bytes();expected=(B/'expected-ota1-slot8MiB.bin').read_bytes();aligned=(len(app)+4095)//4096*4096
assert expected==app+b'\xff'*(aligned-len(app))+old[aligned:]
actual=(B/'rom-recovery-app-sector-readback.bin').read_bytes();assert actual==expected[:aligned]
parts=[prefix,(B/'before-ota0-slot8MiB.bin').read_bytes(),old,(B/'before-assets-tail.bin').read_bytes()];assert b''.join(parts)==(B/'composed-current-fullflash32MiB.bin').read_bytes();assert sum(map(len,parts))==32*1024*1024
for n in ['current-protected-verify','protected-verify']:
 assert read(n+'.json')['returncode']==0;assert (B/(n+'.log')).read_text().count('-- verify OK (digest matched)')==4
assert read('app-readback.json')['returncode']!=0 and read('app-readback-recovery-460800.json')['returncode']!=0
assert read('app-readback-recovery-rom.json')['returncode']==0
spec=importlib.util.spec_from_file_location('capture_decode034',N/'tools/capture_decode.py');decoder=importlib.util.module_from_spec(spec);spec.loader.exec_module(decoder)
frames=[]
for face,command in [(0,4),(1,6),(2,8)]:
 log=B/f'command-{command:02d}-capture.log';raw,meta=decoder.decode(log.read_bytes());stem=B/f'actual034-lvgl-face{face}'
 assert raw==stem.with_suffix('.rgb565').read_bytes();assert decoder.png(raw)==stem.with_suffix('.png').read_bytes()
 report=json.loads(stem.with_suffix('.json').read_text());assert report['crc32']==meta['crc32'] and report['captureId']==meta['captureId'] and not report['physicalScanout']
 frames.append({'face':face,'captureId':meta['captureId'],'crc32':meta['crc32'],'bytes':len(raw),'rawSha256':sha(raw),'logSha256':sha(log.read_bytes()),'pngMatchesDecodedRaw':True,'uiPauseUs':meta['uiPauseUs'],'physicalScanout':False})
first=payload('command-01-state.log');final=payload('command-12-state.log');perf0=payload('command-02-perf.log');perf1=payload('command-13-perf.log')
assert first['ready'] and not first['clockValid'] and first['lastAck']==9 and first['pending']==0 and first['lastSeq']==27 and first['revision']==18
assert final['ready'] and final['clockValid'] and final['lastAck']==9 and final['pending']==0 and final['lastSeq']==28 and final['revision']==19 and final['utcOffsetMinutes']==480
for perf in [perf0,perf1]:assert perf['buffer1Bytes']==perf['buffer2Bytes']==9320 and perf['buffer1DmaCapable'] and perf['buffer2DmaCapable'] and perf['pressedPolls']==0 and not perf['physicalScanoutMeasured']
log=(B/'normal-boot-and-diagnostics.txt').read_text(errors='replace');assert 'App version:      0.3.4-local3' in log
boot=read('normal-boot.json');errors=re.findall(r'(?m)^E \(\d+\).*$',log);panics=re.findall(r'Guru Meditation|abort\(\) was called',log);assert not errors and not panics
keys=['revision','lastSeq','lastAck','nextEvent','pending','clockValid','nowMs','utcOffsetMinutes','ready','storageError']
result={'kind':'independent offline readback of Root actual device evidence; reviewer never opened device','status':'pass_limited_scope','appSha256':sha(app),'imageReadbackBytes':len(actual),'appSectorAlignedTailFF':True,'freshPrefixExactBeforeAndAfterSelectorActivation':True,'prefixNvsRangeBytePreserved':True,'current32MiBComposedRollbackImage':{'bytes':sum(map(len,parts)),'sha256':sha(b''.join(parts)),'isNewFullRead':False,'allPhysicalRangesToolVerifiedBeforeWrite':True},'originalReadFailuresRetained':{'921600_corrupt_frame':True,'460800_no_reset_no_sync':True,'460800_clean_rom_success':True},'captures':frames,'initialState':{k:first[k] for k in keys},'finalState':{k:final[k] for k in keys},'initialPerf':perf0,'finalPerf':perf1,'sessionElapsedSeconds':boot['elapsedSeconds'],'errorLines':len(errors),'startupDiagnosticParserErrors':[x for x in log.splitlines() if 'CFDIAG ERROR' in x],'bootResetLines':[x for x in log.splitlines() if x.startswith('rst:')],'panicMatches':len(panics),'fullLogSha256':sha((B/'normal-boot-and-diagnostics.bin').read_bytes()),'limits':['No optical/physical scanout/tearing/touch validation; pressedPolls0','Fresh prefix plus earlier real read ranges reverified in full, not new full32MiB read','Read framing failures do not establish flash corruption or physical cause','Clock valid plus offset does not establish precise time synchronization','Current evidence does not test new care/gift or power loss recovery']}
(H/'actual-evidence.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'status':'pass','captures':len(frames),'CRC':[f['crc32'] for f in frames],'sessionSeconds':boot['elapsedSeconds'],'finalDmaFree':perf1['dmaFree'],'pressedPolls':perf1['pressedPolls'],'finalState':{k:final[k] for k in ['revision','lastSeq','lastAck','pending','clockValid']}}))
