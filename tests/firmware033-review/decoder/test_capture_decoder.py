from capture_decode import decode,InvalidCapture,SIZE,CHUNK
import json,zlib,base64
from pathlib import Path
raw=bytes((i*17+23)&255 for i in range(SIZE));meta=dict(schema=1,captureId=7,width=466,height=466,stride=932,bytes=SIZE,format='RGB565_LE',crc32=f'{zlib.crc32(raw):08x}',source='lvgl-object-tree-composition',physicalScanout=False,renderFrameId=8,uiPauseUs=123)
lines=['I (200) fixture log','CFDIAG BEGIN '+json.dumps(meta)]+[f'CFDIAG DATA 7 {off} '+base64.b64encode(raw[off:off+CHUNK]).decode() for off in range(0,SIZE,CHUNK)]+['CFDIAG END 7'];cases=[]
def case(name,ls,valid=False):
 try:r,m=decode(('\n'.join(ls)+'\n').encode());assert valid and r==raw
 except InvalidCapture:assert not valid
 cases.append(dict(name=name,passed=True))
case('complete_fixture',lines,True);case('console_interleaved',lines[:10]+['I (222) test only']+lines[10:],True)
case('missing_chunk',lines[:4]+lines[5:]);case('duplicate',lines[:4]+[lines[3]]+lines[4:]);case('reordered',lines[:3]+[lines[4],lines[3]]+lines[5:]);case('bad_crc',[l.replace(meta['crc32'],'00000000') for l in lines]);case('wrong_id',[l.replace('DATA 7 ','DATA 8 ') for l in lines]);case('aborted',lines[:-1]+['CFDIAG ABORT 7']);case('no_end',lines[:-1]);case('bad_format',[l.replace('RGB565_LE','RGB888') for l in lines]);case('multiple_begin',lines[:2]+[lines[1]]+lines[2:]);case('payload_corruption',[l[:-2]+'AA' if l.startswith('CFDIAG DATA 7 0 ') else l for l in lines]);case('unknown_size',[l.replace('434312','999999999') for l in lines]);case('DATA_after_END',lines+[lines[2]])
Path(__file__).resolve().parents[1].joinpath('evidence/capture-decoder-tests.json').write_text(json.dumps(dict(offline=True,synthetic_fixture_not_device=True,cases=cases),indent=2)+'\n');print(len(cases),'decoder checks passed')
