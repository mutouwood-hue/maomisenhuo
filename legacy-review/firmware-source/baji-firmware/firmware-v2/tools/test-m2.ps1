$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$compiler = 'C:\Users\admin\AppData\Local\Microsoft\WinGet\Packages\MartinStorsjo.LLVM-MinGW.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\llvm-mingw-20260908-ucrt-x86_64\bin\gcc.exe'
$firmwareCompiler = 'C:\Espressif\tools\xtensa-esp-elf\esp-14.2.0_20260121\xtensa-esp-elf\bin\xtensa-esp32s3-elf-gcc.exe'
$build = Join-Path $root 'build\m2'
New-Item -ItemType Directory -Path $build -Force | Out-Null
& $compiler -std=c11 -O2 -Wall -Wextra -Werror "-I$root\interaction" "$root\interaction\baji_social_policy.c" "$root\interaction\baji_audio_policy.c" "$root\tests\test_m2_policy.c" -o "$build\test_m2_policy.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& "$build\test_m2_policy.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $compiler -std=c11 -O2 -Wall -Wextra -Werror "-I$root\interaction" "$root\interaction\baji_env_model.c" "$root\tests\test_env_model.c" -lm -o "$build\test_env_model.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$output = & "$build\test_env_model.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$output
$fixtures = Get-Content -Raw -Encoding UTF8 (Join-Path (Split-Path $root -Parent) 'tools\environment-model\feature-fixtures.json') | ConvertFrom-Json
$seen = @{}
$valueCount = 0
foreach ($line in $output) {
    if ($line -notmatch '^FEATURE ') { continue }
    $parts = $line.Split(' ')
    $index = [int]$parts[1]
    if ($parts.Length -ne 14 -or $index -lt 0 -or $index -ge 5 -or $seen.ContainsKey($index)) { throw 'Invalid or duplicate DSP frame' }
    $seen[$index] = $true
    for ($feature = 0; $feature -lt 12; $feature++) {
        $actual = [double]::Parse($parts[$feature + 2], [System.Globalization.CultureInfo]::InvariantCulture)
        if ([double]::IsNaN($actual) -or [double]::IsInfinity($actual) -or [math]::Abs($actual - $fixtures.frames[$index].frameFeatures[$feature]) -gt 0.0005) { throw "DSP mismatch fixture $index feature $feature" }
        $valueCount++
    }
}
if ($seen.Count -ne 5 -or $valueCount -ne 60) { throw 'Expected exactly 5 DSP frames and 60 values' }
Write-Output 'PASS C/Python 60 golden DSP values; NOT scene accuracy'
& $compiler -std=c11 -O2 -Wall -Wextra -Werror "-I$root\interaction" "$root\interaction\baji_update.c" "$root\tests\test_update.c" -o "$build\test_update.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& "$build\test_update.exe"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
foreach ($source in @('social_policy', 'audio_policy', 'env_model', 'update')) {
    & $firmwareCompiler -std=c11 -O2 -Wall -Wextra -Werror "-I$root\interaction" -c "$root\interaction\baji_$source.c" -o "$build\$($source)_xtensa.o"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
exit 0
