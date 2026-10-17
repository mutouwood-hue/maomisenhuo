"""Check ordered LVGL cmaps and nonblank 4bpp rasters; not a runtime pixel test."""
import pathlib,re
root=pathlib.Path(__file__).resolve().parents[2]
source=(root/'firmware-v2/render/baji_render.c').read_text(encoding='utf-8')
paths={'bj_font16':root/'firmware-v2/render/generated/bj_font16.c',
       'bj_font24':root/'firmware-v2/render/generated/bj_font24.c',
       'bj_font44':root/'firmware-v2/render/generated/bj_font44.c'}
texts={f:[] for f in paths}
for m in re.finditer(r'label\((?:p->root|p->back|r->low_root),"([^"]*)",\d+,&((?:badge_|bj_)\w+)',source):
    texts[m[2]].append(m[1])
for array,font in [('titles','bj_font24'),('subs','bj_font16')]:
    texts[font]+=re.findall(r'"([^"]*)"',re.search(rf'{array}\[\]=\{{(.*?)\}}',source)[1])
texts['bj_font24']+=['做得好！','向上滑','向下滑','向左滑','向右滑']
texts['bj_font16']+=['换回刚才的表盘','回到小猫这里','饱腹','心情','清洁','精力','健康','--%','0123456789/*:']
texts['bj_font24']+=['摸摸','喂食 0/3','喝水 0/3','逗猫 0/5','睡觉','连接 App','点一下','语音未接入']
texts['bj_font44']+=['000000','0123456789--:']
failures=0
for font,strings in texts.items():
    data=paths[font].read_text(encoding='utf-8')
    assert int(re.search(r'\.bpp\s*=\s*(\d+)',data)[1])==4, f'{font}: expected 4bpp'
    assert int(re.search(r'\.bitmap_format\s*=\s*(\d+)',data)[1])==0, f'{font}: expected uncompressed raster'
    arrays={}
    for name,body in re.findall(r'const\s+(?:uint8_t|uint16_t)\s+(\w+)\[\]\s*=\s*\{(.*?)\n\};',data,re.S):
        body=re.sub(r'/\*.*?\*/','',body,flags=re.S)
        arrays[name]=[int(x.strip(),0) for x in body.split(',') if x.strip()]
    cmap_body=re.search(r'cmaps\[\]\s*=\s*\{(.*?)\n\};',data,re.S)[1]
    maps=[{k:v.strip() for k,v in re.findall(r'\.(\w+)\s*=\s*([^,\n]+)',body)} for body in re.findall(r'\{([^{}]*)\}',cmap_body)]
    assert len(maps)==int(re.search(r'\.cmap_num\s*=\s*(\d+)',data)[1])
    descriptors=re.findall(r'\{([^{}]*)\}',re.search(r'glyph_dsc\[\]\s*=\s*\{(.*?)\n\};',data,re.S)[1])
    def lookup(cp):
        for m in maps:
            start,length,gid=(int(m[k]) for k in ('range_start','range_length','glyph_id_start'))
            rel=cp-start
            if not 0<=rel<length: continue
            if 'SPARSE' in m['type']:
                values=arrays[m['unicode_list']]
                assert len(values)==int(m['list_length'])
                assert all(a<b for a,b in zip(values,values[1:])), f'{font}: sparse cmap must be strictly sorted'
                if rel not in values: return 0
                index=values.index(rel)
            else:
                assert 'FORMAT0' in m['type']
                index=rel
            if m['glyph_id_ofs_list']!='NULL':
                offset=arrays[m['glyph_id_ofs_list']][index]
                if m['type']=='LV_FONT_FMT_TXT_CMAP_FORMAT0_FULL' and index!=0 and offset==0:
                    continue
                return gid+offset
            return gid+index
        return 0
    glyphs=set()
    for c in set(''.join(strings)):
        gid=lookup(ord(c))
        if gid:
            assert gid<len(descriptors), f'{font}: invalid glyph id {gid}'
            metric=dict(re.findall(r'\.(\w+)\s*=\s*(-?\d+)',descriptors[gid]))
            if not c.isspace():
                w,h,offset=(int(metric[k]) for k in ('box_w','box_h','bitmap_index'))
                count=(w*h+1)//2
                assert w>0 and h>0 and offset+count<=len(arrays['glyph_bitmap'])
                assert any(arrays['glyph_bitmap'][offset:offset+count]), f'{font}: blank raster {c}'
            glyphs.add(ord(c))
    missing=sorted({c for c in ''.join(strings) if not c.isspace() and ord(c) not in glyphs})
    print(f'{font}: {len(strings)} texts; missing: {"".join(missing) or "none"}')
    failures+=len(missing)
raise SystemExit(1 if failures else 0)
