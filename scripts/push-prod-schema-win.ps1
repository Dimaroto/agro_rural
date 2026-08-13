# Aplica prisma db push no Neon de producao.
# Uso (modo recomendado):
#   $env:DATABASE_URL = 'postgresql://...-pooler.../catalogo?sslmode=require'
#   $env:DATABASE_URL_UNPOOLED = 'postgresql://...direct.../catalogo?sslmode=require'
#   powershell -ExecutionPolicy Bypass -File .\scripts\push-prod-schema-win.ps1 -Manual

param(
  [switch]$Manual
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$npx = Join-Path $env:ProgramFiles "nodejs\npx.cmd"
if (-not (Test-Path $npx)) {
  $npx = "npx.cmd"
}

$renamed = @()
function Hide-LocalEnv {
  foreach ($name in @(".env", ".env.local", ".env.production.local")) {
    $path = Join-Path $root $name
    if (Test-Path $path) {
      $bak = "$path._bak"
      if (Test-Path $bak) { Remove-Item $bak -Force }
      Rename-Item $path $bak -Force
      $script:renamed += @{ From = $path; Bak = $bak }
    }
  }
}

function Restore-LocalEnv {
  foreach ($item in $renamed) {
    if (Test-Path $item.Bak) {
      if (Test-Path $item.From) { Remove-Item $item.From -Force }
      Rename-Item $item.Bak (Split-Path -Leaf $item.From) -Force
    }
  }
}

function Test-PostgresUrl([string]$Value) {
  return $Value -match '^postgres(ql)?://'
}

function Get-SessionPostgresUrl {
  foreach ($key in @("DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL")) {
    $v = (Get-Item "Env:$key" -ErrorAction SilentlyContinue).Value
    if (Test-PostgresUrl $v) { return $v }
  }
  return $null
}

if ($Manual) {
  if (-not (Test-PostgresUrl (Get-SessionPostgresUrl))) {
    Write-Host '[erro] Modo -Manual exige DATABASE_URL do Neon nesta sessao.'
    Write-Host '  Vercel: Settings -> Environment Variables -> Reveal'
    Write-Host '  $env:DATABASE_URL = postgresql://...'
    Write-Host '  $env:DATABASE_URL_UNPOOLED = postgresql://...'
    exit 1
  }
}

Hide-LocalEnv
try {
  if ($Manual) {
    Write-Host '[info] Modo manual: URLs da sessao; .env local ignorado.'
    & node scripts/push-prod-schema.cjs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    exit 0
  }

  Write-Host '[info] Tentando Vercel CLI com env de producao...'
  Write-Host '[info] Se falhar, use -Manual com URLs do Neon na Vercel.'
  & $npx vercel env run -e production -- node scripts/push-prod-schema.cjs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
  Restore-LocalEnv
}
