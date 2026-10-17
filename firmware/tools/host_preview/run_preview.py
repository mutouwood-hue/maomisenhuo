#!/usr/bin/env python3
"""Compile local LVGL/production C and convert its RGB565 flushes to PNG. No network/device/UI."""
from pathlib import Path
import re
import argparse, datetime, hashlib, json, math, os, shutil, struct, subprocess, sys, zlib
HERE=Path(__file__).resolve().parent
FIRMWARE=HERE.parents[1]
ROOT=FIRMWARE.parent
DEFAULT_CASES=['boot','pair','pair_connected','pair_ready',*[f'guide_{i}' for i in range(1,6)],'main_a','main_b','main_c','care_menu','status','settings','device','touch_test','touch_complete','voice','main_low_stats','storage_error','aod','welcome','main_b_clock','historical_departing','departing','away_rain','returning_snow','care_feed','care_water','care_play','care_sleep','meet_confirm','gift_pending','gift_complete','action_feed','action_water','action_bath','action_play','action_sleep','action_pet','input_test','main_c_clock','guide_wrong','guide_success','guide_skip','guide_hold','drag_up_mid','drag_commit','drag_rebound','drag_no_target']
def production_toasts():
    return sorted(set(t for call in re.findall(r'announce\((.*?)\);',(FIRMWARE/'main/badge_pages.c').read_text()) for t in re.findall(r'"([^"\\]*(?:\\.[^"\\]*)*)"',call)))
