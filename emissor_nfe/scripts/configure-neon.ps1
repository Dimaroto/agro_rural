# Gera/atualiza .env para Neon e valida a conexao.
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\configure-neon.ps1 -DatabaseUrl 'postgresql://USER:PASS@HOST/neondb?sslmode=require'
# Ou grave a URI em emissor_nfe\.neon-url (uma linha) e rode sem parametro.
# Ou: $env:NEON_DATABASE_URL = 'postgresql://...'

param(
    [string]$DatabaseUrl = $env:NEON_DATABASE_URL
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$neonFile = Join-Path $root '.neon-url'
if (-not $DatabaseUrl -and (Test-Path $neonFile)) {
    $DatabaseUrl = (Get-Content $neonFile -Raw).Trim()
}

if (-not $DatabaseUrl -or $DatabaseUrl -notmatch '^postgres') {
    Write-Host ''
    Write-Host '[ERRO] Informe a connection string do Neon.' -ForegroundColor Red
    Write-Host '  1) Crie o projeto em https://console.neon.tech'
    Write-Host '  2) Copie Connection string (com sslmode=require)'
    Write-Host '  3) Rode:'
    Write-Host "     powershell -ExecutionPolicy Bypass -File scripts\configure-neon.ps1 -DatabaseUrl 'postgresql://...'"
    Write-Host '  Ou salve a URI em emissor_nfe\.neon-url e rode este script de novo.'
    Write-Host ''
    exit 1
}

# PDO/PHP costuma falhar com channel_binding=require
$DatabaseUrl = $DatabaseUrl -replace '&channel_binding=require', '' -replace '\?channel_binding=require&', '?' -replace '\?channel_binding=require$', ''
# Migrations/DDL: use endpoint direto (sem -pooler); pooler quebra unique constraints em transacao
$DatabaseUrl = $DatabaseUrl -replace '-pooler\.', '.'
if ($DatabaseUrl -notmatch 'sslmode=') {
    $DatabaseUrl += $(if ($DatabaseUrl -match '\?') { '&' } else { '?' }) + 'sslmode=require'
}

if (-not (Test-Path '.env')) {
    Copy-Item '.env.example' '.env'
    Write-Host 'Criado .env a partir de .env.example'
}

$lines = Get-Content '.env' -Encoding UTF8
$keys = @{
    'DB_CONNECTION' = 'pgsql'
    'DB_URL'        = $DatabaseUrl
    'DB_SSLMODE'    = 'require'
    'DB_HOST'       = ''
    'DB_PORT'       = '5432'
    'DB_DATABASE'   = ''
    'DB_USERNAME'   = ''
    'DB_PASSWORD'   = ''
}

$seen = @{}
$out = foreach ($line in $lines) {
    $matched = $false
    foreach ($k in $keys.Keys) {
        if ($line -match "^$k=") {
            $v = $keys[$k]
            if ($k -eq 'DB_URL') {
                $v = $v -replace '"', ''
                "DB_URL=`"$v`""
            } else {
                "$k=$v"
            }
            $seen[$k] = $true
            $matched = $true
            break
        }
    }
    if (-not $matched) { $line }
}
foreach ($k in $keys.Keys) {
    if (-not $seen[$k]) {
        $v = $keys[$k]
        if ($k -eq 'DB_URL') {
            $out += "DB_URL=`"$($v -replace '"','')`""
        } else {
            $out += "$k=$v"
        }
    }
}

$out | Set-Content '.env' -Encoding UTF8
Write-Host 'DB_CONNECTION=pgsql e DB_URL gravados no .env' -ForegroundColor Green

$hasKey = ($out | Where-Object { $_ -match '^APP_KEY=base64:' }).Count -gt 0
if (-not $hasKey) {
    & php artisan key:generate --force | Out-Host
}

& "$PSScriptRoot\test-db.ps1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host 'Proximos passos:' -ForegroundColor Cyan
Write-Host '  php artisan migrate'
Write-Host '  php scripts\copy-sqlite-to-pgsql.php'
Write-Host '  scripts\start-local.bat'
Write-Host ''
