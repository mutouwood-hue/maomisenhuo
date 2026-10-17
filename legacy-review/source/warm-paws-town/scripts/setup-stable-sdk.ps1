$ErrorActionPreference='Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\.toolchain')).Path
$file = Join-Path $root 'android-tools-19.zip'
if (!(Test-Path $file)) {
    & curl.exe --fail --location --retry 2 --output $file 'https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip'
    if ($LASTEXITCODE -ne 0) { throw 'Download failed' }
}
if ((Get-FileHash $file -Algorithm SHA1).Hash.ToLowerInvariant() -ne '54a582f3bf73e04253602f2d1c80bd5868aac115') { throw 'Checksum mismatch' }
$unpack = Join-Path $root 'android-tools-19'
if (!(Test-Path $unpack)) { Expand-Archive $file -DestinationPath $unpack }
$dest = Join-Path $root 'android-sdk\cmdline-tools\19.0'
if (!(Test-Path $dest)) { Copy-Item (Join-Path $unpack 'cmdline-tools') -Destination $dest -Recurse }
Write-Output 'Stable sdkmanager 19.0 is ready'
