# Build APK Android - AgroRural Admin (Capacitor)
# Uso:
#   powershell -ExecutionPolicy Bypass -File mobile\build-android.ps1

param(
    [string]$VersionName = '1.0.0',
    [int]$VersionCode = 1,
    [switch]$Debug
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Mobile = Join-Path $Root 'mobile'
$Android = Join-Path $Mobile 'android'
$OutDir = Join-Path $Root 'public\downloads'
$InstallerOut = Join-Path $Root 'installer\output'

$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"

if (-not (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
    throw "JAVA_HOME invalido: $env:JAVA_HOME (instale o Android Studio)"
}
if (-not (Test-Path (Join-Path $env:ANDROID_HOME 'platforms'))) {
    throw "ANDROID_HOME invalido: $env:ANDROID_HOME"
}

Set-Location $Mobile
Write-Host "== AgroRural Admin Android ($VersionName / $VersionCode) ==" -ForegroundColor Cyan

if (-not (Test-Path (Join-Path $Mobile 'node_modules'))) {
    npm install --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { throw 'npm install falhou' }
}

if (-not (Test-Path $Android)) {
    npx cap add android
    if ($LASTEXITCODE -ne 0) { throw 'cap add android falhou' }
}

# local.properties
$sdkDirEscaped = ($env:ANDROID_HOME -replace '\\', '\\')
Set-Content -LiteralPath (Join-Path $Android 'local.properties') -Value "sdk.dir=$sdkDirEscaped" -Encoding ASCII

# Keystore de distribuicao (gerado uma vez)
$keystoreDir = Join-Path $Mobile 'keystore'
$keystore = Join-Path $keystoreDir 'agrorural-release.jks'
$propsFile = Join-Path $keystoreDir 'keystore.properties'
New-Item -ItemType Directory -Force -Path $keystoreDir | Out-Null

if (-not (Test-Path $keystore)) {
    Write-Host 'Gerando keystore de release...' -ForegroundColor Cyan
    $pass = -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
    & keytool -genkeypair -v `
        -keystore $keystore `
        -alias agrorural `
        -keyalg RSA `
        -keysize 2048 `
        -validity 10000 `
        -storepass $pass `
        -keypass $pass `
        -dname 'CN=AgroRural Admin, OU=Edem Software, O=AgroRural, L=Brasil, ST=SC, C=BR'
    if ($LASTEXITCODE -ne 0) { throw 'keytool falhou' }
    @"
storeFile=../keystore/agrorural-release.jks
storePassword=$pass
keyAlias=agrorural
keyPassword=$pass
"@ | Set-Content -LiteralPath $propsFile -Encoding ASCII
    Write-Host "Keystore criada em mobile/keystore (NAO versionar senhas)." -ForegroundColor Yellow
}

npx cap sync android
if ($LASTEXITCODE -ne 0) { throw 'cap sync falhou' }

# Atualiza versionCode/Name no build.gradle (sem BOM)
$appGradle = Join-Path $Android 'app\build.gradle'
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$gradleText = [System.IO.File]::ReadAllText($appGradle)
$gradleText = [regex]::Replace($gradleText, 'versionCode\s+\d+', "versionCode $VersionCode")
$gradleText = [regex]::Replace($gradleText, 'versionName\s+"[^"]+"', "versionName `"$VersionName`"")

if ($gradleText -notmatch 'signingConfigs') {
    $signingBlock = @"
    signingConfigs {
        release {
            def propsFile = rootProject.file('../keystore/keystore.properties')
            if (propsFile.exists()) {
                def props = new Properties()
                props.load(new FileInputStream(propsFile))
                storeFile rootProject.file(props['storeFile'])
                storePassword props['storePassword']
                keyAlias props['keyAlias']
                keyPassword props['keyPassword']
            }
        }
    }
"@
    $gradleText = $gradleText -replace '(buildTypes\s*\{)', "$signingBlock`r`n    `$1"
    $gradleText = $gradleText -replace '(release\s*\{)', "`$1`r`n            signingConfig signingConfigs.release"
}
# remove BOM se existir
$gradleText = $gradleText.TrimStart([char]0xFEFF)
[System.IO.File]::WriteAllText($appGradle, $gradleText, $utf8NoBom)

Set-Location $Android
$task = if ($Debug) { 'assembleDebug' } else { 'assembleRelease' }
Write-Host "Gradle $task ..." -ForegroundColor Cyan
.\gradlew.bat $task --no-daemon
if ($LASTEXITCODE -ne 0) { throw "gradle $task falhou" }

$apkSrc = if ($Debug) {
    Join-Path $Android 'app\build\outputs\apk\debug\app-debug.apk'
} else {
    Join-Path $Android 'app\build\outputs\apk\release\app-release.apk'
}
if (-not (Test-Path $apkSrc)) {
    # fallback nome com assinatura
    $apkSrc = Get-ChildItem (Join-Path $Android 'app\build\outputs\apk') -Recurse -Filter '*.apk' |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1 -ExpandProperty FullName
}
if (-not $apkSrc -or -not (Test-Path $apkSrc)) { throw 'APK nao encontrado' }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
New-Item -ItemType Directory -Force -Path $InstallerOut | Out-Null
$destPublic = Join-Path $OutDir 'AgroRural-Admin.apk'
$destInstaller = Join-Path $InstallerOut "AgroRural-Admin-$VersionName.apk"
Copy-Item $apkSrc $destPublic -Force
Copy-Item $apkSrc $destInstaller -Force

Write-Host ''
Write-Host "OK: $destPublic" -ForegroundColor Green
Write-Host ("Tamanho: {0:N1} MB" -f ((Get-Item $destPublic).Length / 1MB))
Write-Host "Copia: $destInstaller"
