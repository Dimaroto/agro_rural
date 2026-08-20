# Garante EMISSOR_APP_SLUG e APP_URL do Agro Rural no .env
param(
    [Parameter(Mandatory = $true)][string]$EnvPath,
    [string]$Port = '8001'
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $EnvPath)) {
    throw ".env ausente: $EnvPath"
}

$raw = Get-Content -LiteralPath $EnvPath -Raw
if ($null -eq $raw) { $raw = '' }

if ($raw -match '(?m)^EMISSOR_APP_SLUG=') {
    $raw = [regex]::Replace($raw, '(?m)^EMISSOR_APP_SLUG=.*$', 'EMISSOR_APP_SLUG=agro-rural')
} else {
    if ($raw -notmatch '\r?\n$') { $raw += "`r`n" }
    $raw += "EMISSOR_APP_SLUG=agro-rural`r`n"
}

$appUrl = "APP_URL=http://127.0.0.1:$Port"
if ($raw -match '(?m)^APP_URL=') {
    $raw = [regex]::Replace($raw, '(?m)^APP_URL=.*$', $appUrl)
} else {
    if ($raw -notmatch '\r?\n$') { $raw += "`r`n" }
    $raw += "$appUrl`r`n"
}

Set-Content -LiteralPath $EnvPath -Value $raw -Encoding UTF8 -NoNewline
Write-Output "OK EMISSOR_APP_SLUG=agro-rural $appUrl"
