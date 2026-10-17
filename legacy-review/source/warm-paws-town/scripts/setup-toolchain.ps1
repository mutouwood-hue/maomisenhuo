$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '..\.toolchain'
New-Item -ItemType Directory -Force $root | Out-Null
$items = @(
    @{ Name='jdk.zip'; Url='https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jdk_x64_windows_hotspot_21.0.12.1_1.zip'; Hash='f9d6e191ab098c0d416e7d588a24420a8621cd2f4720dab2459b8b7b2d2d8b4e'; Algorithm='SHA256' },
    @{ Name='android-tools.zip'; Url='https://dl.google.com/android/repository/commandlinetools-win-16111833_latest.zip'; Hash='57d04f2d75eb8e8fffc5000a987e5de4b5a63e9d'; Algorithm='SHA1' }
)
foreach ($item in $items) {
    $file = Join-Path $root $item.Name
    if (!(Test-Path $file)) {
        Write-Output "Downloading $($item.Name)"
        Invoke-WebRequest -UseBasicParsing -Uri $item.Url -OutFile $file
    }
    if ((Get-FileHash $file -Algorithm $item.Algorithm).Hash.ToLowerInvariant() -ne $item.Hash) { throw "Checksum mismatch: $($item.Name)" }
    Write-Output "Verified $($item.Name)"
}
$jdk = Join-Path $root 'jdk'
if (!(Test-Path $jdk)) { Expand-Archive (Join-Path $root 'jdk.zip') -DestinationPath $jdk }
$sdk = Join-Path $root 'android-sdk'
$latest = Join-Path $sdk 'cmdline-tools\latest'
if (!(Test-Path $latest)) {
    $unpack = Join-Path $root 'android-unpack'
    Expand-Archive (Join-Path $root 'android-tools.zip') -DestinationPath $unpack
    New-Item -ItemType Directory -Force (Join-Path $sdk 'cmdline-tools') | Out-Null
    Copy-Item (Join-Path $unpack 'cmdline-tools') -Destination $latest -Recurse
}
$env:JAVA_HOME = (Get-ChildItem $jdk -Directory | Select-Object -First 1).FullName
$env:ANDROID_HOME = (Resolve-Path $sdk).Path
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
& "$env:JAVA_HOME\bin\java.exe" -version
Write-Output "Toolchain ready at $root"
