param()
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$compiler = 'C:\Users\admin\AppData\Local\Microsoft\WinGet\Packages\MartinStorsjo.LLVM-MinGW.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\llvm-mingw-20260908-ucrt-x86_64\bin\gcc.exe'
$build = Join-Path $root 'build'
New-Item -ItemType Directory -Path $build -Force | Out-Null
& $compiler -std=c11 -O2 -Wall -Wextra -Werror "-I$root\interaction" "$root\interaction\baji_gesture.c" "$root\tests\test_gesture.c" -o "$build\test_gesture.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& "$build\test_gesture.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$firmwareCompiler = 'C:\Espressif\tools\xtensa-esp-elf\esp-14.2.0_20260121\xtensa-esp-elf\bin\xtensa-esp32s3-elf-gcc.exe'
& $firmwareCompiler -std=c11 -O2 -Wall -Wextra -Werror "-I$root\interaction" -c "$root\interaction\baji_gesture.c" -o "$build\gesture_xtensa.o"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $compiler -std=c11 -O2 -Wall -Wextra -Werror "-I$root\interaction" "$root\interaction\baji_scene.c" "$root\interaction\baji_gesture.c" "$root\tests\test_scene.c" -o "$build\test_scene.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& "$build\test_scene.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $firmwareCompiler -std=c11 -O2 -Wall -Wextra -Werror "-I$root\interaction" -c "$root\interaction\baji_scene.c" -o "$build\scene_xtensa.o"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $compiler -std=c11 -O2 -Wall -Wextra -Werror "-I$root\interaction" "$root\interaction\baji_controller.c" "$root\interaction\baji_scene.c" "$root\interaction\baji_gesture.c" "$root\tests\test_controller.c" -o "$build\test_controller.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& "$build\test_controller.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $firmwareCompiler -std=c11 -O2 -Wall -Wextra -Werror "-I$root\interaction" -c "$root\interaction\baji_controller.c" -o "$build\controller_xtensa.o"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $compiler -std=c11 -O2 -Wall -Wextra -Werror "-I$root\interaction" "$root\interaction\baji_power.c" "$root\tests\test_power.c" -o "$build\test_power.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& "$build\test_power.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $firmwareCompiler -std=c11 -O2 -Wall -Wextra -Werror "-I$root\interaction" -c "$root\interaction\baji_power.c" -o "$build\power_xtensa.o"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $compiler -std=c11 -O2 -Wall -Wextra -Werror "-I$root\interaction" "$root\tests\test_pmic_decode.c" -o "$build\test_pmic_decode.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& "$build\test_pmic_decode.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $compiler -std=c11 -O2 -Wall -Wextra -Werror "-I$root\interaction" "$root\interaction\baji_protocol.c" "$root\tests\test_protocol.c" -o "$build\test_protocol.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& "$build\test_protocol.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $firmwareCompiler -std=c11 -O2 -Wall -Wextra -Werror "-I$root\interaction" -c "$root\interaction\baji_protocol.c" -o "$build\protocol_xtensa.o"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $compiler -std=c11 -O2 -Wall -Wextra -Werror "-I$root\interaction" "$root\interaction\baji_link.c" "$root\interaction\baji_protocol.c" "$root\interaction\baji_controller.c" "$root\interaction\baji_scene.c" "$root\interaction\baji_gesture.c" "$root\tests\test_link.c" -o "$build\test_link.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& "$build\test_link.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $firmwareCompiler -std=c11 -O2 -Wall -Wextra -Werror "-I$root\interaction" -c "$root\interaction\baji_link.c" -o "$build\link_xtensa.o"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $firmwareCompiler -std=c11 -O2 -Wall -Wextra -Werror "-I$root\interaction" -c "$root\tests\test_pmic_decode.c" -o "$build\pmic_decode_xtensa.o"
exit $LASTEXITCODE