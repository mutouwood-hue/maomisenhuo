from pathlib import Path
import re,json,struct,hashlib,sys,importlib.util
sys.dont_write_bytecode=True
H=Path(__file__).resolve().parent;R=H.parents[1];N=R/'artifacts/firmware-local-v3-perf';S=N/'source';B=R/'artifacts/firmware-local-v3-dmafix/source'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def config(p):return dict(re.findall(r'^(CONFIG_\w+)=(.+)$',p.read_text(),re.M))
a,b=config(B/'sdkconfig'),config(S/'sdkconfig');changed={k:[a.get(k),b.get(k)] for k in a.keys()|b.keys() if a.get(k)!=b.get(k)};assert changed=={'CONFIG_LV_USE_SNAPSHOT':[None,'y']}
m=json.loads((N/'manifest.json').read_text());raw=(N/m['app']['path']).read_bytes();d=raw[32:288];assert raw[0]==0xe9 and struct.unpack_from('<I',d)[0]==0xabcd5432;assert struct.unpack_from('<I',d,4)[0]==0;assert d[16:48].split(b'\0')[0]==b'0.3.3-local3';assert len(raw)<0x800000
spec=importlib.util.spec_from_file_location('capture_decode',N/'tools/capture_decode.py');decode=importlib.util.module_from_spec(spec);spec.loader.exec_module(decode);pixels,metadata=decode.decode((H/'diagnostic-synthetic-capture.log').read_bytes());assert len(pixels)==434312 and metadata['physicalScanout']==False
rx=[]
for p in (S/'main').glob('*.c'):
 if 'usb_serial_jtag_read_bytes(' in p.read_text():rx.append(p.name)
assert rx==['badge_diagnostics.c'];assert b['CONFIG_ESP_CONSOLE_UART_NUM']=='0' and b['CONFIG_ESP_CONSOLE_SECONDARY_USB_SERIAL_JTAG']=='y'
result={'status':'pass','configAssignedChanges':changed,'appDescriptionMagic':'0xabcd5432','appVersion':'0.3.3-local3','secureVersion':0,'imageFits8MiBAppSlot':True,'USB_RX_SourceFiles':rx,'USB_RX_taskCount':1,'syntheticProductionDiagnosticCaptureDecoded':{'bytes':len(pixels),'crc32':metadata['crc32'],'rawSha256':hashlib.sha256(pixels).hexdigest(),'hardware':False},'limits':'only host/static proof; no port opened, no write to device'}
(H/'static-contracts.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
