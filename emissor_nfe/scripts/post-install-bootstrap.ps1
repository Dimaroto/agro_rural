# Pos-instalacao: PHP + extensoes + .env (Neon) + teste do banco.
# Chamado pelo Inno Setup (task bootstrapdb).
# Uso manual:
#   powershell -ExecutionPolicy Bypass -File post-install-bootstrap.ps1
#   powershell -ExecutionPolicy Bypass -File post-install-bootstrap.ps1 -PassphraseFile .\DESBLOQUEIO.txt

param(
    [string]$EmissorRoot = '',
    [string]$PassphraseFile = '',
    [string]$Passphrase = '',
    [switch]$NoPause
)

$ErrorActionPreference = 'Continue'
$script:BootstrapFailed = $false

function Write-BootstrapLog([string]$Message, [string]$Color = 'White') {
    Write-Host $Message -ForegroundColor $Color
    try {
        $logDir = Join-Path $env:LOCALAPPDATA 'Agro Rural Zortea\emissor\logs'
        if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
        $log = Join-Path $logDir 'bootstrap.log'
        Add-Content -LiteralPath $log -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message)
    } catch {}
}

function Exit-Bootstrap([int]$Code, [string]$Message = '') {
    if ($Message) { Write-BootstrapLog $Message $(if ($Code -eq 0) { 'Green' } else { 'Red' }) }
    if ($Code -ne 0) {
        $script:BootstrapFailed = $true
        Write-BootstrapLog '--- FALHA no bootstrap. Log: %LOCALAPPDATA%\Agro Rural Zortea\emissor\logs\bootstrap.log ---' 'Yellow'
        if (-not $NoPause) {
            Write-Host ''
            Write-Host 'Pressione Enter para fechar...' -ForegroundColor Yellow
            try { [void][Console]::ReadLine() } catch { Start-Sleep -Seconds 20 }
        }
    }
    exit $Code
}

if (-not $EmissorRoot) {
    $EmissorRoot = Split-Path -Parent $PSScriptRoot
}
if (-not (Test-Path $EmissorRoot)) {
    Exit-Bootstrap 1 "[ERRO] EmissorRoot invalido: $EmissorRoot"
}
$EmissorRoot = (Resolve-Path $EmissorRoot).Path
Set-Location $EmissorRoot

$crypto = Join-Path $PSScriptRoot 'secrets-crypto.ps1'
if (Test-Path $crypto) {
    . $crypto
} else {
    Exit-Bootstrap 1 '[ERRO] secrets-crypto.ps1 nao encontrado.'
}

Write-BootstrapLog '=== Agro Rural Zortea - bootstrap do emissor ===' 'Cyan'
Write-BootstrapLog "Pasta: $EmissorRoot"
Write-BootstrapLog ("PS: " + $PSVersionTable.PSVersion.ToString())

$envFile = Join-Path $EmissorRoot '.env'
$encFile = Join-Path $EmissorRoot 'installer-secrets.enc'

function Resolve-Passphrase {
    if (-not [string]::IsNullOrWhiteSpace($Passphrase)) {
        return $Passphrase.Trim()
    }

    $candidates = New-Object System.Collections.Generic.List[string]
    if ($PassphraseFile) { [void]$candidates.Add($PassphraseFile) }

    # Locais tipicos apos Setup / pendrive / zip
    $appRoot = Split-Path $EmissorRoot
    @(
        (Join-Path $EmissorRoot 'DESBLOQUEIO.txt'),
        (Join-Path $appRoot 'DESBLOQUEIO.txt'),
        (Join-Path $appRoot 'config\DESBLOQUEIO.txt'),
        (Join-Path (Get-SecretsConfigDir) 'DESBLOQUEIO.txt'),
        (Join-Path ([Environment]::GetFolderPath('Desktop')) 'DESBLOQUEIO.txt')
    ) | ForEach-Object { if ($_ -and -not $candidates.Contains($_)) { [void]$candidates.Add($_) } }

    # Pasta de onde o Setup foi executado (Inno passa -PassphraseFile {src}\...)
    foreach ($c in $candidates) {
        if (-not $c) { continue }
        Write-BootstrapLog "Procurando chave em: $c"
        if (-not (Test-Path -LiteralPath $c)) { continue }
        $pw = Resolve-InstallerPassphraseFromFile -Path $c
        if ($pw) {
            Write-BootstrapLog ("Chave encontrada (len={0}) em: {1}" -f $pw.Length, $c) 'Green'
            return $pw
        }
        Write-BootstrapLog "[AVISO] Arquivo existe mas nenhuma PASSPHRASE valida: $c" 'Yellow'
    }
    return $null
}

function Normalize-NeonDbUrlInEnvFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return }
    try {
        # Libera leitura se ACL anterior travou o arquivo
        attrib -R -S -H $Path 2>$null | Out-Null
        if (Get-Command Protect-EnvFileAcl -ErrorAction SilentlyContinue) {
            # Reaplica ACL correta (SIDs) para o usuario atual voltar a ler
            Protect-EnvFileAcl -Path $Path
        }
        $raw = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
    } catch {
        Write-BootstrapLog ("AVISO: nao foi possivel ler {0}: {1}" -f $Path, $_) 'Yellow'
        return
    }
    $changed = $false
    if ($raw -match 'channel_binding=') {
        $raw = $raw -replace '[&?]channel_binding=[^&\s"]+', ''
        $raw = $raw -replace 'DB_URL="([^"]+)\?&', 'DB_URL="$1?'
        $raw = $raw -replace 'DB_URL=([^\s]+)\?&', 'DB_URL=$1?'
        $changed = $true
        Write-BootstrapLog 'Removido channel_binding da DB_URL (compat PHP).' 'Yellow'
    }
    # Sessao em arquivo: evita "could not find driver" so na tela de login/painel
    if ($raw -match '(?m)^SESSION_DRIVER\s*=\s*database\s*$') {
        $raw = [regex]::Replace($raw, '(?m)^SESSION_DRIVER\s*=\s*database\s*$', 'SESSION_DRIVER=file')
        $changed = $true
        Write-BootstrapLog 'SESSION_DRIVER=file (evita sessao no Postgres sem pdo_pgsql).' 'Yellow'
    } elseif ($raw -notmatch '(?m)^SESSION_DRIVER\s*=') {
        $raw = $raw.TrimEnd() + "`r`nSESSION_DRIVER=file`r`n"
        $changed = $true
    }
    # Painel do app usa 127.0.0.1 — APP_URL=localhost quebra POST/redirect do certificado no WebView
    if ($raw -match '(?m)^APP_URL\s*=\s*https?://localhost(:\d+)?\s*$') {
        $raw = [regex]::Replace($raw, '(?m)^APP_URL\s*=\s*https?://localhost(:\d+)?\s*$', 'APP_URL=http://127.0.0.1:8000')
        $changed = $true
        Write-BootstrapLog 'APP_URL=http://127.0.0.1:8000 (compat WebView do app).' 'Yellow'
    } elseif ($raw -notmatch '(?m)^APP_URL\s*=') {
        $raw = $raw.TrimEnd() + "`r`nAPP_URL=http://127.0.0.1:8000`r`n"
        $changed = $true
    }
    if ($changed) {
        try {
            Set-Content -LiteralPath $Path -Value $raw -Encoding UTF8 -NoNewline
        } catch {
            Write-BootstrapLog ("AVISO: nao gravou .env normalizado: {0}" -f $_) 'Yellow'
        }
    }
}

