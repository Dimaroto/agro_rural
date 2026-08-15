# Configura PHP para o emissor NF-e (instalacao + Iniciar emissor).
# - Garante PHP 8.4 (winget) quando possivel
# - Copia libpq/libssl ao lado do php.exe
# - Gera php-emissor.ini no root do emissor (usado via PHPRC no artisan serve)
# - Valida PDO pgsql com esse ini
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\configure-php.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\configure-php.ps1 -InstallIfMissing

param(
    [switch]$InstallIfMissing
)

$ErrorActionPreference = 'Continue'

$RequiredExtensions = @(
    'openssl', 'curl', 'mbstring', 'fileinfo', 'zip', 'gd', 'soap',
    'intl', 'pgsql', 'pdo_pgsql', 'sodium', 'ftp'
)

function Write-Log {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [string]$Color = 'White'
    )
    Write-Host $Message -ForegroundColor $Color
}

function Find-PhpCandidates {
    $list = New-Object System.Collections.Generic.List[string]
    $wingetRoot = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
    if (Test-Path $wingetRoot) {
        foreach ($pattern in @('PHP.PHP.8.4_*', 'PHP.PHP.NTS.8.4_*', 'PHP.PHP.8.3_*', 'PHP.PHP.NTS.8.3_*', 'PHP.PHP.8.*_*')) {
            Get-ChildItem $wingetRoot -Directory -Filter $pattern -ErrorAction SilentlyContinue |
                ForEach-Object {
                    $exe = Join-Path $_.FullName 'php.exe'
                    if (Test-Path $exe) { [void]$list.Add($exe) }
                }
        }
    }
    $cmd = Get-Command php -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source -and (Test-Path $cmd.Source)) {
        [void]$list.Add($cmd.Source)
    }
    return @(
        $list |
            Select-Object -Unique |
            Sort-Object {
                if ($_ -match 'PHP\.PHP(?:\.NTS)?\.8\.4') { 0 }
                elseif ($_ -match 'PHP\.PHP(?:\.NTS)?\.8\.3') { 1 }
                else { 2 }
            }, { $_ }
    )
}

function Get-PhpVersion([string]$PhpExe) {
    try {
        $out = & $PhpExe -r "echo PHP_VERSION;" 2>$null
        return "$out".Trim()
    } catch {
        return ''
    }
}

function Ensure-PgsqlNativeLibs {
    param([Parameter(Mandatory = $true)][string]$PhpExe)

    $phpDir = Split-Path -Parent $PhpExe
    $needed = @('libpq.dll', 'libssl-3-x64.dll', 'libcrypto-3-x64.dll')
    $bundled = Join-Path $PSScriptRoot '..\runtime\pgsql-libs'
    try { $bundled = (Resolve-Path -LiteralPath $bundled -ErrorAction Stop).Path } catch {}
    Write-Log -Message ('pgsql-libs: ' + $bundled + ' exists=' + (Test-Path -LiteralPath $bundled))

    foreach ($name in $needed) {
        $dest = Join-Path $phpDir $name
        $src = Join-Path $bundled $name
        if (-not (Test-Path -LiteralPath $src)) {
            $winget = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
            $found = Get-ChildItem $winget -Recurse -Filter $name -ErrorAction SilentlyContinue |
                Select-Object -First 1 -ExpandProperty FullName
            if ($found) { $src = $found }
        }
        if ($src -and (Test-Path -LiteralPath $src)) {
            try {
                Copy-Item -LiteralPath $src -Destination $dest -Force
                Write-Log -Message ('OK lib: ' + $dest) -Color 'Green'
            } catch {
                Write-Log -Message ('AVISO: nao copiou ' + $name + ': ' + $_) -Color 'Yellow'
            }
        } elseif (Test-Path -LiteralPath $dest) {
            Write-Log -Message ('OK lib (ja existia): ' + $dest)
        } else {
            Write-Log -Message ('AVISO: ' + $name + ' nao encontrado.') -Color 'Yellow'
        }
    }
}

