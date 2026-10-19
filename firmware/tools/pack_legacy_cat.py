#!/usr/bin/env python3
"""Lossless storage conversion of the existing 66 indexed C assets, no rendering."""
from pathlib import Path
import argparse, hashlib, json, re, struct

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source-assets',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    payload=bytearray();records=[]
    for name in ['game_idle.c','game_pet.c','game_walk.c','game_attention.c']:
        source=(args.source_assets/name).read_text()
        for match in re.finditer(r'uint8_t\s+(game_\w+)_data\[\]\s*=\s*\{(.*?)\};',source,re.S):
            data=bytes(int(x,16)for x in re.findall(r'0x([0-9a-fA-F]{2})',match[2]));pixels=data[1024:];count=max(pixels)+1;palette=bytearray()
            for i in range(count):palette.extend(data[i*4:i*4+4]+bytes([0,2]))
            runs=bytearray();start=0
            while start<len(pixels):
                end=start+1
                while end<len(pixels) and pixels[end]==pixels[start] and end-start<65535:end+=1
                runs.extend(struct.pack('<HB',end-start,pixels[start]));start=end
            encoded=struct.pack('<HI',count,len(runs))+palette+runs;offset=len(payload);payload.extend(encoded);records.append({'name':match[1],'offset':offset,'bytes':len(encoded),'sourceSha256':hashlib.sha256(data).hexdigest()})
    args.output.mkdir(parents=True,exist_ok=True)
    with (args.output/'legacy_cat_data.c').open('w')as f:
        f.write('/* Lossless storage of the existing 66 I8 frames. RAW is an internal marker; decoded before LVGL. */\n#include "../game_assets.h"\nstatic const uint8_t legacy_data[]={\n')
        for i in range(0,len(payload),24):f.write(','.join(str(b)for b in payload[i:i+24])+',\n')
        f.write('};\n')
        for r in records:f.write('const lv_image_dsc_t '+r['name']+'={.header={.magic=LV_IMAGE_HEADER_MAGIC,.cf=LV_COLOR_FORMAT_RAW,.w=192,.h=208,.stride=192},.data_size='+str(r['bytes'])+',.data=legacy_data+'+str(r['offset'])+'};\n')
    (args.output/'legacy-provenance.json').write_text(json.dumps({'conversion':'Lossless palette/index RLE; original frame symbols, count and timing retained.','bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest(),'frames':records,'acceptance':'Not executed or visually accepted.'},indent=2)+'\n')
    print(json.dumps({'frames':len(records),'bytes':len(payload)}))

if __name__=='__main__':main()
