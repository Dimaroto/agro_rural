# Verifica pdo_pgsql e conexao Laravel com o banco configurado no .env
# Uso: powershell -ExecutionPolicy Bypass -File scripts\test-db.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Find-Php {
    $winget = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
    $candidates = @()
    if (Test-Path $winget) {
        $candidates += Get-ChildItem $winget -Directory -Filter 'PHP.PHP.8.4_*' -ErrorAction SilentlyContinue |
            ForEach-Object { Join-Path $_.FullName 'php.exe' }
    }
    $cmd = Get-Command php -ErrorAction SilentlyContinue
    if ($cmd) { $candidates = @($cmd.Source) + $candidates }
    foreach ($p in $candidates) {
        if ($p -and (Test-Path $p)) { return $p }
    }
    return $null
}

$php = Find-Php
if (-not $php) {
    Write-Host '[ERRO] PHP nao encontrado.' -ForegroundColor Red
    exit 1
}

Write-Host "PHP: $php"

$mods = & $php -m 2>&1 | ForEach-Object { "$_".Trim() }
if ($mods -notcontains 'pdo_pgsql') {
    Write-Host ''
    Write-Host '[ERRO] Extensao pdo_pgsql nao carregada.' -ForegroundColor Red
    Write-Host '1) php --ini'
    Write-Host '2) Em php.ini descomente: extension=pdo_pgsql e extension=pgsql'
    Write-Host '3) Feche e abra o terminal; rode este script de novo.'
    Write-Host ''
    exit 1
}
Write-Host 'pdo_pgsql: OK' -ForegroundColor Green

if (-not (Test-Path '.env')) {
    Write-Host '[ERRO] Arquivo .env nao existe. Copie .env.example e configure o Neon.' -ForegroundColor Red
    exit 1
}

$dbLine = (Get-Content '.env' | Where-Object { $_ -match '^DB_CONNECTION=' } | Select-Object -First 1)
Write-Host $dbLine

Write-Host 'artisan db:show ...'
& $php artisan db:show
if ($LASTEXITCODE -ne 0) {
    Write-Host '[ERRO] Falha ao conectar. Confira DB_URL / SSL no .env (Neon exige sslmode=require).' -ForegroundColor Red
    exit 1
}

Write-Host 'migrate:status ...'
& $php artisan migrate:status 2>&1 | Tee-Object -Variable migOut | Out-Host
$migText = ($migOut | Out-String)
if ($LASTEXITCODE -ne 0 -and $migText -notmatch 'Migration table not found') {
    Write-Host '[ERRO] migrate:status falhou.' -ForegroundColor Red
    exit 1
}
if ($migText -match 'Migration table not found') {
    Write-Host '(banco vazio — rode php artisan migrate)' -ForegroundColor Yellow
}
Write-Host ''
Write-Host 'Banco OK.' -ForegroundColor Green
