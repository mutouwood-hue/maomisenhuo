from pathlib import Path
import subprocess,re,json,hashlib
R=Path.cwd();O=R/'tests/firmware043-review';C=R/'artifacts/firmware-visual-integration043';A=R/'artifacts/firmware-visual-integration042/source/main';S=C/'source/main';flags=['clang','-std=gnu11','-O1','-g','-fsanitize=address,undefined','-fno-omit-frame-pointer','-ffp-contract=off','-Wall','-Wextra'];cmds=[];logs=[]
funcs=sorted(set(re.findall(r'\b(vr_[a-z_]+)\(', (A/'badge_renderer_exact.c').read_text())))
for src,out,extra in [(A/'badge_renderer_exact.c',O/'reference042.o',['-D'+x+'=ref_'+x for x in funcs]),(S/'badge_renderer_exact.c',O/'cached043.o',[])]:
 cmd=flags+['-I'+str(src.parent),*extra,'-c',str(src),'-o',str(out)];p=subprocess.run(cmd,capture_output=True,text=True);cmds.append(cmd);logs.append(p.stdout+p.stderr);assert not p.returncode,p.stderr
cmd=flags+['-I'+str(S),str(O/'cache_independent.c'),str(O/'reference042.o'),str(O/'cached043.o'),'-o',str(O/'cache-independent')];p=subprocess.run(cmd,capture_output=True,text=True);cmds.append(cmd);logs.append(p.stdout+p.stderr);(O/'cache-build.log').write_text(''.join(logs));assert not p.returncode,p.stderr
p=subprocess.run([str(O/'cache-independent'),str(S/'assets/pixel-cat.pcat'),str(S/'assets/room-cache.bin')],capture_output=True,text=True);(O/'cache-run.log').write_text(p.stdout+p.stderr);assert not p.returncode,p.stderr
x=json.loads(p.stdout);x.update(scope='actual frozen042 C and043 cached C, ASAN+UBSAN, explicit host allocator/clock; not target timing',compile=cmds);(O/'cache-independent-results.json').write_text(json.dumps(x,indent=2)+'\n');print(p.stdout)
