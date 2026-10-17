$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$toolchain = Join-Path $project '.toolchain'
$env:JAVA_HOME = (Get-ChildItem (Join-Path $toolchain 'jdk') -Directory | Select-Object -First 1).FullName
$env:ANDROID_HOME = Join-Path $toolchain 'android-sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:GRADLE_USER_HOME = Join-Path $toolchain 'gradle-cache'
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
$sdkmanager = Join-Path $env:ANDROID_HOME 'cmdline-tools\19.0\bin\sdkmanager.bat'
$required = @('platform-tools\adb.exe', 'platforms\android-36\android.jar', 'build-tools\36.0.0\aapt.exe', 'build-tools\35.0.0\aapt.exe')
$missing = @($required | Where-Object { !(Test-Path (Join-Path $env:ANDROID_HOME $_)) })
if ($missing.Count -gt 0) {
    & $sdkmanager 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0' 'build-tools;35.0.0'
    if ($LASTEXITCODE -ne 0) { throw 'Android SDK package installation failed; review SDK license prompts in an interactive terminal' }
}
$sdkPath = $env:ANDROID_HOME.Replace('\','/').Replace(':','\:')
[IO.File]::WriteAllText((Join-Path $project 'android\local.properties'), "sdk.dir=$sdkPath`n", [Text.UTF8Encoding]::new($false))
Push-Location (Join-Path $project 'android')
try {
    & .\gradlew.bat --no-daemon assembleDebug lintDebug
    if ($LASTEXITCODE -ne 0) { throw 'Android build or lint failed' }
} finally { Pop-Location }
$out = Join-Path $project 'deliverables'
New-Item -ItemType Directory -Force $out | Out-Null
Copy-Item (Join-Path $project 'android\app\build\outputs\apk\debug\app-debug.apk') (Join-Path $out 'warm-paws-town-0.1.0-debug.apk')
Get-FileHash (Join-Path $out 'warm-paws-town-0.1.0-debug.apk') -Algorithm SHA256

