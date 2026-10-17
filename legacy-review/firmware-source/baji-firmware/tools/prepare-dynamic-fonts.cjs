/* Preserve existing glyphs; append native-size dynamic UI glyphs before sparse cmaps. */
const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');
const root = path.resolve(__dirname, '..');
function arr(t,n) { const re=new RegExp('('+n+'\\[\\]\\s*=\\s*\\{)([\\s\\S]*?)(\\n\\};)'); const m=t.match(re); if(!m)throw Error(n); return {re,body:m[2]}; }
function nums(s) { return (s.replace(/\/\*[\s\S]*?\*\//g,'').match(/-?0x[\da-f]+|-?\d+/gi)||[]).map(Number); }
const chars=new Set();
for(const name of ['badge_ui.c','badge_fsm.c']) {
 const source=fs.readFileSync(path.join(root,'main/ui',name),'utf8');
 // Keep string literals, discard comments: comments must never expand the shipped font.
 const tokens=source.match(/"(?:\\.|[^"\\])*"|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g)||[];
 for(const token of tokens) if(token.startsWith('"')) {
  const value=token.slice(1,-1).replace(/\\u([\da-f]{4})/gi,(_,v)=>String.fromCodePoint(parseInt(v,16)));
  for(const ch of value)if(ch.codePointAt(0)>127)chars.add(ch);
 }
}
const check=process.argv.includes('--check');
for(const size of [16,20,24]) {
 const file=path.join(root,`main/ui/fonts/badge_f${size}.c`);
 let text=fs.readFileSync(file,'utf8');
 const present=new Set([...text.matchAll(/U\+([\da-f]{4,6})/gi)].map(m=>parseInt(m[1],16)));
 const missing=[...chars].filter(c=>!present.has(c.codePointAt(0))).sort((a,b)=>a.codePointAt(0)-b.codePointAt(0));
 if(!missing.length){ console.log(`f${size}: dynamic UI coverage OK`);continue; }
 if(check)throw Error(`f${size}: missing ${missing.join('')}`);
 const extraFile=path.join(root,`build/host/dynamic-extra${size}.c`);
 const run=spawnSync(process.execPath,[path.join(root,'build/host/node_modules/lv_font_conv/lv_font_conv.js'),'--font',path.join(root,'managed_components/lvgl__lvgl/scripts/built_in_font/SourceHanSansSC-Normal.otf'),'--size',String(size),'--bpp','4','--format','lvgl','--no-compress','--no-kerning','--symbols',missing.join(''),'--lv-font-name',`dynamic_extra${size}`,'-o',extraFile],{stdio:'inherit'});
 if(run.status!==0)throw Error('Converter '+run.status);
 const extra=fs.readFileSync(extraFile,'utf8');
 const bitmap=arr(text,'glyph_bitmap'), oldBytes=nums(bitmap.body);
 const ds=arr(text,'glyph_dsc'), oldDs=ds.body.match(/\{[^{}]+\}/g), gid=oldDs.length;
 const addedDs=arr(extra,'glyph_dsc').body.match(/\{[^{}]+\}/g).slice(1).map(d=>d.replace(/\.bitmap_index = (\d+)/,(_,v)=>`.bitmap_index = ${oldBytes.length+Number(v)}`));
 if(addedDs.length!==missing.length)throw Error('Glyph count');
 text=text.replace(bitmap.re,(_,a,b,c)=>a+b.trimEnd()+',\n'+arr(extra,'glyph_bitmap').body+c);
 text=text.replace(ds.re,(_,a,b,c)=>a+b.trimEnd()+',\n'+addedDs.join(',\n')+c);
 for(const n of ['kern_left_class_mapping','kern_right_class_mapping']) {
  const ar=arr(text,n);if(nums(ar.body).length!==gid)throw Error('Kern '+n);
  text=text.replace(ar.re,(_,a,b,c)=>a+b.trimEnd()+', '+missing.map(()=>0).join(', ')+c);
 }
 const maps=missing.map((ch,i)=>`    { .range_start = ${ch.codePointAt(0)}, .range_length = 1, .glyph_id_start = ${gid+i}, .unicode_list = NULL, .glyph_id_ofs_list = NULL, .list_length = 0, .type = LV_FONT_FMT_TXT_CMAP_FORMAT0_TINY },`).join('\n');
 text=text.replace(/(static const lv_font_fmt_txt_cmap_t cmaps\[\] =\s*\{)/,`$1\n${maps}`);
 text=text.replace(/\.cmap_num = (\d+),/,(_,n)=>`.cmap_num = ${Number(n)+missing.length},`);
 if(JSON.stringify(nums(arr(text,'glyph_bitmap').body).slice(0,oldBytes.length))!==JSON.stringify(oldBytes))throw Error('Old pixels changed');
 if(JSON.stringify(arr(text,'glyph_dsc').body.match(/\{[^{}]+\}/g).slice(0,gid))!==JSON.stringify(oldDs))throw Error('Old metrics changed');
 fs.writeFileSync(file,text);console.log(`f${size}: added ${missing.length} native glyphs: ${missing.join('')}`);
}
