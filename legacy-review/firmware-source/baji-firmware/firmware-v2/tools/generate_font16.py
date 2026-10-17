"""Rebuild V2 16px font with all renderer literal strings; no legacy font edits."""
import pathlib,re,subprocess
root=pathlib.Path(__file__).resolve().parents[2]
source=(root/'firmware-v2/render/baji_render.c').read_text(encoding='utf-8')
symbols=''.join(dict.fromkeys(''.join(re.findall(r'"([^"\n]*)"',source))))
node=pathlib.Path(r'C:\Users\admin\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe')
cmd=[str(node),str(root/'build/host/node_modules/lv_font_conv/lv_font_conv.js'),
 '--font',str(root/'managed_components/lvgl__lvgl/scripts/built_in_font/SourceHanSansSC-Normal.otf'),
 '--size','16','--bpp','4','--format','lvgl','--no-compress','--no-kerning',
 '--symbols',symbols,'--lv-font-name','bj_font16','-o',str(root/'firmware-v2/render/generated/bj_font16.c')]
raise SystemExit(subprocess.run(cmd,cwd=root).returncode)
