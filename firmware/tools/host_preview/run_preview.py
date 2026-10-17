#!/usr/bin/env python3
"""Compile local LVGL/production C and convert its RGB565 flushes to PNG. No network/device/UI."""
from pathlib import Path
import argparse, datetime, hashlib, json, shutil, struct, subprocess, sys, zlib
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
DEFAULT_CASES=['boot','pair','pair_secure','pair_passkey',*[f'guide_{i}' for i in range(1,6)],'main_a','main_b','main_c','care_menu','status','settings','device','pair_reset','touch_test','touch_complete','voice','main_low_stats','storage_error','aod']
SUPPORTED={'main_a','main_b','main_c','aod','care_menu','status','settings','touch_test','voice','boot','pair','guide'}
def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
def png(path,rgb,w=466,h=466):
    raw=b''.join(b'\0'+rgb[y*w*3:(y+1)*w*3] for y in range(h))
    path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw,6))+chunk(b'IEND',b''))
def convert(stem):
    data=stem.with_suffix('.rgb565').read_bytes();assert len(data)==466*466*2
    rgb=bytearray(466*466*3);outside_nonblack=0
    for i,(v,) in enumerate(struct.iter_unpack('<H',data)):
        x=i%466;y=i//466;outside=(2*x+1-466)**2+(2*y+1-466)**2>466**2
        if outside:
            outside_nonblack+=bool(v);continue
        r=(v>>11)&31;g=(v>>5)&63;b=v&31
        rgb[i*3:i*3+3]=bytes(((r*255+15)//31,(g*255+31)//63,(b*255+15)//31))
    png(stem.with_suffix('.png'),rgb)
    return rgb,outside_nonblack

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--no-build',action='store_true');ap.add_argument('--cases',default=','.join(DEFAULT_CASES));ap.add_argument('--output',type=Path);ap.add_argument('--jobs',type=int,default=2);a=ap.parse_args()
    out=(a.output or ROOT/'artifacts/firmware-game-preview'/datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H%M%SZ')).resolve()
    if not out.is_relative_to(ROOT/'artifacts/firmware-game-preview'):ap.error('output must stay within artifacts/firmware-game-preview')
    out.mkdir(parents=True,exist_ok=True)
    if (out/'manifest.json').exists():ap.error('immutable preview already exists; choose a new output')
    build=HERE/'build';binary=build/'badge_host_preview'
    cmake=shutil.which('cmake') or next(iter(ROOT.glob('.tools/idf-tools/tools/cmake/*/CMake.app/Contents/bin/cmake')),None)
    if not cmake:raise SystemExit('Project-local CMake is not installed')
    if not a.no_build:
        with (out/'build.log').open('w') as log:
            subprocess.run([str(cmake),'-S',str(HERE),'-B',str(build),'-DCMAKE_BUILD_TYPE=Release'],check=True,stdout=log,stderr=subprocess.STDOUT)
            subprocess.run([str(cmake),'--build',str(build),'--target','badge_host_preview','--parallel',str(max(1,min(a.jobs,2)))],check=True,stdout=log,stderr=subprocess.STDOUT)
    cases=a.cases.split(',')
    if not all(c in DEFAULT_CASES for c in cases):ap.error('unrecognized fixture case')
    sources=[ROOT/'firmware/main'/p for p in ['badge_pages.c','badge_scene.c','badge_scene.h','badge_gesture.c','badge.h','badge_ui_contract.h']]
    sources+=list((ROOT/'firmware/main/assets').glob('*.c'))+list((ROOT/'firmware/main/assets').glob('*.h'))
    sources+=list(HERE.glob('*.c'))+list(HERE.glob('*.h'))+[HERE/'CMakeLists.txt',Path(__file__),ROOT/'firmware/managed_components/lvgl__lvgl/lvgl.h',ROOT/'firmware/managed_components/lvgl__lvgl/lv_version.h']
    hashes={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sources if p.exists()}
    records=[];renders=[]
    for case in cases:
        stem=out/case
        with (out/(case+'.log')).open('w') as log:subprocess.run([str(binary),case,str(stem)],check=True,stdout=log,stderr=subprocess.STDOUT,timeout=30)
        rgb,n=convert(stem);renders.append(rgb);record=json.loads(stem.with_suffix('.json').read_text());record.update(png=case+'.png',png_sha256=hashlib.sha256(stem.with_suffix('.png').read_bytes()).hexdigest(),outside_circle_nonblack_pixels_before_mask=n);records.append(record)
        print(case,stem.with_suffix('.png'),flush=True)
    if renders:
        cols=3;rows=(len(renders)+cols-1)//cols;w=cols*466;h=rows*466;sheet=bytearray(w*h*3)
        for index,img in enumerate(renders):
            for y in range(466):
                dest=((index//cols*466+y)*w+index%cols*466)*3;sheet[dest:dest+466*3]=img[y*466*3:(y+1)*466*3]
        png(out/'contact-sheet.png',sheet,w,h)
    contract=json.loads((ROOT/'firmware/main/assets/ui-contract-source.json').read_text())['screens']
    coverage={key:{'name':value['name'],'production_representation_exists':key in SUPPORTED,'qualification':'voice is disabled UI; AOD physical brightness is a stub; time/battery/rings unknown' if key in ['voice','aod','main_a','main_b','main_c'] else 'production page' if key in SUPPORTED else 'No production page; no invented screenshot generated'} for key,value in contract.items()}
    manifest=dict(offline=True,basis='production C / current candidate, NOT original user firmware or hardware screenshot',reference_first=True,enhancements_rendered=False,method='Original badge_pages.c included unchanged; original badge_scene.c/gesture/font/I8 bank linked to local LVGL 9.5 software renderer; memory-only BSP/state/NVS stubs',fixture_note='All pet/status/link/codes are explicitly synthetic offline fixtures. Battery and time remain -- placeholders; no invented sensed/environment/voice/child data.',limits=['No hardware brightness/color calibration, display/touch pin mapping, panel clipping/rotation verification','No real NVS/BLE/event durability tests; tap() helpers bypass actual touch input route','No executed HTML, browser, HTTP, network, device, serial, or ADB','Page/scene states are selected through production functions; this is layout coverage, not a navigation integration test','Original firmware source pending; do not infer replacement approval or reference pixel equivalence'],binary_sha256=hashlib.sha256(binary.read_bytes()).hexdigest(),source_sha256=hashes,source_unchanged_during_render=all(hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==v for p,v in hashes.items()),contract_screen_count=len(contract),production_contract_representations=sum(k in SUPPORTED for k in contract),fixture_png_count=len(records),contract_coverage=coverage,cases=records,contact_sheet_order=cases)
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'output':str(out),'cases':len(records),'production_contract_representations':12,'contract_total':23,'missing_glyphs':sum(r['missing_glyph_count'] for r in records)}),flush=True)
if __name__=='__main__':main()
