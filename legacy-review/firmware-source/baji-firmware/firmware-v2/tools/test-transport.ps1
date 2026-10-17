param(
    [string]$Compiler = 'C:\Users\admin\AppData\Local\Microsoft\WinGet\Packages\MartinStorsjo.LLVM-MinGW.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\llvm-mingw-20260908-ucrt-x86_64\bin\gcc.exe'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
# Keep all generated artifacts within this task's exclusive transport-* scope.
$build = Join-Path $root 'tests\transport-build'
New-Item -ItemType Directory -Path $build -Force | Out-Null
$sources = @(
    "$root\tests\transport-regression.c",
    "$root\interaction\baji_link.c",
    "$root\interaction\baji_protocol.c",
    "$root\interaction\baji_controller.c",
    "$root\interaction\baji_scene.c",
    "$root\interaction\baji_gesture.c"
)
$exe = Join-Path $build 'transport-regression.exe'
& $Compiler -std=c11 -O2 -Wall -Wextra -Werror "-I$root\tests\transport-mocks" "-I$root\interaction" @sources -o $exe
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $exe
exit $LASTEXITCODE
