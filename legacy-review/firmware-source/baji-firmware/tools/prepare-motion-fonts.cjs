/* Add only U+9519: retain every existing bitmap, glyph id, metric and kerning entry.
 * Run with bundled Node after installing lv_font_conv under build/host.
 * The new singleton cmap precedes the old broad sparse cmap: LVGL returns 0
 * immediately on a sparse miss inside that broad range, so appending it is wrong.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const host = path.join(root, 'build/host');
const source = path.join(root, 'managed_components/lvgl__lvgl/scripts/built_in_font/SourceHanSansSC-Normal.otf');
const conv = path.join(host, 'node_modules/lv_font_conv/lv_font_conv.js');
function array(text, name) {
  const re = new RegExp('('+name+'\\[\\]\\s*=\\s*\\{)([\\s\\S]*?)(\\n\\};)');
  const m = text.match(re);
  if (!m) throw new Error('Missing array '+name);
  return { re, body: m[2] };
}
function nums(s) { return (s.replace(/\/\*[\s\S]*?\*\//g, '').match(/-?0x[\da-f]+|-?\d+/gi)||[]).map(Number); }
for (const size of [16, 24]) {
  const file = path.join(root, `main/ui/fonts/badge_f${size}.c`);
  let text = fs.readFileSync(file, 'utf8');
  if (/\/\* U\+9519 "错" \*\//.test(text)) { console.log(`badge_f${size}: already patched`); continue; }
  const before = text;
  fs.writeFileSync(path.join(host, `badge_f${size}-before.c`), before);
  const extraFile = path.join(host, `motion_extra${size}.c`);
  const run = spawnSync(process.execPath, [conv, '--font', source, '--size', String(size), '--bpp', '4', '--format', 'lvgl', '--no-compress', '--no-kerning', '--symbols', '错', '--lv-font-name', `motion_extra${size}`, '-o', extraFile], { stdio: 'inherit' });
  if (run.status !== 0) throw new Error('Converter failed: '+run.status);
  const extra = fs.readFileSync(extraFile, 'utf8');
  const bitmap = array(text, 'glyph_bitmap');
  const oldBytes = nums(bitmap.body);
  const added = array(extra, 'glyph_bitmap').body;
  const newBytes = nums(added);
  const ds = array(text, 'glyph_dsc');
  const oldDs = ds.body.match(/\{[^{}]+\}/g);
  const gid = oldDs.length;
  let newDsc = array(extra, 'glyph_dsc').body.match(/\{[^{}]+\}/g)[1];
  newDsc = newDsc.replace(/\.bitmap_index = \d+/, `.bitmap_index = ${oldBytes.length}`);
  const metric = Object.fromEntries([...newDsc.matchAll(/\.(\w+) = (-?\d+)/g)].map(m => [m[1], Number(m[2])]));
  if (newBytes.length !== Math.ceil(metric.box_w*metric.box_h/2) || !newBytes.some(v=>v)) throw new Error('Invalid 4bpp raster');
  text = text.replace(bitmap.re, (_, a, b, c) => a + b.trimEnd() + ',\n' + added + c);
  text = text.replace(ds.re, (_, a, b, c) => a + b.trimEnd() + ',\n    ' + newDsc + ' /* U+9519 错 */' + c);
  for (const name of ['kern_left_class_mapping', 'kern_right_class_mapping']) {
    const ar = array(text, name);
    if (nums(ar.body).length !== gid) throw new Error('Unexpected kerning map length');
    text = text.replace(ar.re, (_, a, b, c) => a + b.trimEnd() + ', 0 /* U+9519: no kerning class */' + c);
  }
  text = text.replace(/(static const lv_font_fmt_txt_cmap_t cmaps\[\] =\s*\{)/, `$1\n    {\n        .range_start = 38169, .range_length = 1, .glyph_id_start = ${gid},\n        .unicode_list = NULL, .glyph_id_ofs_list = NULL, .list_length = 0, .type = LV_FONT_FMT_TXT_CMAP_FORMAT0_TINY\n    },`);
  text = text.replace(/\.cmap_num = 2,/, '.cmap_num = 3,');
  text = text.replace(' * Bpp: 4', ' * Bpp: 4\n * Added U+9519 错 at native size from SourceHanSansSC-Normal.otf using lv_font_conv 1.5.3.\n * Existing glyphs and kerning are preserved; regenerate additions with tools/prepare-motion-fonts.cjs.');
  if (JSON.stringify(nums(array(text,'glyph_bitmap').body).slice(0,oldBytes.length)) !== JSON.stringify(oldBytes)) throw new Error('Old bitmap changed');
  const afterDs = array(text,'glyph_dsc').body.match(/\{[^{}]+\}/g);
  if (JSON.stringify(afterDs.slice(0,gid)) !== JSON.stringify(oldDs)) throw new Error('Old metrics changed');
  for (const name of ['unicode_list_1','kern_left_class_mapping','kern_right_class_mapping','kern_class_values']) {
    const old = nums(array(before,name).body), after = nums(array(text,name).body);
    if (JSON.stringify(after.slice(0,old.length)) !== JSON.stringify(old)) throw new Error('Changed '+name);
  }
  fs.writeFileSync(file,text);
  console.log(`badge_f${size}: appended genuine 错 gid=${gid}, bitmap=${oldBytes.length}+${newBytes.length} bytes, box=${metric.box_w}x${metric.box_h}, advance=${metric.adv_w}/16 px; all old data preserved`);
}