if (-not (Test-Path $envFile) -and (Test-Path $encFile)) {
    Write-BootstrapLog 'Descriptografando installer-secrets.enc ...'
    $pw = Resolve-Passphrase
    if (-not $pw) {
        Exit-Bootstrap 1 '[ERRO] Falta DESBLOQUEIO.txt valido (PASSPHRASE=...) ao lado do Setup.'
    }
    $tmpSecrets = Join-Path ([IO.Path]::GetTempPath()) ("mb-dec-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $tmpSecrets | Out-Null
    try {
        $protected = [IO.File]::ReadAllBytes($encFile)
        Write-BootstrapLog ("Blob: {0} bytes" -f $protected.Length)
        $zipBytes = Unprotect-InstallerSecrets -ProtectedBytes $protected -Passphrase $pw
        Write-BootstrapLog ("ZIP descriptografado: {0} bytes" -f $zipBytes.Length)
        Expand-SecretsPayloadZipBytes -ZipBytes $zipBytes -DestDir $tmpSecrets

        $configDir = Get-SecretsConfigDir
        $srcEnv = Join-Path $tmpSecrets '.env'
        if (-not (Test-Path $srcEnv)) {
            $found = Get-ChildItem $tmpSecrets -Force -File | ForEach-Object { $_.Name }
            throw (".env ausente no pacote. Arquivos: " + ($found -join ', '))
        }
        Copy-Item -Force $srcEnv (Join-Path $configDir '.env')
        $srcToken = Join-Path $tmpSecrets '.agro_token.txt'
        if (Test-Path $srcToken) {
            Copy-Item -Force $srcToken (Join-Path $configDir '.agro_token.txt')
        }
        # Guarda copia da chave usada (so local) para re-bootstrap
        if ($PassphraseFile -and (Test-Path -LiteralPath $PassphraseFile)) {
            Copy-Item -Force $PassphraseFile (Join-Path $configDir 'DESBLOQUEIO.txt') -ErrorAction SilentlyContinue
            Copy-Item -Force $PassphraseFile (Join-Path $EmissorRoot 'DESBLOQUEIO.txt') -ErrorAction SilentlyContinue
        }
        $null = Sync-EnvToEmissorRoot -EmissorRoot $EmissorRoot -PreferLocalCanonical -SkipAcl
        Write-BootstrapLog "Segredos em: $configDir e $envFile" 'Green'
    } catch {
        Exit-Bootstrap 1 ("ERRO: falha ao descriptografar segredos: {0}" -f $_.Exception.Message)
    } finally {
        Remove-Item $tmpSecrets -Recurse -Force -ErrorAction SilentlyContinue
    }
}

if ((Test-Path $envFile) -and (Get-Command Sync-EnvToEmissorRoot -ErrorAction SilentlyContinue)) {
    $null = Sync-EnvToEmissorRoot -EmissorRoot $EmissorRoot -SkipAcl
}

if (-not (Test-Path $envFile)) {
    if (Get-Command Sync-EnvToEmissorRoot -ErrorAction SilentlyContinue) {
        $null = Sync-EnvToEmissorRoot -EmissorRoot $EmissorRoot -PreferLocalCanonical -SkipAcl
    }
}

if (-not (Test-Path $envFile)) {
    Exit-Bootstrap 1 'ERRO: .env nao encontrado em emissor_nfe apos bootstrap.'
}

Normalize-NeonDbUrlInEnvFile -Path $envFile
$configEnv = Join-Path (Get-SecretsConfigDir) '.env'
if (Test-Path $configEnv) { Normalize-NeonDbUrlInEnvFile -Path $configEnv }

# ACL so no final (SIDs), depois de todas as leituras/escritas
if (Get-Command Protect-EnvFileAcl -ErrorAction SilentlyContinue) {
    Protect-EnvFileAcl -Path $envFile
    $tokenFile = Join-Path $EmissorRoot '.agro_token.txt'
    if (Test-Path $tokenFile) { Protect-EnvFileAcl -Path $tokenFile }
    if (Test-Path $configEnv) { Protect-EnvFileAcl -Path $configEnv }
}
Write-BootstrapLog '.env: OK (emissor_nfe + LocalAppData\config)' 'Green'

if (Test-Path $encFile) {
    try { Remove-Item -LiteralPath $encFile -Force } catch {}
}

# --- PHP + extensoes (preferir portatil embutido) ---
$portablePhp = Join-Path $EmissorRoot 'runtime\php\php.exe'
Write-BootstrapLog ("PHP portatil existe? {0} -> {1}" -f (Test-Path -LiteralPath $portablePhp), $portablePhp)

$ensurePhp = Join-Path $PSScriptRoot 'ensure-php.ps1'
$configurePhp = Join-Path $PSScriptRoot 'configure-php.ps1'
if (Test-Path -LiteralPath $ensurePhp) {
    Write-BootstrapLog 'Garantindo PHP e extensoes (ensure-php.ps1) ...'
    $ensureOut = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ensurePhp 2>&1 | Out-String
    if ($ensureOut) {
        foreach ($line in ($ensureOut -split "`r?`n")) {
            if ($line.Trim()) { Write-BootstrapLog ("ensure-php> " + $line.Trim()) }
        }
    }
    $ensureCode = $LASTEXITCODE
    Write-BootstrapLog ("ensure-php exit=$ensureCode")
    # Com PHP portatil, nao aborta o bootstrap por falha do WinGet/configure
    if ($ensureCode -ne 0 -and -not (Test-Path -LiteralPath $portablePhp)) {
        Exit-Bootstrap 1 '[ERRO] Falha ao configurar PHP/extensoes (sem PHP portatil).'
    }
} elseif (Test-Path -LiteralPath $configurePhp) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $configurePhp -InstallIfMissing
    if ($LASTEXITCODE -ne 0 -and -not (Test-Path -LiteralPath $portablePhp)) {
        Exit-Bootstrap 1 '[ERRO] configure-php falhou.'
    }
} elseif (-not (Test-Path -LiteralPath $portablePhp)) {
    Exit-Bootstrap 1 '[ERRO] ensure-php.ps1 / PHP portatil nao encontrados.'
}

