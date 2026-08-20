# Garante PHP para o emissor apos instalacao.
# Preferencia: PHP portatil em runtime/php (embutido no Setup).
# ASCII-only: PS 5.1 quebra com UTF-8 sem BOM.

$ErrorActionPreference = 'Continue'
$emissorRoot = Split-Path -Parent $PSScriptRoot
$portable = Join-Path $emissorRoot 'runtime\php\php.exe'

function Write-EnsureLog([string]$Message) {
    Write-Host $Message
    try {
        $logDir = Join-Path $env:LOCALAPPDATA 'Edem Software\Mecanica Bedendo\logs'
        if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
        Add-Content -LiteralPath (Join-Path $logDir 'bootstrap.log') -Value ("[{0}] ensure-php: {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message)
    } catch {}
}

Write-EnsureLog "emissorRoot=$emissorRoot"
Write-EnsureLog "portable candidate=$portable"

if (Test-Path -LiteralPath $portable) {
    Write-EnsureLog 'PHP portatil encontrado - nao usa WinGet.'
    $phpDir = Split-Path -Parent $portable
    $env:Path = "$phpDir;$env:Path"
    Remove-Item Env:\PHPRC -ErrorAction SilentlyContinue

    $verOut = & $portable -v 2>&1 | Out-String
    Write-EnsureLog ("php -v: " + $verOut.Trim())
    if ($LASTEXITCODE -ne 0 -and [string]::IsNullOrWhiteSpace($verOut)) {
        Write-EnsureLog '[AVISO] php.exe nao iniciou. Instale "Microsoft Visual C++ Redistributable 2015-2022 x64".'
        # Ainda assim nao tenta WinGet: o binario portatil esta la; start-local usa ele.
        exit 0
    }

    $check = Join-Path $phpDir '_mb_pdo_check.php'
    Set-Content -LiteralPath $check '<?php exit(in_array("pgsql", PDO::getAvailableDrivers(), true) ? 0 : 1);' -Encoding ASCII
    & $portable $check
    $code = $LASTEXITCODE
    cmd /c "del /f /q `"$check`"" 2>$null | Out-Null
    if ($code -eq 0) {
        Write-EnsureLog 'PDO pgsql OK no PHP portatil.'
        exit 0
    }
    Write-EnsureLog '[AVISO] PHP portatil sem pgsql agora; start-local ainda usara este PHP.'
    exit 0
}

Write-EnsureLog 'PHP portatil AUSENTE - tentando configure-php / WinGet...'
$configure = Join-Path $PSScriptRoot 'configure-php.ps1'
if (-not (Test-Path -LiteralPath $configure)) {
    Write-EnsureLog '[ERRO] configure-php.ps1 nao encontrado e sem PHP portatil.'
    exit 1
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $configure -InstallIfMissing
exit $LASTEXITCODE
