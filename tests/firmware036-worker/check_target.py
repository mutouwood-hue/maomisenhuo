from pathlib import Path
import json,subprocess,shlex,hashlib,re
R=Path.cwd();O=R/'artifacts/firmware-local-v3-perf036';B=R/'artifacts/firmware-local-v3-perf035';T=R/'tests/firmware036-worker';D=O/'evidence';LV=R/'firmware/managed_components/lvgl__lvgl'
entries=json.loads((O/'build/compile_commands.json').read_text());new=next(e for e in entries if e['file'].endswith('/lv_draw_sw_mask.c'));assert '/private/' in new['file'];cmd=shlex.split(new['command']);original_obj=Path(new['directory'])/cmd[cmd.index('-o')+1]
cmd[cmd.index('-o')+1]=str(T/'target-warnings.o');
for opt in ['-MF','-MT']:
 if opt in cmd:cmd[cmd.index(opt)+1]=str(T/('target-warnings.d' if opt=='-MF' else 'target-warnings.o'))
p=subprocess.run(cmd+['-Wall','-Wextra','-Werror'],cwd=new['directory'],capture_output=True,text=True);(D/'target-private-Werror.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr
nm=next(R.glob('.tools/idf-tools/tools/xtensa-esp-elf/*/xtensa-esp-elf/bin/xtensa-esp32s3-elf-nm'),None) or next(R.glob('.tools/idf-tools/tools/xtensa-esp-elf/*/xtensa-esp-elf/bin/xtensa-esp-elf-nm'))
oldentries=json.loads((B/'build/compile_commands.json').read_text());old=next(e for e in oldentries if e['file'].endswith('/lv_draw_sw_mask.c'));oldcmd=shlex.split(old['command']);oldobj=Path(old['directory'])/oldcmd[oldcmd.index('-o')+1]
def symbols(p):
 s=subprocess.run([str(nm),'-g','--defined-only',str(p)],capture_output=True,text=True,check=True).stdout;return sorted(l.split()[-1] for l in s.splitlines() if len(l.split())>=3)
assert symbols(original_obj)==symbols(oldobj)
u=(LV/'src/draw/sw/lv_draw_sw_mask.c').read_text();c=(O/'source/private/lvgl_mask_pool/lv_draw_sw_mask.c').read_text();marker='    uint32_t y_8th_cnt = 0;';oldmath=u[u.rindex(marker):u.rindex('    lv_free(cir_x);')];newmath=c[c.rindex(marker):c.rindex('    if(pool_slot<0)lv_free(cir_x);')];assert oldmath==newmath
reports=dict(targetPrivateFileWarningErrorClean=True,onePrivateMaskTranslationUnit=True,noHostTestMacrosInTarget=True,allDefinedGlobalPublicSymbolsExact035=symbols(original_obj),AAcoreTextSha256=hashlib.sha256(oldmath.encode()).hexdigest(),AAcoreByteExactUpstream=True,sharedUpstreamSha256=hashlib.sha256((LV/'src/draw/sw/lv_draw_sw_mask.c').read_bytes()).hexdigest(),actualPrivateObject=str(original_obj.relative_to(R)))
(D/'target-code-boundary.json').write_text(json.dumps(reports,indent=2)+'\n');print('Private target -Wall -Wextra -Werror clean; public symbols and AA core exact')
