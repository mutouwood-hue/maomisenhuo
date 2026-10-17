param([string]$Compiler='C:\Users\admin\AppData\Local\Microsoft\WinGet\Packages\MartinStorsjo.LLVM-MinGW.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\llvm-mingw-20260908-ucrt-x86_64\bin\gcc.exe')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
& $Compiler -std=c11 -O2 -Wall -Wextra -Werror "-I$root\interaction" "$root\interaction\baji_data.c" "$root\interaction\baji_peer.c" "$root\interaction\baji_peer_auth.c" "$root\interaction\baji_social_policy.c" "$root\interaction\baji_active.c" "$root\interaction\baji_protocol.c" "$root\tests\test_data.c" -lbcrypt -o "$root\build\test_data.exe"
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
& "$root\build\test_data.exe"
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
& $Compiler -std=c11 -O2 -Wall -Wextra -Werror "-I$root\tests\data-runtime-mocks" "-I$root\interaction" "$root\tests\test_data_storage.c" "$root\interaction\baji_data.c" "$root\interaction\baji_peer.c" "$root\interaction\baji_peer_auth.c" "$root\interaction\baji_social_policy.c" "$root\interaction\baji_active.c" "$root\interaction\baji_protocol.c" -o "$root\build\test_data_storage.exe"
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
& "$root\build\test_data_storage.exe"
exit $LASTEXITCODE
