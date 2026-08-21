# Build do instalador Windows - Agro Rural (emissor NF-e)
# Uso:
#   powershell -ExecutionPolicy Bypass -File installer\build-windows.ps1
# Pendrive (embute .env Neon criptografado):
#   1) copy emissor_nfe\.env installer\private\.env
#   2) powershell -ExecutionPolicy Bypass -File installer\build-windows.ps1 -IncludeSecrets

param(
    [string]$Version = '1.1.6',
    [switch]$SkipComposer,
    [switch]$IncludeSecrets,
    [switch]$SkipCompile,
    [switch]$SkipDesktop
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $Root

$InstallerDir = Join-Path $Root 'installer'
$Stage = Join-Path $InstallerDir 'stage'
$StageApp = Join-Path $Stage 'app'
$StageEmissor = Join-Path $Stage 'emissor_nfe'
$OutputDir = Join-Path $InstallerDir 'output'
$Iss = Join-Path $InstallerDir 'agro_rural.iss'
$PrivateDir = Join-Path $InstallerDir 'private'
$EmissorSrc = Join-Path $Root 'emissor_nfe'

Write-Host "== Agro Rural Setup build ($Version) ==" -ForegroundColor Cyan
Write-Host "Root: $Root"
if ($IncludeSecrets) {
    Write-Host 'IncludeSecrets: ON - o Setup CONTERA senha Neon / APP_KEY. So para pendrive privado.' -ForegroundColor Yellow
}

function Find-ISCC {
    $candidates = @(
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
        "${env:ProgramFiles}\Inno Setup 6\ISCC.exe",
        "${env:LOCALAPPDATA}\Programs\Inno Setup 6\ISCC.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    $cmd = Get-Command ISCC -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

# Patch version in ISS
$issText = Get-Content -LiteralPath $Iss -Raw
$issText = [regex]::Replace($issText, '#define MyAppVersion "[^"]+"', "#define MyAppVersion `"$Version`"")
Set-Content -LiteralPath $Iss -Value $issText -Encoding UTF8

$iscc = Find-ISCC
if (-not $iscc -and -not $SkipCompile) {
    Write-Host 'Inno Setup 6 nao encontrado. Instalando via winget...' -ForegroundColor Yellow
    winget install --id JRSoftware.InnoSetup -e --accept-package-agreements --accept-source-agreements
    $iscc = Find-ISCC
}
if (-not $iscc -and -not $SkipCompile) {
    throw 'ISCC.exe nao encontrado. Instale Inno Setup 6 ou use -SkipCompile.'
}
if ($iscc) { Write-Host "ISCC: $iscc" }

# Logo Edem (ICO)
$logoIco = Join-Path $InstallerDir 'assets\logo.ico'
$desktopDir = Join-Path $Root 'desktop'
$desktopIco = Join-Path $desktopDir 'assets\logo.ico'
if ((Test-Path $logoIco) -and -not (Test-Path $desktopIco)) {
    New-Item -ItemType Directory -Force -Path (Join-Path $desktopDir 'assets') | Out-Null
    Copy-Item $logoIco $desktopIco -Force
}

# App Windows (Electron)
if (-not $SkipDesktop) {
    Write-Host 'Empacotando app Windows (Electron) ...' -ForegroundColor Cyan
    if (-not (Test-Path (Join-Path $desktopDir 'package.json'))) {
        throw 'Pasta desktop/ ausente.'
    }
    Push-Location $desktopDir
    try {
        $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
        if (-not (Test-Path (Join-Path $desktopDir 'node_modules'))) {
            npm install --no-fund --no-audit
            if ($LASTEXITCODE -ne 0) { throw "npm install (desktop) falhou ($LASTEXITCODE)" }
        }
        npm run pack
        if ($LASTEXITCODE -ne 0) { throw "electron-builder falhou ($LASTEXITCODE)" }
    } finally {
        Pop-Location
    }
}

$unpacked = Join-Path $desktopDir 'dist\win-unpacked'
$appExe = Join-Path $unpacked 'AgroRural.exe'
if (-not (Test-Path $appExe)) {
    throw "AgroRural.exe nao encontrado em $unpacked. Rode sem -SkipDesktop."
}

# PHP portatil
$preparePhp = Join-Path $EmissorSrc 'scripts\prepare-portable-php.ps1'
if (Test-Path $preparePhp) {
    Write-Host 'Preparando PHP portatil (runtime/php) ...' -ForegroundColor Cyan
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $preparePhp
    if ($LASTEXITCODE -ne 0) { throw "prepare-portable-php falhou ($LASTEXITCODE)" }
    if (-not (Test-Path (Join-Path $EmissorSrc 'runtime\php\php.exe'))) {
        throw 'runtime/php/php.exe ausente apos prepare-portable-php.'
    }
}

# Composer
if (-not $SkipComposer) {
    Write-Host 'composer install (emissor_nfe) ...' -ForegroundColor Cyan
    $portablePhpExe = Join-Path $EmissorSrc 'runtime\php\php.exe'
    if (-not (Test-Path -LiteralPath $portablePhpExe)) {
        throw 'runtime/php/php.exe necessario para composer install'
    }
    Push-Location $EmissorSrc
    $prevPath = $env:Path
    try {
        $env:Path = "$(Join-Path $EmissorSrc 'runtime\php');$prevPath"
        Remove-Item Env:\PHPRC -ErrorAction SilentlyContinue
        $phar = Join-Path $EmissorSrc 'composer.phar'
        if (-not (Test-Path -LiteralPath $phar)) {
            Write-Host 'Baixando composer.phar ...' -ForegroundColor Cyan
            Invoke-WebRequest -Uri 'https://getcomposer.org/download/latest-stable/composer.phar' -OutFile $phar -UseBasicParsing
        }
        & $portablePhpExe $phar @('install', '--no-dev', '--optimize-autoloader', '--no-interaction')
        if ($LASTEXITCODE -ne 0) { throw "composer install falhou ($LASTEXITCODE)" }
    } finally {
        $env:Path = $prevPath
        Pop-Location
    }
}

# Stage
Write-Host 'Montando installer/stage ...' -ForegroundColor Cyan
if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $StageApp | Out-Null
New-Item -ItemType Directory -Force -Path $StageEmissor | Out-Null
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

Write-Host 'Copiando app Windows para o stage ...' -ForegroundColor Cyan
robocopy $unpacked $StageApp /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy app falhou ($LASTEXITCODE)" }
$global:LASTEXITCODE = 0
if (-not (Test-Path (Join-Path $StageApp 'AgroRural.exe'))) {
    throw 'stage/app/AgroRural.exe ausente.'
}

$excludeDirs = @(
    'node_modules', '.git', 'storage\logs', 'storage\framework\cache',
    'storage\framework\sessions', 'storage\framework\views', 'storage\app\private'
)
robocopy $EmissorSrc $StageEmissor /E /XD $excludeDirs /XF .env .env.backup .agro_token.txt .neon-url '*.sqlite' '*.sqlite-journal' '*.pfx' /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy emissor falhou ($LASTEXITCODE)" }
$global:LASTEXITCODE = 0

$storageDirs = @(
    'storage\app\private',
    'storage\app\public',
    'storage\framework\cache\data',
    'storage\framework\sessions',
    'storage\framework\views',
    'storage\logs',
    'bootstrap\cache'
)
foreach ($rel in $storageDirs) {
    $p = Join-Path $StageEmissor $rel
    New-Item -ItemType Directory -Force -Path $p | Out-Null
    Set-Content -LiteralPath (Join-Path $p '.gitignore') -Value "*`r`n!.gitignore`r`n" -Encoding ASCII
}

Copy-Item (Join-Path $InstallerDir 'README-INSTALACAO.txt') (Join-Path $Stage 'README-INSTALACAO.txt') -Force
Copy-Item (Join-Path $InstallerDir 'README-INSTALACAO.txt') (Join-Path $StageEmissor 'README-INSTALACAO.txt') -Force -ErrorAction SilentlyContinue

# PHP portatil no stage
$portablePhp = Join-Path $EmissorSrc 'runtime\php'
$portablePhpStage = Join-Path $StageEmissor 'runtime\php'
if (-not (Test-Path (Join-Path $portablePhp 'php.exe'))) {
    throw 'runtime/php ausente. Rode emissor_nfe\scripts\prepare-portable-php.ps1'
}
New-Item -ItemType Directory -Force -Path (Join-Path $StageEmissor 'runtime') | Out-Null
if (Test-Path $portablePhpStage) { Remove-Item $portablePhpStage -Recurse -Force }
Write-Host 'Copiando runtime/php para o stage ...' -ForegroundColor Cyan
robocopy $portablePhp $portablePhpStage /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy runtime/php falhou ($LASTEXITCODE)" }
$global:LASTEXITCODE = 0

$pgsqlLibsSrc = Join-Path $EmissorSrc 'runtime\pgsql-libs'
$pgsqlLibsDst = Join-Path $StageEmissor 'runtime\pgsql-libs'
New-Item -ItemType Directory -Force -Path $pgsqlLibsDst | Out-Null
if (Test-Path $pgsqlLibsSrc) {
    Copy-Item (Join-Path $pgsqlLibsSrc '*') $pgsqlLibsDst -Force
}

# Segredos
$secretsEmbedded = $false
$desbloqueioOut = Join-Path $OutputDir 'DESBLOQUEIO.txt'
if ($IncludeSecrets) {
    . (Join-Path $EmissorSrc 'scripts\secrets-crypto.ps1')

    $privateEnv = Join-Path $PrivateDir '.env'
    if (-not (Test-Path $privateEnv)) {
        throw @"
-IncludeSecrets exige installer\private\.env
  New-Item -ItemType Directory -Force -Path installer\private | Out-Null
  Copy-Item emissor_nfe\.env installer\private\.env
"@
    }

    $passFile = Join-Path $PrivateDir '.passphrase'
    if (-not (Test-Path $passFile)) {
        $generated = New-InstallerPassphrase
        Set-Content -LiteralPath $passFile -Value $generated -Encoding ASCII -NoNewline
        Write-Host "Passphrase gerada em installer\private\.passphrase" -ForegroundColor Yellow
    }
    $passphrase = (Get-Content -LiteralPath $passFile -Raw).Trim()
    if ([string]::IsNullOrWhiteSpace($passphrase)) {
        throw 'installer\private\.passphrase esta vazio.'
    }

    $privateToken = Join-Path $PrivateDir '.agro_token.txt'
    $tokenArg = ''
    if (Test-Path $privateToken) { $tokenArg = $privateToken }

    $plainZip = New-SecretsPayloadZipBytes -EnvPath $privateEnv -TokenPath $tokenArg
    $protected = Protect-InstallerSecrets -PlainBytes $plainZip -Passphrase $passphrase
    $encPath = Join-Path $StageEmissor 'installer-secrets.enc'
    [IO.File]::WriteAllBytes($encPath, $protected)

    @"
Agro Rural - chave de desbloqueio do .env (Neon)
================================================
Guarde este arquivo JUNTO com o Setup no pendrive.
Sem ele, a instalacao nao consegue configurar o banco.

PASSPHRASE=$passphrase

Apos instalar com sucesso, pode apagar este arquivo do PC destino.
"@ | Set-Content -LiteralPath $desbloqueioOut -Encoding ASCII

    Copy-Item -Force $desbloqueioOut (Join-Path $StageEmissor 'DESBLOQUEIO.txt')
    $secretsEmbedded = $true
    Write-Host 'Segredos criptografados em installer-secrets.enc.' -ForegroundColor Green
} else {
    Write-Host 'Setup sem segredos (padrao). Use -IncludeSecrets para pendrive.'
    if (Test-Path $desbloqueioOut) { Remove-Item $desbloqueioOut -Force -ErrorAction SilentlyContinue }
}

if ($SkipCompile) {
    Write-Host "Stage pronto em $Stage (SkipCompile)." -ForegroundColor Green
    return
}

$issDefines = @()
if ($secretsEmbedded) { $issDefines += '/DIncludeSecrets=1' }

Write-Host 'Compilando Inno Setup ...' -ForegroundColor Cyan
& $iscc @issDefines $Iss
if ($LASTEXITCODE -ne 0) { throw "ISCC falhou ($LASTEXITCODE)" }

$setup = Get-ChildItem $OutputDir -Filter 'AgroRural-Setup-*.exe' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $setup) { throw 'Setup .exe nao gerado.' }

Write-Host ''
Write-Host "OK: $($setup.FullName)" -ForegroundColor Green
Write-Host ("Tamanho: {0:N1} MB" -f ($setup.Length / 1MB))
if ($secretsEmbedded) {
    Write-Host 'Inclua DESBLOQUEIO.txt no pendrive (fora do .exe).' -ForegroundColor Yellow
}
