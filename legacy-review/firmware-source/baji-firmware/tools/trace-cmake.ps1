# Diagnostic: find the exact CMake statement that faults inside cmake.exe.
#
# WHY: idf.py build aborts the configure step with 0xC0000409 -- a fault inside the
# cmake process, not a CMake script error, so there is no message and no
# CMakeConfigureLog entry. --debug-output names the failing file, but not the failing
# statement, because it prints nothing for a fault. --trace does: it echoes every
# statement as it is executed, so the last line before the process dies is the call
# that faulted.
#
# CMAKE_MODULE_PATH is seeded with the managed component that now ships a FindZLIB
# shim. Without that seed this script reproduces the *old* crash (CMake's stock
# FindZLIB host probe); with it, it reproduces the current one. That difference is how
# the shim was verified to be doing its job.
#
# NOTE: this file must stay pure ASCII. Windows PowerShell 5.1 reads a .ps1 without a
# BOM using the system ANSI codepage (GBK here), so a non-ASCII literal would be
# mis-decoded, and a stray GBK trail byte can even swallow a closing quote and produce
# a spurious "missing the terminator" parse error. Paths come from $PSScriptRoot.
#
# Usage: powershell -ExecutionPolicy Bypass -File tools\trace-cmake.ps1 [-Tail 60]

param(
    [int]$Tail = 60,
    [switch]$NoShimSeed,
    [string]$BuildDir = 'D:\orangecat-trace'
)

$ErrorActionPreference = 'Continue'

$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'

$profileScript = 'C:\Espressif\tools\Microsoft.v5.5.5.PowerShell_profile.ps1'
. $profileScript *> $null

$python = 'C:\Espressif\tools\python\v5.5.5\venv\Scripts\python.exe'
$cmake = 'C:\Espressif\tools\cmake\3.30.2\bin\cmake.exe'
$srcDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$zlibDir = Join-Path $srcDir 'managed_components\espressif__zlib'

if (-not (Test-Path $cmake)) {
    Write-Error "cmake not found at $cmake"
    exit 1
}
if (Test-Path $BuildDir) { Remove-Item -Recurse -Force $BuildDir }
New-Item -ItemType Directory -Path $BuildDir | Out-Null

$log = Join-Path $BuildDir 'trace-cmake.log'

Write-Host "=== cmake --trace (source $srcDir, build $BuildDir) ===" -ForegroundColor Cyan
if ($NoShimSeed) {
    Write-Host '    not seeding CMAKE_MODULE_PATH (reproduces the original fault)' -ForegroundColor DarkGray
} else {
    Write-Host "    seeding CMAKE_MODULE_PATH with $zlibDir" -ForegroundColor DarkGray
}

$cmakeArgs = @(
    '-G', 'Ninja',
    '-DPYTHON_DEPS_CHECKED=1',
    "-DPYTHON=$python",
    '-DESP_PLATFORM=1',
    '-DCCACHE_ENABLE=0'
)
if (-not $NoShimSeed) { $cmakeArgs += "-DCMAKE_MODULE_PATH=" + $zlibDir.Replace('\', '/') }
$cmakeArgs += @('--trace', '-B', $BuildDir, $srcDir)

# Redirection is done by cmd itself so the log holds raw bytes rather than
# PowerShell's UTF-16 rendering.
$cmdLine = 'cd /d "{0}" && "{1}" {2} > "{3}" 2>&1' -f $srcDir, $cmake, (($cmakeArgs | ForEach-Object {
    if ($_ -match '\s') { '"' + $_ + '"' } else { $_ }
}) -join ' '), $log

& cmd.exe /c "$cmdLine"
$code = $LASTEXITCODE
Write-Host ("exit: {0} (0x{1:X8})" -f $code, [int64]($code -band 0xFFFFFFFFL))

if (-not (Test-Path $log)) {
    Write-Error "no log produced at $log"
    exit 1
}

$text = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($log))
$lines = $text -split "`r?`n"
Write-Host "=== total lines: $($lines.Count); showing the last $Tail ===" -ForegroundColor Cyan
$lines | Select-Object -Last $Tail
