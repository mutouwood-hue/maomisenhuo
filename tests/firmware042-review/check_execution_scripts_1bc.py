from pathlib import Path
import ast,collections,datetime,hashlib,json,time,contextlib,io
R=Path.cwd();O=R/'tests/firmware042-review'; B=R/'artifacts/device-backups/esp-usb-7c0c5f423684/2026-10-16T1052Z-3d042'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
expected={'run_stage.py':'163f45ba26e7edae535036c45675136ab43c9af54444081fcbb3d84fb9957910','esptool_no_write_retry.py':'14e37af0c6f38c2f4792e0e80d068517b5826263d7bdb6d2a0fa80880fe9b4e4','diagnostic_session.py':'1bc656367c4d3084fe39e8af3958f2f241f0b3373b423bb0c08fc5edbf7df187'}
assert all(sha(B/n)==h for n,h in expected.items())
s=(B/'diagnostic_session.py').read_text();tree=ast.parse(s);fn=next(x for x in tree.body if isinstance(x,ast.FunctionDef) and x.name=='handle');code=compile(ast.Module(body=[fn],type_ignores=[]),'<only-handle-no-serial-import>','exec')
cases=[]
def run(name,line,pending=True,boot=False,enabled=False):
 g={'json':json,'datetime':datetime.datetime,'timezone':datetime.timezone,'time':time,'save':lambda:None,'ready':True,'due':0,'pending':{'command':'CFDIAG RENDER 1'} if pending else None,'commands':['CFDIAG CAPTURE'],'auto_locked':False,'boot_seen':boot,'enabled_seen':enabled,'linebuf':bytearray(),'entry':{'events':[]}}
 exec(code,g);p=g['pending']
 with contextlib.redirect_stdout(io.StringIO()):g['handle'](line.encode())
 cases.append({'name':name,'locked':g['auto_locked'],'pending':g['pending'] is not None,'remaining':len(g['commands']),'validated':p.get('renderTerminalValidated') if p else None});return g
valid={'valid':True,'published':True,'completeFrame':True,'sample':1}
for name,delta in [('valid',{}),('invalid',{'valid':False}),('unpublished',{'published':False}),('partial',{'completeFrame':False}),('wrong-sample',{'sample':0}),('bool-sample',{'sample':True}),('float-sample',{'sample':1.0}),('string-sample',{'sample':'1'}),('numeric-valid',{'valid':1})]:
 v=valid|delta;g=run(name,'CFDIAG RENDER '+json.dumps(v));assert g['auto_locked']==bool(delta);assert g['pending'] is None
for key in valid:
 v=valid.copy();del v[key];assert run('missing-'+key,'CFDIAG RENDER '+json.dumps(v))['auto_locked']
assert run('bad-json','CFDIAG RENDER {x}')['auto_locked']
g=run('begin-progress','CFDIAG RENDER_BEGIN {"sample":1}');assert g['pending'] is not None and not g['auto_locked']
assert run('explicit-error','CFDIAG ERROR rejected')['auto_locked']
g=run('second-boot-idle','ESP-ROM:esp32s3',pending=False,boot=True);assert g['auto_locked'] and not g['ready'] and not g['commands']
g=run('second-ready-idle','Local USB diagnostic commands enabled',pending=False,enabled=True);assert g['auto_locked'] and not g['ready'] and not g['commands']
# AST structure only for outer transport path: no top-level imports/run/reset executed.
handlers=[n for n in ast.walk(tree) if isinstance(n,ast.ExceptHandler)]
transport=next(n for n in handlers if 'transportException' in ast.unparse(n))
body=ast.unparse(transport)
assert 'auto_locked = True' in body and 'commands = []' in body and 'ready = False' in body and 'linebuf.clear()' in body and 'incompleteTransport' in body and 'pending = None' in body
stage=ast.parse((B/'run_stage.py').read_text()); wrapper=ast.parse((B/'esptool_no_write_retry.py').read_text());assert 'executionArtifacts' in ast.unparse(stage)
result={'scope':'AST-extracted actual handle function only; no serial imports or hardware execution. Outer transport branch reviewed statically. Stage gate reviewed statically.','executionArtifacts':[{'path':str((B/n).relative_to(R)),'sha256':h} for n,h in expected.items()],'cases':cases,'allPass':True}
(O/'execution-script-results.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'cases':len(cases),'allPass':True,'executionPins':expected}))
