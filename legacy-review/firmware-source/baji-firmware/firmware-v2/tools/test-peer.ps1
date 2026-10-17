param([string]$Compiler = 'gcc')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$build = Join-Path $root 'tests\peer-build'
$cc = (Get-Command $Compiler -ErrorAction Stop).Source
New-Item -ItemType Directory -Path $build -Force | Out-Null
$exe = Join-Path $build 'test_peer_auth.exe'
& $cc -std=c11 -O2 -Wall -Wextra -Werror "-I$root\interaction" "$root\interaction\baji_peer_auth.c" "$root\interaction\baji_peer.c" "$root\interaction\baji_data.c" "$root\interaction\baji_active.c" "$root\interaction\baji_protocol.c" "$root\interaction\baji_social_policy.c" "$root\tests\test_peer_auth.c" -lbcrypt -o $exe
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $exe
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output 'PASS isolated host CNG peer oracle; physical BLE and ESP adapter not covered'
exit 0
