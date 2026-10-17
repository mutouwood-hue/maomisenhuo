# Build / flash / monitor the firmware with the locally installed ESP-IDF v5.5.5.
#
# Usage:
#   tools\build-firmware.ps1 build
#   tools\build-firmware.ps1 -p COM5 flash monitor
#   tools\build-firmware.ps1 size-components
#   tools\build-firmware.ps1 -BuildDir D:\some-other-build build
#
# The environment comes from the profile EIM generated for this IDF install rather
# than from a hand-assembled PATH: the profile knows where the python venv, the
# toolchain, cmake and ninja actually live, and it is the same activation the IDE
# integrations use.

[CmdletBinding(PositionalBinding = $false)]
param(
    # ASCII directory for the build tree. See the note near the bottom of this file:
    # it must NOT live under the project, because the project path is not ASCII.
    # Named-only on purpose -- see the note below.
    [string]$BuildDir = 'D:\orangecat-build',

    # ASCII mirror of the project, used only when the project itself sits on a
    # non-ASCII path. Disposable: recreated from the real source on every build, so
    # never edit it. See the staging note below.
    [string]$StageDir = 'D:\orangecat',

    # Explicit opt-in: M2 uses its own sdkconfig and OTA partition layout.
    # This only builds; legacy devices require a separately planned wired migration.
    [switch]$M2,

    # Serial port and baud rate, forwarded to idf.py as -p / -b.
    #
    # These exist as real parameters for a non-obvious reason. `CmdletBinding` adds
    # PowerShell's common parameters, and PowerShell resolves an abbreviated switch by
    # prefix. idf.py's `-p COM5` therefore matches the common parameter
    # `-PipelineVariable`, which swallows COM5 and leaves no trace: it does not appear
    # in $IdfArgs, in $MyInvocation.UnboundArguments, or anywhere else recoverable.
    # The command still "succeeds", just with the port missing, so `-p COM5 flash`
    # flashes to the wrong place with no diagnostic.
    #
    # Declaring `-p` ourselves wins, because an exact (alias) match beats a prefix
    # match. The same hazard applies to -b, -v, -o, -e, -i, -w and -d; of those only
    # -p and -b are idf.py flags people pass routinely, and the rest can be reached
    # through -IdfArgs.
    [Alias('p')]
    [string]$Port,

    [Alias('b')]
    [string]$Baud,

    [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
    [string[]]$IdfArgs = @('build')
)

# POSITIONAL BINDING NOTE.
# Everything after the script name belongs to idf.py, e.g. `build`, `flash monitor`.
# If $BuildDir were allowed a position it would silently swallow the first such
# argument: `build-firmware.ps1 build` would set BuildDir='build' (a *relative* path,
# which is also ASCII, so the guard below would not notice) and leave idf.py with no
# action at all. That is exactly what happened, and the visible result was a build in
# the project's own directory -- the one thing the parameter exists to prevent.
# `PositionalBinding = $false` plus an explicit Position on $IdfArgs is what makes the
# split unambiguous.

$ErrorActionPreference = 'Continue'

if ($M2) {
    if ($IdfArgs | Where-Object { $_ -in @('flash', 'erase-flash', 'efuse-burn', 'encrypted-flash') }) {
        Write-Error 'M2 partition migration requires a separate reviewed wired provisioning procedure; this build mode refuses flashing.'
        exit 1
    }
    if ($IdfArgs | Where-Object { $_ -match '^(-B|--build-dir|-DSDKCONFIG|-DBAJI_V2)' }) {
        Write-Error 'Use -BuildDir with -M2; do not override its isolated sdkconfig or BAJI_V2 settings through IdfArgs.'
        exit 1
    }
    if (-not $PSBoundParameters.ContainsKey('BuildDir')) { $BuildDir = 'D:\orangecat-m2-build' }
    if (-not $PSBoundParameters.ContainsKey('StageDir')) { $StageDir = 'D:\orangecat-m2' }
}

# The project lives under a path containing non-ASCII characters, and this machine's
# default locale encoding is GBK. ESP-IDF's python tooling writes several
# intermediate files (config.env, sdkconfig fragments) as UTF-8 but reads them back
# with the locale encoding, which fails with UnicodeDecodeError. Forcing Python into
# UTF-8 mode makes those round-trips consistent regardless of the console codepage.
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'
# Keep the compiler's diagnostics in a predictable encoding too.
$env:LC_ALL = 'C.UTF-8'

# ccache is disabled deliberately -- see the note at the end of this file.
# IDF_CCACHE_ENABLE is a click flag envvar, so *any* value (including "0") reads as
# "on"; it has to be removed from the environment rather than set to a false value,
# and the choice is then made explicitly with --no-ccache below.
Remove-Item Env:\IDF_CCACHE_ENABLE -ErrorAction SilentlyContinue

$profileScript = 'C:\Espressif\tools\Microsoft.v5.5.5.PowerShell_profile.ps1'
if (-not (Test-Path $profileScript)) {
    Write-Error "ESP-IDF activation profile not found at $profileScript"
    exit 1
}

# The profile prints a banner and registers tab completion; neither is useful in a
# build log, so quieten it down while it runs.
Write-Host '=== activating ESP-IDF v5.5.5 ===' -ForegroundColor Cyan
. $profileScript *> $null

if (-not (Get-Command idf.py -ErrorAction SilentlyContinue)) {
    Write-Error 'idf.py is still not available after activation'
    exit 1
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

# Refuse an ASCII-build-dir that is not actually ASCII or not absolute. This is the
# whole point of the parameter, and a silent fall back to the project directory would
# reintroduce the failure this exists to avoid.
if ($BuildDir -match '[^\x20-\x7E]') {
    Write-Error "BuildDir '$BuildDir' contains non-ASCII characters; it must be pure ASCII. See the note at the end of this script."
    exit 1
}
if (-not [System.IO.Path]::IsPathRooted($BuildDir)) {
    Write-Error "BuildDir '$BuildDir' is not an absolute path. A relative path would resolve inside the project, whose location is not ASCII -- which is precisely what this build tree must avoid."
    exit 1
}
# Is the build directory inside the project? Compare with a trailing separator so
# that a sibling whose name merely starts with the project name is not mistaken for
# a child: D:\orangecat-b is NOT inside D:\orangecat, but a naive
# `-like "$root*"` says it is.
$buildFull = [System.IO.Path]::GetFullPath($BuildDir).TrimEnd('\')
$rootFull = $root.TrimEnd('\')
if ($buildFull -eq $rootFull -or $buildFull.StartsWith("$rootFull\", [System.StringComparison]::OrdinalIgnoreCase)) {
    Write-Error "BuildDir '$BuildDir' is inside the project ($root), which is not an ASCII path. Choose a directory outside it."
    exit 1
}

$python = 'C:\Espressif\tools\python\v5.5.5\venv\Scripts\python.exe'
$idfPy = 'D:\Espressif\v5.5.5\esp-idf\tools\idf.py'

# ---------------------------------------------------------------------------------
# WHY THE PROJECT IS BUILT FROM AN ASCII PATH
#
# Two tools in the Xtensa toolchain cannot open a path that contains non-ASCII
# characters when the path is written with forward slashes -- the form CMake emits in
# every link and custom command. Both were reproduced in isolation on this host, with
# the identical path in backslash form succeeding:
#
#   1. ld, on the prebuilt library that espressif__esp_new_jpeg ships, which lives in
#      the *source* tree:
#
#        ld: cannot find D:/<CJK>/managed_components/espressif__esp_new_jpeg/lib/
#            esp32s3/libesp_new_jpeg.a: Invalid argument
#
#      That aborts the final link, at step 2156 of 2158 -- after every compile.
#
#   2. objdump, invoked by ldgen to list the sections of each component archive, which
#      lives in the *build* tree:
#
#        objdump: D:/<CJK>/build/esp-idf/xtensa/libxtensa.a: No such file or directory
#
#      That aborts the generation of sections.ld, at step 2109.
#
# ccache has a related but separate problem (it converts paths through the ANSI
# codepage) and is handled by --no-ccache. GCC itself is fine with the UTF-8 path, as
# are cmake, ninja and the Python tooling once PYTHONUTF8 is set -- which is why the
# failure appears so late and looks unrelated to the path.
#
# So both the SOURCE and the BUILD directory must be ASCII. When the project already
# lives on an ASCII path nothing is copied and it is built in place. Otherwise the
# source is staged into an ASCII mirror and the build runs there.
#
# The mirror is disposable: it is regenerated from the real source on every build, so
# there is nothing to keep in sync by hand. Edit the project where it lives; never edit
# the mirror.
# ---------------------------------------------------------------------------------

$sourceRoot = $root
$needsStaging = $root -match '[^\x20-\x7E]'

if ($needsStaging) {
    if ($StageDir -match '[^\x20-\x7E]') {
        Write-Error "StageDir '$StageDir' contains non-ASCII characters; it must be pure ASCII."
        exit 1
    }
    if (-not (Test-Path (Join-Path $root 'CMakeLists.txt'))) {
        Write-Error "Refusing to stage: $root has no CMakeLists.txt, so it does not look like the project."
        exit 1
    }
    if ($StageDir.TrimEnd('\') -eq $root.TrimEnd('\')) {
        Write-Error "StageDir must differ from the project directory."
        exit 1
    }

    Write-Host "=== staging the project into the ASCII mirror $StageDir ===" -ForegroundColor Cyan
    Write-Host "    ($root contains non-ASCII characters, which ld and objdump cannot read" -ForegroundColor DarkGray
    Write-Host "     when CMake writes them with forward slashes)" -ForegroundColor DarkGray

    # /MIR makes the mirror match the source exactly, including deletions, so a file
    # removed from the project cannot linger and be compiled.
    #
    # EXCLUDED: build output (the mirror has its own), version control, _ref -- a
    # reference/scratch area of several hundred megabytes that the firmware build never
    # reads -- and dist, which holds the built .bin files and is an *output* of a build
    # rather than an input to one. Non-source scratch such as logs is excluded too, so
    # the copy stays cheap.
    $rcArgs = @(
        $root, $StageDir,
        '/MIR', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:1', '/W:1',
        '/XD', 'build', '.git', '_ref', 'dist', 'node_modules', 'mobile-pet',
        '/XF', '_build-log.txt'
    )
    & robocopy @rcArgs | Out-Null
    # robocopy reports bit flags, not an exit status: 0-7 all mean success, 8 or more
    # means at least one file could not be copied.
    if ($LASTEXITCODE -ge 8) {
        Write-Error "robocopy failed staging into $StageDir (exit code $LASTEXITCODE)."
        exit 1
    }
    $sourceRoot = $StageDir
    Write-Host "=== mirror ready: $StageDir ===" -ForegroundColor DarkGray
}

if ($M2) {
    $m2Config = (Join-Path $sourceRoot 'sdkconfig.m2').Replace('\', '/')
    $IdfArgs = @('-DBAJI_V2=ON', "-DSDKCONFIG=$m2Config", '-DSDKCONFIG_DEFAULTS=sdkconfig.defaults;sdkconfig.m2.defaults') + $IdfArgs
}

# Do not add a second -B if the caller already supplied one.
$hasBuildArg = $IdfArgs | Where-Object { $_ -eq '-B' -or $_ -like '-B*' -or $_ -eq '--build-dir' -or $_ -like '--build-dir=*' }

if (-not $hasBuildArg) {
    if (-not (Test-Path $BuildDir)) { New-Item -ItemType Directory -Path $BuildDir | Out-Null }
    Write-Host "=== build tree: $BuildDir (ASCII) ===" -ForegroundColor DarkGray
    $all = @('-B', $BuildDir) + $IdfArgs
} else {
    $all = $IdfArgs
}

# --no-ccache ONLY when the compiler will actually be handed a non-ASCII path.
#
# ccache cannot convert a UTF-8 path through the Windows ANSI codepage (see the note at
# the end of this file), so it must be off for a non-ASCII project. But it must be off
# *consistently* or not at all: passing it sometimes and not others changes the compile
# command line (the `ccache` prefix appears or disappears), which makes ninja rebuild
# every object. Alternating `build` and `size` therefore cost a full rebuild each time,
# which is about fifteen minutes here.
#
# After staging, $sourceRoot is ASCII, so ccache is safe and stays ON -- which is also
# the faster option. The flag is needed only for a build in place on a non-ASCII path,
# where staging was skipped.
$noCcache = @()
if ($sourceRoot -match '[^\x20-\x7E]') { $noCcache = @('--no-ccache') }

$forwarded = @()
if ($Port) { $forwarded += @('-p', $Port) }
if ($Baud) { $forwarded += @('-b', $Baud) }

$all = @($noCcache + $forwarded + $all)

if ($noCcache.Count -gt 0) {
    Write-Host "=== ccache disabled: the source path is not ASCII ===" -ForegroundColor DarkGray
}

Write-Host "=== idf.py $($all -join ' ')  (source $sourceRoot) ===" -ForegroundColor Cyan

# Record where things are, so other tools can find the generated files. The project is
# built from a staged mirror on this machine, so `sdkconfig` and `build/config/
# sdkconfig.h` are NOT next to this script, and a tool that assumes they are will
# check nothing and report success. tools/check-sdkconfig.mjs reads this file; it
# treats a missing file as a failure once a build has been recorded.
#
# Written before the build runs, so it always describes the most recent attempt even
# if that attempt fails.
$record = [ordered]@{
    sourceRoot = $root
    projectDir = $sourceRoot
    stageDir   = $StageDir
    buildDir   = $BuildDir
    staged     = [bool]$needsStaging
    isM2       = [bool]$M2
    sdkconfig  = $(if ($M2) { Join-Path $sourceRoot 'sdkconfig.m2' } else { Join-Path $sourceRoot 'sdkconfig' })
    utc        = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
}
$recordPath = Join-Path $PSScriptRoot '.last-build.json'
# Write UTF-8 without a BOM: PowerShell 5.1's `-Encoding UTF8` adds one, and JSON
# parsers reject the leading U+FEFF. New-Object on UTF8Encoding($false) is the
# reliable way to say "no BOM" in both PowerShell 5.1 and 7.
[System.IO.File]::WriteAllText($recordPath, ($record | ConvertTo-Json),
    (New-Object System.Text.UTF8Encoding($false)))

# Quote every argument and hand the whole line to cmd.exe. Powershell's own call
# operator mangles arguments that contain quotes, which idf.py's -D options do.
#
# `chcp 65001` switches the console to UTF-8 so idf.py's human-facing reports (the
# `idf.py size` table, the component lists) come out readable. In the default GBK
# console those tables render as mojibake, which looks like a broken tool rather than a
# codepage mismatch. Compiler diagnostics are unaffected, and PYTHONUTF8 already
# governs how the Python tooling reads and writes files.
$quoted = ($all | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' }) -join ' '
$line = 'chcp 65001 >nul && cd /d "{0}" && "{1}" "{2}" {3}' -f $sourceRoot, $python, $idfPy, $quoted
& cmd.exe /c $line
exit $LASTEXITCODE

# --------------------------------------------------------------------------------
# Why ccache is off for a non-ASCII source path
#
# ESP-IDF enables ccache when the environment asks for it, and every compile line then
# becomes `ccache <gcc> ...`. ccache is a C++ program using std::filesystem, and on
# Windows that library converts narrow paths using the ANSI codepage -- GBK on this
# machine. A project path that is UTF-8 (D:\<CJK>) cannot be represented, so ccache
# aborts:
#
#   terminate called after throwing an instance of
#   'std::filesystem::__cxx11::filesystem_error'
#     what():  filesystem error: Cannot convert character sequence: Illegal byte sequence
#
# Ninja then reports only "build stopped: subcommand failed", with no mention of the
# file that was being compiled, which makes the cause hard to see.
#
# In practice this no longer fires on this machine: the project is staged into an ASCII
# mirror first, so the compiler only ever sees ASCII paths and ccache stays enabled.
# The flag remains as the guard for a build in place on a non-ASCII path.
#
# IDF_CCACHE_ENABLE is a click flag envvar, so *any* value -- including "0" -- counts as
# ON; the variable has to be removed (done above) or idf.py told --no-ccache.
# --------------------------------------------------------------------------------
# Why there is no ASCII junction
#
# An earlier version of this script built through an ASCII directory junction
# (D:\orangecat -> D:\<CJK>) on the theory that CMake would then see an ASCII path.
# It does not work, and the reason is worth writing down so nobody tries it again:
# idf.py normalises its project directory with os.path.realpath(), and since Python
# 3.8 that calls GetFinalPathNameByHandle on Windows and resolves the junction back to
# its target. cmd.exe's `cd /d D:\orangecat` does change the process working
# directory, but Python immediately reports D:\<CJK> anyway, so CMake is configured
# with CMAKE_HOME_DIRECTORY=D:/<CJK> and nothing is gained. `subst` fails for exactly
# the same reason. Only a directory that genuinely *is* ASCII works, which is why the
# staging mirror is a real copy rather than a link. The junction has been removed.
# --------------------------------------------------------------------------------