function Write-EmissorPhpIni {
    param(
        [Parameter(Mandatory = $true)][string]$PhpExe,
        [Parameter(Mandatory = $true)][string]$EmissorRoot
    )

    $phpDir = Split-Path -Parent $PhpExe
    $extDir = Join-Path $phpDir 'ext'
    if (-not (Test-Path $extDir)) {
        Write-Log -Message ('ERRO: pasta ext nao existe: ' + $extDir) -Color 'Red'
        return $null
    }
    foreach ($dll in @('php_pdo_pgsql.dll', 'php_pgsql.dll', 'php_openssl.dll')) {
        if (-not (Test-Path (Join-Path $extDir $dll))) {
            Write-Log -Message ('ERRO: falta ' + $dll + ' em ' + $extDir) -Color 'Red'
            return $null
        }
    }

    $iniPath = Join-Path $EmissorRoot 'php-emissor.ini'
    $lines = New-Object System.Collections.Generic.List[string]
    [void]$lines.Add('; Gerado por configure-php.ps1 — usado via PHPRC no start-local.bat')
    [void]$lines.Add(('extension_dir = "{0}"' -f $extDir))
    [void]$lines.Add('date.timezone = America/Sao_Paulo')
    [void]$lines.Add('memory_limit = 512M')
    foreach ($ext in $RequiredExtensions) {
        [void]$lines.Add(('extension={0}' -f $ext))
    }
    $content = ($lines -join "`r`n") + "`r`n"
    Set-Content -LiteralPath $iniPath -Value $content -Encoding ASCII -NoNewline
    Write-Log -Message ('php-emissor.ini: ' + $iniPath) -Color 'Green'

    # Espelha tambem no php.ini do PHP (ajuda ferramentas externas)
    $systemIni = Join-Path $phpDir 'php.ini'
    try {
        if (-not (Test-Path $systemIni)) {
            $prod = Join-Path $phpDir 'php.ini-production'
            if (Test-Path $prod) { Copy-Item $prod $systemIni -Force }
        }
        if (Test-Path $systemIni) {
            $raw = Get-Content -LiteralPath $systemIni -Raw
            $extLine = 'extension_dir = "' + $extDir + '"'
            if ($raw -match '(?m)^\s*;?\s*extension_dir\s*=') {
                $raw = [regex]::Replace($raw, '(?m)^\s*;?\s*extension_dir\s*=\s*.*$', $extLine)
            } else {
                $raw = $extLine + "`r`n" + $raw
            }
            foreach ($ext in @('pgsql', 'pdo_pgsql', 'openssl', 'curl', 'mbstring')) {
                if ($raw -notmatch ("(?m)^\s*extension\s*=\s*{0}\s*$" -f [regex]::Escape($ext))) {
                    if ($raw -match ("(?m)^\s*;\s*extension\s*=\s*{0}\s*$" -f [regex]::Escape($ext))) {
                        $raw = [regex]::Replace($raw, ("(?m)^\s*;\s*extension\s*=\s*{0}\s*$" -f [regex]::Escape($ext)), ("extension={0}" -f $ext))
                    } else {
                        $raw = $raw.TrimEnd() + "`r`nextension=" + $ext + "`r`n"
                    }
                }
            }
            Set-Content -LiteralPath $systemIni -Value $raw -Encoding ASCII -NoNewline
        }
    } catch {
        Write-Log -Message ('AVISO: nao atualizou php.ini do sistema: ' + $_) -Color 'Yellow'
    }

    return $iniPath
}

