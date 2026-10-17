"""Generate firmware-local fonts without editing legacy main assets."""
import pathlib,re,subprocess
root=pathlib.Path(__file__).resolve().parents[2]
source=(root/'firmware-v2/render/baji_render.c').read_text(encoding='utf-8')
symbols=''.join(dict.fromkeys('0123456789%*:/ --'+''.join(re.findall(r'"([^"\n]*)"',source))))
node=pathlib.Path(r'C:\Users\admin\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe')
for size in (16,24):
    name=f'bj_font{size}'
    cmd=[str(node),str(root/'build/host/node_modules/lv_font_conv/lv_font_conv.js'),
         '--font',str(root/'managed_components/lvgl__lvgl/scripts/built_in_font/SourceHanSansSC-Normal.otf'),
         '--size',str(size),'--bpp','4','--format','lvgl','--no-compress','--no-kerning',
         '--symbols',symbols,'--lv-font-name',name,'-o',str(root/f'firmware-v2/render/generated/{name}.c')]
    result=subprocess.run(cmd,cwd=root)
    if result.returncode: raise SystemExit(result.returncode)
