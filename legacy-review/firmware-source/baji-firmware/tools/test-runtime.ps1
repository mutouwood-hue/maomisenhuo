param([string]$Compiler = 'gcc', [switch]$CompileOnly)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$build = Join-Path $root 'firmware-v2/tests/runtime-build'
New-Item -ItemType Directory -Path $build -Force | Out-Null
$exe = Join-Path $build 'runtime-regression.exe'
$cc = (Get-Command $Compiler -ErrorAction Stop).Source
$version = (& $cc --version 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw "Compiler version failed: $LASTEXITCODE" }
Write-Host $version
if ($version -match 'clang version') {
    Write-Warning 'This gcc command is a Clang compatibility wrapper, not GNU GCC. Results must be reported as Clang.'
}
$args = @('-std=c11','-Wall','-Wextra','-Werror','-pedantic','-O0','-g',
    '-I', (Join-Path $root 'firmware-v2/tests/runtime-mocks'),
    '-I', (Join-Path $root 'firmware-v2/interaction'),
    '-I', (Join-Path $root 'firmware-v2/render'))
$sources = @((Join-Path $root 'firmware-v2/tests/runtime-regression.c'))
foreach ($source in @('baji_controller.c','baji_gesture.c','baji_scene.c','baji_power.c','baji_link.c','baji_protocol.c')) {
    $sources += Join-Path $root "firmware-v2/interaction/$source"
}
if ($CompileOnly) {
    foreach ($source in $sources) {
        $obj = Join-Path $build (([IO.Path]::GetFileNameWithoutExtension($source)) + '-gcc.o')
        & $cc @args -c $source -o $obj
        if ($LASTEXITCODE -ne 0) { throw "Strict runtime object compilation failed: $source" }
    }
    Write-Host 'Strict compile-only PASS: runtime translation unit and six real core objects (not executed)'
    return
}
$args += $sources
$args += @('-o', $exe)
& $cc @args
if ($LASTEXITCODE -ne 0) { throw "Strict runtime compilation failed: $LASTEXITCODE" }
& $exe
if ($LASTEXITCODE -ne 0) { throw "Runtime regression failed: $LASTEXITCODE" }
