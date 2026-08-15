# Garante pastas gravaveis do Laravel/emissor (evita mkdir(): Permission denied).
# Chamado por start-local.bat e bootstrap.

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot

$dirs = @(
    'storage\app',
    'storage\app\public',
    'storage\app\private',
    'storage\app\private\nfe',
    'storage\app\tmp',
    'storage\app\tmp\nfephp',
    'storage\framework',
    'storage\framework\cache',
    'storage\framework\cache\data',
    'storage\framework\sessions',
    'storage\framework\views',
    'storage\framework\testing',
    'storage\logs',
    'bootstrap\cache'
)

# Temp do usuario (fora do projeto) — preferido pelo NFePHP/SOAP
$mbTmp = Join-Path $env:LOCALAPPDATA 'Agro Rural Zortea\emissor\tmp'
$mbTmpNfe = Join-Path $mbTmp 'nfephp'
foreach ($extra in @($mbTmp, $mbTmpNfe)) {
    if (-not (Test-Path -LiteralPath $extra)) {
        New-Item -ItemType Directory -Force -Path $extra | Out-Null
    }
}

$userSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value

foreach ($rel in $dirs) {
    $path = Join-Path $root $rel
    try {
        if (-not (Test-Path -LiteralPath $path)) {
            New-Item -ItemType Directory -Force -Path $path | Out-Null
        }
        attrib -R -S -H "$path" /S /D 2>$null | Out-Null
        cmd /c "icacls `"$path`" /grant:r *${userSid}:(OI)(CI)F /T >nul 2>nul" | Out-Null
    } catch {
        Write-Host "[AVISO] storage: $_"
    }
}

# gitkeep para pastas vazias
foreach ($rel in @('storage\logs', 'storage\framework\cache\data', 'storage\framework\sessions', 'storage\framework\views', 'storage\app\private')) {
    $keep = Join-Path $root ($rel + '\.gitignore')
    if (-not (Test-Path -LiteralPath $keep)) {
        Set-Content -LiteralPath $keep -Value "*`r`n!.gitignore`r`n" -Encoding ASCII -ErrorAction SilentlyContinue
    }
}

Write-Host "storage OK em $root"
exit 0