DEFAULT_CASES += ['toast_'+str(i) for i in range(len(production_toasts()))]

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
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--no-build',action='store_true');ap.add_argument('--cases',default=','.join(DEFAULT_CASES));ap.add_argument('--output',type=Path);ap.add_argument('--jobs',type=int,default=2);ap.add_argument('--elapsed-ms',type=int,default=0);a=ap.parse_args()
    if not 0<=a.elapsed_ms<=5000:ap.error('elapsed-ms must be 0..5000')
    out=(a.output or ROOT/'artifacts/firmware-local-v3/preview'/datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H%M%SZ')).resolve()
    if not out.is_relative_to(ROOT/'artifacts/firmware-local-v3/preview'):ap.error('output must stay within artifacts/firmware-local-v3/preview')
    out.mkdir(parents=True,exist_ok=True)
    if (out/'manifest.json').exists():ap.error('immutable preview already exists; choose a new output')
    messages=production_toasts()
    assert len(messages)>=20,'No vacuous toast test allowed'
    expected='/* Generated from actual production announce literals; test-only. */\nstatic const char *const toast_messages[]={\n'+''.join('    "'+t+'",\n' for t in messages)+'};\n'
    header=HERE/'toast_cases.inc'
    if a.no_build:assert header.read_text()==expected,'Toast test list stale; rebuild current harness'
    else:header.write_text(expected)
    build=HERE/'build-v3';binary=build/('badge_host_preview.exe' if os.name=='nt' else 'badge_host_preview')
    cmake=shutil.which('cmake') or next(iter(ROOT.glob('.tools/idf-tools/tools/cmake/*/CMake.app/Contents/bin/cmake')),None)
    if not cmake:raise SystemExit('Project-local CMake is not installed')
    if not a.no_build:
        with (out/'build.log').open('w') as log:
            subprocess.run([str(cmake),'-S',str(HERE),'-B',str(build),'-DCMAKE_BUILD_TYPE=Release'],check=True,stdout=log,stderr=subprocess.STDOUT)
            subprocess.run([str(cmake),'--build',str(build),'--target','badge_host_preview','--parallel',str(max(1,min(a.jobs,2)))],check=True,stdout=log,stderr=subprocess.STDOUT)
    cases=a.cases.split(',')
    if not all(c in DEFAULT_CASES for c in cases):ap.error('unrecognized fixture case')
    sources=[FIRMWARE/'main'/p for p in ['badge_pages.c','badge_scene.c','badge_scene.h','badge_gesture.c','badge_gesture.h','badge.h','badge_ui_contract.h','badge_ui_targets.h','local2_core.h','local2_store.h','local2_peer.h']]
    sources+=list((FIRMWARE/'main/assets').glob('*.c'))+list((FIRMWARE/'main/assets').glob('*.h'))+list((FIRMWARE/'main/assets').glob('*.inc'))
    sources+=list((FIRMWARE/'main/assets').glob('*font-provenance.json'))+[FIRMWARE/'tools/generate_title_glyph.py']
    sources+=list((HERE/'stubs').rglob('*.h'))
    sources+=list(HERE.glob('*.inc'))+list(HERE.glob('*.c'))+list(HERE.glob('*.h'))+[HERE/'CMakeLists.txt',Path(__file__),ROOT/'firmware/managed_components/lvgl__lvgl/lvgl.h',ROOT/'firmware/managed_components/lvgl__lvgl/lv_version.h']
    hashes={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sources if p.exists()}
    records=[];renders=[]
    for case in cases:
        stem=out/case
        with (out/(case+'.log')).open('w') as log:subprocess.run([str(binary),case,str(stem),'--elapsed-ms',str(a.elapsed_ms)],check=True,stdout=log,stderr=subprocess.STDOUT,timeout=30)
        rgb,n=convert(stem);renders.append(rgb);record=json.loads(stem.with_suffix('.json').read_text());record.update(png=case+'.png',png_sha256=hashlib.sha256(stem.with_suffix('.png').read_bytes()).hexdigest(),outside_circle_nonblack_pixels_before_mask=n)
        violations=[]
        for label in record['labels']:
            if not label['text']:continue
            x1,y1,x2,y2=label['bounds'];radius=max(math.hypot(x-233,y-233) for x in [x1,x2] for y in [y1,y2])
            if radius>212:violations.append(dict(text=label['text'],bounds=label['bounds'],max_corner_radius=radius))
        record['animated_label_bounds_outside_safe_radius']=violations if record['motion_in_progress'] else []
        record['label_safe_radius_212_checked']=not record['motion_in_progress']
        record['label_safe_radius_212_violations']=[] if record['motion_in_progress'] else violations
        hit_violations=[]
        for target in record['hit_targets']:
            if target['shape']==2:continue
            x,y=target['center'];w,h=target['size']
            radius=math.hypot(x-233,y-233)+w if target['shape']==1 else max(math.hypot(px-233,py-233) for px in [x-w//2,x+w//2] for py in [y-h//2,y+h//2])
            if radius>212:hit_violations.append(dict(name=target['name'],radius=radius))
        for control in record['visual_controls']:
            if not control['enabled']:continue
            x1,y1,x2,y2=control['bounds'];radius=max(math.hypot(x-233,y-233) for x in [x1,x2] for y in [y1,y2])
            if radius>212:hit_violations.append(dict(visual=control['bounds'],radius=radius))
        record['hit_safe_radius_212_violations']=hit_violations;records.append(record)
        print(case,stem.with_suffix('.png'),flush=True)
    if renders:
        cols=3;rows=(len(renders)+cols-1)//cols;w=cols*466;h=rows*466;sheet=bytearray(w*h*3)
        for index,img in enumerate(renders):
            for y in range(466):
                dest=((index//cols*466+y)*w+index%cols*466)*3;sheet[dest:dest+466*3]=img[y*466*3:(y+1)*466*3]
        png(out/'contact-sheet.png',sheet,w,h)
    contract=json.loads((FIRMWARE/'main/assets/ui-contract-source.json').read_text())['screens']
    coverage={key:{'name':value['name'],'production_representation_exists':key in SUPPORTED,'qualification':'voice is disabled UI; AOD physical brightness is a stub; time/battery/rings unknown' if key in ['voice','aod','main_a','main_b','main_c'] else 'production page' if key in SUPPORTED else 'No production page; no invented screenshot generated'} for key,value in contract.items()}
    manifest=dict(
        offline=True,hardware_capture=False,
        basis='Isolated local2 candidate production C, linked to local LVGL 9.5 software renderer; NOT original firmware or panel capture',
        method='Actual badge_pages.c included; scene/gesture/original fonts and 66 PCAT I8 frames linked; RGB565 flush callback captures executed C output',
        fixture_note='All domain/peer/link values are explicitly synthetic offline fixtures. Phase/weather/action and completed peer are fixture inputs, not sensed data or proof of wireless exchange. Clock-valid fixture uses an explicit UTC epoch plus explicit +480 minute phone offset, never host wall-clock masquerading as phone sync.',
        limits=['No hardware access/brightness calibration, real display/touch rotation, electrical or panel-frame validation',
                'No real NVS/BLE/peer/event durability is exercised by this UI-only harness; separate core tests are required',
                'input_test drives actual LVGL pointer reader and production UI handlers but substitutes memory-only domain/peer persistence',
                'Layout selection for other captures uses production helpers; it is not a physical touch test',
                'No HTML execution, browser, HTTP, network, device, serial, ADB, or firmware upload',
                'The original 23-screen product remains incomplete; these candidate fixtures do not imply complete reference equivalence'],
        no_complete_23_screen_claim=True,glyph_check_passed=all(r['missing_glyph_count']==0 for r in records),hit_safe_radius_212_passed=all(not r['hit_safe_radius_212_violations'] for r in records),label_safe_radius_212_passed=all(not r['label_safe_radius_212_violations'] for r in records),binary_sha256=hashlib.sha256(binary.read_bytes()).hexdigest(),
        source_sha256=hashes,source_unchanged_during_render=all(hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==v for p,v in hashes.items()),
        contract_screen_count=len(contract),fixture_png_count=len(records),cases=records,contact_sheet_order=cases)
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'output':str(out),'cases':len(records),'contract_total':23,'missing_glyphs':sum(r['missing_glyph_count'] for r in records)}),flush=True)
    if not manifest['glyph_check_passed'] or not manifest['label_safe_radius_212_passed'] or not manifest['hit_safe_radius_212_passed'] or not manifest['source_unchanged_during_render']:
        raise SystemExit('Preview validation failed; inspect the retained manifest')
if __name__=='__main__':main()
