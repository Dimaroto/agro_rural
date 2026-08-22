# Para o PHP do emissor Agro Rural (porta 8001) e o php.exe do runtime instalado.
param(
    [string]$AppRoot = ""
)

$ErrorActionPreference = "SilentlyContinue"

$emissorRoot = if ($AppRoot) {
    Join-Path $AppRoot "emissor_nfe"
} else {
    Split-Path -Parent $PSScriptRoot
}

$port = 8001
Get-NetTCPConnection -LocalPort $port -State Listen |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

$php = Join-Path $emissorRoot "runtime\php\php.exe"
if (Test-Path -LiteralPath $php) {
    $full = (Resolve-Path -LiteralPath $php).Path
    Get-CimInstance Win32_Process -Filter "Name='php.exe'" |
        Where-Object { $_.ExecutablePath -and ($_.ExecutablePath -ieq $full) } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
}

exit 0
