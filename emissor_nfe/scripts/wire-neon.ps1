# Configura Neon no .env, migrate e copia SQLite -> Postgres (PC1).
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\wire-neon.ps1 -DatabaseUrl 'postgresql://...?sslmode=require'
# Ou grave a URI em .neon-url e rode sem parametro.

param(
    [string]$DatabaseUrl = $env:NEON_DATABASE_URL,
    [switch]$SkipCopy,
    [switch]$SeedIfEmpty
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

& "$PSScriptRoot\configure-neon.ps1" -DatabaseUrl $DatabaseUrl
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Rodando migrate...' -ForegroundColor Cyan
php artisan migrate --force
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$sqlite = Join-Path $root 'database\database.sqlite'
if (-not $SkipCopy -and (Test-Path $sqlite)) {
    Write-Host 'Copiando SQLite -> Postgres...' -ForegroundColor Cyan
    php scripts\copy-sqlite-to-pgsql.php
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} elseif ($SeedIfEmpty) {
    Write-Host 'Sem SQLite — rodando db:seed...' -ForegroundColor Cyan
    php artisan db:seed --force
}

Write-Host ''
Write-Host 'Pronto. Suba com scripts\start-local.bat' -ForegroundColor Green
Write-Host 'No 2o PC: copie o .env (mesmo APP_KEY + DB_URL), composer install, start-local.bat'
Write-Host ''