$php = $null
if (Test-Path -LiteralPath $portablePhp) {
    $php = $portablePhp
    $env:Path = "$(Split-Path -Parent $portablePhp);$env:Path"
    Remove-Item Env:\PHPRC -ErrorAction SilentlyContinue
}
if (-not $php) {
    $phpCmd = Get-Command php -ErrorAction SilentlyContinue
    if ($phpCmd) { $php = $phpCmd.Source }
}
if (-not $php) {
    $winget = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
    $php = Get-ChildItem $winget -Directory -Filter 'PHP.PHP.8.*_*' -ErrorAction SilentlyContinue |
        ForEach-Object { Join-Path $_.FullName 'php.exe' } |
        Where-Object { Test-Path $_ } |
        Select-Object -First 1
}
if (-not $php) {
    Exit-Bootstrap 1 '[ERRO] PHP nao disponivel apos configuracao.'
}
Write-BootstrapLog "PHP: $php" 'Green'

# --- migrate + teste DB ---
Write-BootstrapLog 'artisan migrate --force ...'
& $php artisan migrate --force
if ($LASTEXITCODE -ne 0) {
    Write-BootstrapLog '[AVISO] migrate retornou codigo nao-zero; seguindo para test-db.' 'Yellow'
}

$testDb = Join-Path $PSScriptRoot 'test-db.ps1'
if (Test-Path $testDb) {
    Write-BootstrapLog 'Rodando test-db.ps1 ...'
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $testDb
    $code = $LASTEXITCODE
    if ($code -ne 0) {
        Exit-Bootstrap $code "[ERRO] test-db falhou (codigo $code)."
    }
} else {
    Write-BootstrapLog 'artisan db:show ...'
    & $php artisan db:show
    if ($LASTEXITCODE -ne 0) {
        Exit-Bootstrap 1 '[ERRO] Falha ao conectar no banco. Confira DB_URL no .env.'
    }
}

$ensureStorage = Join-Path $PSScriptRoot 'ensure-storage.ps1'
if (Test-Path -LiteralPath $ensureStorage) {
    Write-BootstrapLog 'Preparando pastas storage/bootstrap gravaveis ...'
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ensureStorage
}

$ensureToken = Join-Path $PSScriptRoot 'ensure-agro-token.php'
if (Test-Path -LiteralPath $ensureToken) {
    Write-BootstrapLog 'Gerando token Sanctum para o app Flutter ...'
    & $php $ensureToken
    if ($LASTEXITCODE -ne 0) {
        Write-BootstrapLog '[AVISO] ensure-agro-token falhou — gere em Configuracoes > Integracao app.' 'Yellow'
    } else {
        Write-BootstrapLog 'Token salvo em .agro_token.txt (cole no Flutter se necessario).' 'Green'
    }
}

Write-BootstrapLog ''
Exit-Bootstrap 0 'Bootstrap concluido. Pode abrir o app e Iniciar emissor.'
