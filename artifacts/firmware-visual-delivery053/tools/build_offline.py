#!/usr/bin/env python3
from pathlib import Path
import os,subprocess,json
OUT=Path(__file__).resolve().parents[1];ROOT=OUT.parents[1]
env=dict(os.environ);env.update(IDF_PATH=str(ROOT/'.tools/esp-idf'),IDF_TOOLS_PATH=str(ROOT/'.tools/idf-tools'),IDF_COMPONENT_MANAGER='0',IDF_PYTHON_ENV_PATH=str(ROOT/'.tools/idf-tools/python_env/idf5.5_py3.13_env'))
py=ROOT/'.tools/idf-tools/python_env/idf5.5_py3.13_env/bin/python';cmake=next(ROOT.glob('.tools/idf-tools/tools/cmake/*/CMake.app/Contents/bin/cmake'));ninja=next(ROOT.glob('.tools/idf-tools/tools/ninja/*/ninja'))
paths=[str(py.parent),str(cmake.parent),str(ninja.parent),str(next(ROOT.glob('.tools/idf-tools/tools/xtensa-esp-elf/*/xtensa-esp-elf/bin'))),str(next(ROOT.glob('.tools/idf-tools/tools/esp32ulp-elf/*/esp32ulp-elf/bin')))]
env['PATH']=os.pathsep.join(paths+[env['PATH']]);build=OUT/'build'
with (OUT/'configure.log').open('w') as f:
 subprocess.run([str(cmake),'-S',str(OUT/'source'),'-B',str(build),'-G','Ninja','-DIDF_TARGET=esp32s3','-DPYTHON='+str(py),'-DPYTHON_DEPS_CHECKED=1'],env=env,stdout=f,stderr=subprocess.STDOUT,check=True)
with (OUT/'build.log').open('w') as f:
 subprocess.run([str(cmake),'--build',str(build),'--parallel','2'],env=env,stdout=f,stderr=subprocess.STDOUT,check=True)
print('offline build complete',flush=True)
