from pathlib import Path
import json,subprocess,ctypes
r=Path(r'D:/黑客松/新建文件夹/maomishenhuo');out=r/'work/integrated/badge'
for name in ['host-live-drag.log','host-day-draw.log']:
    p=out/name;b=p.read_bytes();text=b.decode('utf-16') if b.startswith((b'\xff\xfe',b'\xfe\xff')) else b.decode('utf-8-sig');p.write_text(text,encoding='utf-8')
shell=ctypes.windll.shell32;shell.CommandLineToArgvW.restype=ctypes.POINTER(ctypes.c_wchar_p)
entries=json.loads((r/'work/integrated/neighbor-build-clean-env/compile_commands.json').read_text(encoding='utf-8'))
names=['badge_pages.c','badge_gesture.c','local2_core.c','local2_wire.c','local2_ble.c'];results=[]
with (out/'syntax.log').open('w',encoding='utf-8') as log:
    for name in names:
        e=next(e for e in entries if e['file'].replace('\\','/').endswith('/main/'+name));n=ctypes.c_int();p=shell.CommandLineToArgvW(e['command'],ctypes.byref(n));args=[p[i] for i in range(n.value)];ctypes.windll.kernel32.LocalFree(p)
        kept=[];skip=False
        for a in args:
            if skip:skip=False;continue
            if a=='-o':skip=True;continue
            if a=='-c' or a.replace('\\','/')==e['file'].replace('\\','/'):continue
            a=a.replace('R:/artifacts/lock-clean-fix/badge/source','R:/work/integrated/badge/source').replace('R:\\artifacts\\lock-clean-fix\\badge\\source','R:\\work\\integrated\\badge\\source')
            kept.append(a)
        kept+=['-fsyntax-only','R:/work/integrated/badge/source/main/'+name]
        log.write('=== '+name+' ===\n');log.flush()
        code=subprocess.run(kept,cwd=e['directory'],stdout=log,stderr=log).returncode
        log.write('EXIT '+str(code)+'\n');log.flush();results.append({'file':name,'exit':code});print(name,code)
(out/'syntax-results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
raise SystemExit(1 if any(x['exit'] for x in results) else 0)
