import json, pathlib, re, subprocess
root=pathlib.Path(__file__).resolve().parents[1]
commands=json.loads(pathlib.Path(r'D:\orangecat-build\compile_commands.json').read_text())
entry=next(x for x in commands if any(x['file'].replace('\\','/').endswith(s) for s in ('/main/ui/badge_ui.c','/firmware-v2/runtime/baji_main.c')))
cmd=entry['command']
compiler=re.match(r'(.*?gcc.exe)',cmd).group(1)
flags=re.findall(r'-I[^\s]+|-D[^\s]+',cmd[len(compiler):])
flags=[x.replace('\\"','"') for x in flags]
flags=['-I'+str(root/'interaction'),'-I'+str(root/'render'),'-I'+str(root/'render/generated')]+flags
flags+=['-std=gnu17','-Wall','-Wextra','-Werror','-DLV_LVGL_H_INCLUDE_SIMPLE']
for file in [root/'interaction/baji_data.c',root/'runtime/baji_data_runtime.c',root/'runtime/baji_ble.c',root/'runtime/baji_pmic.c',root/'runtime/baji_main.c',root/'render/baji_render.c',*sorted((root/'render/generated').glob('*.c'))]:
    result=subprocess.run([compiler,*flags,'-c',str(file),'-o',str(root/'build'/f'{file.stem}_render.o')],cwd=entry['directory'])
    if result.returncode: raise SystemExit(result.returncode)
print('V2 PMIC adapter, runtime entry, renderer, generated HTML assets and fonts compiled with production LVGL/ESP-IDF headers.')
