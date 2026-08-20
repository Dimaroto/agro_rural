# Gera token Sanctum e mostra os valores para colar no admin Agro Rural.
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\get-token.ps1 -Email "..." -Password "..."
# Ou defina SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD no ambiente / .env (nao versionar senha).

param(
    [string]$Email = $env:SEED_ADMIN_EMAIL,
    [string]$Password = $env:SEED_ADMIN_PASSWORD,
    [string]$BaseUrl = 'http://127.0.0.1:8001'
)

$ErrorActionPreference = 'Stop'

if (-not $Email -or -not $Password) {
    # Tenta ler do .env local (sem ecoar)
    $envPath = Join-Path $PSScriptRoot '..\.env'
    if (Test-Path $envPath) {
        Get-Content $envPath | ForEach-Object {
            if ($_ -match '^\s*SEED_ADMIN_EMAIL=(.*)$' -and -not $Email) {
                $Email = $Matches[1].Trim().Trim('"').Trim("'")
            }
            if ($_ -match '^\s*SEED_ADMIN_PASSWORD=(.*)$' -and -not $Password) {
                $Password = $Matches[1].Trim().Trim('"').Trim("'")
            }
        }
    }
}

if (-not $Email -or -not $Password) {
    Write-Host '[ERRO] Informe -Email e -Password (ou SEED_ADMIN_* no .env).' -ForegroundColor Red
    Write-Host 'Ex.: .\get-token.ps1 -Email "seu@email" -Password "sua-senha"'
    exit 1
}

try {
    $up = Invoke-WebRequest -Uri "$BaseUrl/up" -UseBasicParsing -TimeoutSec 5
    if ($up.StatusCode -ne 200) { throw "Emissor respondeu $($up.StatusCode)" }
} catch {
    Write-Host ''
    Write-Host '[ERRO] Emissor offline. Rode antes: scripts\start-local.bat' -ForegroundColor Red
    Write-Host ''
    exit 1
}

$login = Invoke-RestMethod -Uri "$BaseUrl/api/v1/auth/login" -Method Post -ContentType 'application/json' -Body (@{
    email = $Email
    password = $Password
    device_name = 'agro'
} | ConvertTo-Json)

$token = $login.token
$token | Set-Content (Join-Path $PSScriptRoot '..\.agro_token.txt') -NoNewline

Write-Host ''
Write-Host '=== Cole em Admin -> Engrenagem -> Fiscal / NF-e ===' -ForegroundColor Green
Write-Host "URL base:        $BaseUrl"
Write-Host "Token Bearer:    $token"
Write-Host "ID da empresa:   1"
Write-Host ''
$tokenPath = (Resolve-Path (Join-Path $PSScriptRoot '..\.agro_token.txt')).Path
Write-Host "Token salvo em: $tokenPath"
Write-Host ''
