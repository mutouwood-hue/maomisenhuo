#!/usr/bin/env python3
"""Losslessly package authored RLE layers for the existing 8 MiB app slot."""
from pathlib import Path
import hashlib, json, re, struct, zlib

def write_assets(output, raw, offsets):
    packed=bytearray()
    revised=[]
    maximum=0
    layers=0
    frame_count=len(offsets[0][0])
    for shape in offsets:
        shape_offsets=[]
        for outfit in shape:
            row=[]
            for offset in outfit:
                count, runs=struct.unpack_from('<HI',raw,offset)
                end=offset+6+count*6+runs
                if not 0<count<=128 or end>len(raw):raise ValueError('Invalid source RLE layer')
                layer=raw[offset:end]
                encoded=zlib.compress(layer,9)
                row.append(len(packed))
                packed.extend(struct.pack('<II',len(layer),len(encoded)))
                packed.extend(encoded)
                maximum=max(maximum,len(layer));layers+=1
            shape_offsets.append(row)
        revised.append(shape_offsets)
    with (output/'native_cat_data.c').open('w')as f:
        f.write('/* Authored native GLBs: lossless zlib-wrapped indexed RLE layers. */\n#include "native_cat_data.h"\nconst uint8_t badge_native_cat_data[]={\n')
        for i in range(0,len(packed),24):f.write(','.join(str(b)for b in packed[i:i+24])+',\n')
        f.write('};\nconst uint32_t badge_native_cat_offsets[5][5]['+str(frame_count)+']='+json.dumps(revised).replace('[','{').replace(']','}')+';\n')
    (output/'native_cat_data.h').write_text('#pragma once\n#include <stdint.h>\n#define BADGE_NATIVE_CAT_FRAME_COUNT '+str(frame_count)+'u\nextern const uint8_t badge_native_cat_data[];\nextern const uint32_t badge_native_cat_offsets[5][5][BADGE_NATIVE_CAT_FRAME_COUNT];\n#define BADGE_NATIVE_CAT_DATA_BYTES '+str(len(packed))+'u\n#define BADGE_NATIVE_CAT_MAX_RLE_BYTES '+str(maximum)+'u\n')
    return {'format':'zlib-wrapped-rle-v1','layers':layers,'uncompressedRleBytes':len(raw),'uncompressedRleSha256':hashlib.sha256(raw).hexdigest(),'bytes':len(packed),'sha256':hashlib.sha256(packed).hexdigest(),'maxDecodedLayerBytes':maximum,'losslessProductionPackagingOnly':True}

if __name__=='__main__':
    output=Path(__file__).resolve().parents[1]/'main/assets/native-cat'
    source=(output/'native_cat_data.c').read_text()
    if 'BADGE_NATIVE_CAT_MAX_RLE_BYTES' in (output/'native_cat_data.h').read_text():raise SystemExit('Already packaged; use raw production conversion for repackaging')
    data=re.search(r'badge_native_cat_data\[\]=\{([\s\S]*?)\};',source).group(1)
    raw=bytes(int(x)for x in re.findall(r'\d+',data))
    table=source.split('badge_native_cat_offsets[5][5][66]=',1)[1].split(';',1)[0]
    offsets=json.loads(table.replace('{','[').replace('}',']'))
    result=write_assets(output,raw,offsets)
    provenance=json.loads((output/'provenance.json').read_text());provenance['packaging']=result
    (output/'provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
    print(json.dumps(result))