function Test-PgsqlDriver {
    param(
        [Parameter(Mandatory = $true)][string]$PhpExe,
        [string]$IniPath = ''
    )
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ('mb-pdo-' + [guid]::NewGuid().ToString('N') + '.php')
    try {
        @(
            '<?php',
            'try {',
            '  $d = PDO::getAvailableDrivers();',
            '  echo implode(chr(44), $d);',
            '} catch (Throwable $e) {',
            '  fwrite(STDERR, $e->getMessage());',
            '  echo "";',
            '}'
        ) -join "`n" | Set-Content -LiteralPath $tmp -Encoding ASCII

        if ($IniPath -and (Test-Path -LiteralPath $IniPath)) {
            $out = & $PhpExe -c $IniPath $tmp 2>&1 | Out-String
        } else {
            $out = & $PhpExe $tmp 2>&1 | Out-String
        }
        $drivers = ("$out" -split "`r?`n" | Where-Object { $_ -and $_ -notmatch 'Unable to load|Warning|Parse error|Notice' } | Select-Object -Last 1)
        if (-not $drivers) { $drivers = "$out".Trim() }
        Write-Log -Message ('PDO drivers: ' + $drivers)
        if ("$out" -match 'Unable to load dynamic library.*(pgsql|pdo_pgsql)') {
            Write-Log -Message 'AVISO: falha ao carregar dll pgsql (libpq.dll).' -Color 'Yellow'
            Write-Log -Message ("Detalhe: " + (("$out" -split "`r?`n" | Select-String 'Unable' | Select-Object -First 2) -join ' | ')) -Color 'Yellow'
        }
        $list = @("$drivers".Split(@(',', [char]44), [StringSplitOptions]::RemoveEmptyEntries) | ForEach-Object { $_.Trim().ToLowerInvariant() })
        return ($list -contains 'pgsql')
    } finally {
        Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    }
}

function Install-Php84 {
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if (-not $winget) {
        Write-Log -Message 'ERRO: winget indisponivel. Instale PHP 8.4 (winget install PHP.PHP.8.4).' -Color 'Red'
        return $null
    }
    Write-Log -Message 'Instalando PHP.PHP.8.4 via winget ...' -Color 'Yellow'
    & winget install --id PHP.PHP.8.4 -e --accept-package-agreements --accept-source-agreements
    Start-Sleep -Seconds 3
    return (Find-PhpCandidates | Select-Object -First 1)
}

Write-Log -Message '=== Configurar PHP (emissor NF-e) ===' -Color 'Cyan'

$emissorRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$php = Find-PhpCandidates | Select-Object -First 1
if (-not $php) {
    if (-not $InstallIfMissing) {
        Write-Log -Message 'ERRO: PHP nao encontrado.' -Color 'Red'
        exit 1
    }
    $php = Install-Php84
}

if ($InstallIfMissing -and $php -and ($php -notmatch 'PHP\.PHP(?:\.NTS)?\.8\.4')) {
    Write-Log -Message ('PHP atual: ' + $php + ' - tentando garantir 8.4 ...') -Color 'Yellow'
    $php84 = Install-Php84
    if ($php84) { $php = $php84 }
}

if (-not $php -or -not (Test-Path $php)) {
    Write-Log -Message 'ERRO: PHP nao disponivel.' -Color 'Red'
    exit 1
}

$ver = Get-PhpVersion $php
Write-Log -Message ('PHP: ' + $php + ' (' + $ver + ')')

Ensure-PgsqlNativeLibs -PhpExe $php
$ini = Write-EmissorPhpIni -PhpExe $php -EmissorRoot $emissorRoot
if (-not $ini) { exit 1 }

# PATH precisa incluir a pasta do PHP para o loader achar libpq.dll
$env:Path = (Split-Path -Parent $php) + ';' + $env:Path

if (-not (Test-PgsqlDriver -PhpExe $php -IniPath $ini)) {
    Write-Log -Message 'ERRO: PDO driver pgsql indisponivel com php-emissor.ini.' -Color 'Red'
    Write-Log -Message 'Confira libpq.dll na pasta do php.exe e ext/php_pdo_pgsql.dll' -Color 'Yellow'
    exit 1
}

Write-Log -Message 'PDO pgsql: OK (php-emissor.ini)' -Color 'Green'
# Marca caminho do PHP para o .bat
Set-Content -LiteralPath (Join-Path $emissorRoot 'php-emissor.path') -Value $php -Encoding ASCII -NoNewline
Write-Output $php
exit 0
