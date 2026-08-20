# Baixa PHP Windows (TS x64) para emissor_nfe/runtime/php com pdo_pgsql pronto.
# Chamado pelo build-windows.ps1. Nao versionar a pasta runtime/php no git.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\prepare-portable-php.ps1

param(
    [string]$PhpVersion = '8.4.24',
    [string]$DestDir = ''
)

$ErrorActionPreference = 'Stop'

function Remove-PathSafe([string]$Path) {
    if (-not $Path) { return }
    try {
        if (Test-Path -LiteralPath $Path) {
            cmd /c "if exist `"$Path`" rmdir /s /q `"$Path`" & if exist `"$Path`" del /f /q `"$Path`"" | Out-Null
        }
    } catch { }
}

function Test-PdoPgsql([string]$PhpExe) {
    $check = Join-Path (Split-Path -Parent $PhpExe) '_mb_pdo_check.php'
    Set-Content -LiteralPath $check '<?php echo implode(",", PDO::getAvailableDrivers()); exit(in_array("pgsql", PDO::getAvailableDrivers(), true) ? 0 : 1);' -Encoding ASCII
    try {
        $out = & $PhpExe $check 2>&1 | Out-String
        return @{ Ok = ($LASTEXITCODE -eq 0); Out = $out.Trim() }
    } finally {
        Remove-PathSafe $check
    }
}

if (-not $DestDir) {
    $DestDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'runtime\php'
}

$runtimeRoot = Split-Path -Parent $DestDir
$marker = Join-Path $DestDir '.mb-php-ready'
$phpExeExisting = Join-Path $DestDir 'php.exe'

if ((Test-Path -LiteralPath $phpExeExisting) -and (Test-Path -LiteralPath $marker)) {
    Write-Host "PHP portatil ja pronto: $DestDir"
    $check = Test-PdoPgsql $phpExeExisting
    if ($check.Ok) {
        Write-Host 'PDO pgsql: OK' -ForegroundColor Green
        exit 0
    }
    Write-Host 'PDO pgsql falhou — repreparando PHP portatil...' -ForegroundColor Yellow
}

$zipName = "php-$PhpVersion-Win32-vs17-x64.zip"
$url = "https://windows.php.net/downloads/releases/$zipName"
$altUrl = "https://windows.php.net/downloads/releases/archives/$zipName"

# Evita %TEMP% com acentuacao (PS 5.1 quebra Remove-Item em short path)
$tmpRoot = Join-Path $runtimeRoot ('_php_dl_' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tmpRoot | Out-Null
$zipPath = Join-Path $tmpRoot $zipName

try {
    Write-Host "Baixando $url ..."
    try {
        Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing
    } catch {
        Write-Host 'Release atual falhou, tentando archives...'
        Invoke-WebRequest -Uri $altUrl -OutFile $zipPath -UseBasicParsing
    }

    if (Test-Path -LiteralPath $DestDir) {
        Remove-PathSafe $DestDir
    }
    New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
    Write-Host "Extraindo para $DestDir ..."
    Expand-Archive -Path $zipPath -DestinationPath $DestDir -Force

    $phpExe = Join-Path $DestDir 'php.exe'
    if (-not (Test-Path -LiteralPath $phpExe)) { throw "php.exe ausente apos extrair $zipName" }

    $extDir = Join-Path $DestDir 'ext'
    foreach ($dll in @('php_pdo_pgsql.dll', 'php_pgsql.dll', 'php_openssl.dll', 'php_mbstring.dll', 'php_curl.dll')) {
        if (-not (Test-Path -LiteralPath (Join-Path $extDir $dll))) {
            throw "Falta $dll no pacote PHP"
        }
    }

    $bundledLibs = Join-Path $runtimeRoot 'pgsql-libs'
    foreach ($name in @('libpq.dll', 'libssl-3-x64.dll', 'libcrypto-3-x64.dll')) {
        $src = Join-Path $DestDir $name
        if (-not (Test-Path -LiteralPath $src) -and (Test-Path -LiteralPath (Join-Path $bundledLibs $name))) {
            Copy-Item -LiteralPath (Join-Path $bundledLibs $name) -Destination (Join-Path $DestDir $name) -Force
        }
        if (-not (Test-Path -LiteralPath (Join-Path $DestDir $name))) {
            Write-Host "AVISO: $name nao encontrado na pasta do PHP" -ForegroundColor Yellow
        }
    }

    $ini = @(
        '; Mecanica Bedendo - PHP portatil do emissor',
        'extension_dir = "ext"',
        'date.timezone = America/Sao_Paulo',
        'memory_limit = 512M',
        'upload_max_filesize = 10M',
        'post_max_size = 12M',
        'display_errors = On',
        'extension=openssl',
        'extension=curl',
        'extension=mbstring',
        'extension=fileinfo',
        'extension=zip',
        'extension=gd',
        'extension=soap',
        'extension=intl',
        'extension=pgsql',
        'extension=pdo_pgsql',
        'extension=sodium',
        'extension=ftp'
    ) -join "`r`n"
    Set-Content -LiteralPath (Join-Path $DestDir 'php.ini') -Value ($ini + "`r`n") -Encoding ASCII

    $check = Test-PdoPgsql $phpExe
    Write-Host ("PDO drivers: " + $check.Out)
    if (-not $check.Ok) {
        throw "PHP portatil nao carregou pdo_pgsql. Saida: $($check.Out)"
    }

    Set-Content -LiteralPath $marker -Value $PhpVersion -Encoding ASCII
    Write-Host "PHP portatil OK: $DestDir ($PhpVersion)" -ForegroundColor Green
} finally {
    Remove-PathSafe $tmpRoot
}

exit 0
