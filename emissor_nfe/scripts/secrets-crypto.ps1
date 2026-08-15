# Criptografia AES-256 (PBKDF2) para pacote de segredos do instalador.
# Compatível com Windows PowerShell 5.1+.
# Formato: MBSE1 | salt(16) | iv(16) | ciphertext

Set-StrictMode -Version Latest

function New-InstallerPassphrase {
    $bytes = New-Object byte[] 24
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $s = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    return $s
}

function Protect-InstallerSecrets {
    param(
        [Parameter(Mandatory = $true)][byte[]]$PlainBytes,
        [Parameter(Mandatory = $true)][string]$Passphrase
    )

    $salt = New-Object byte[] 16
    $iv = New-Object byte[] 16
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($salt)
        $rng.GetBytes($iv)
    } finally {
        $rng.Dispose()
    }

    $derive = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($Passphrase, $salt, 200000)
    try {
        $key = $derive.GetBytes(32)
    } finally {
        $derive.Dispose()
    }

    $aes = [System.Security.Cryptography.Aes]::Create()
    try {
        $aes.KeySize = 256
        $aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
        $aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7
        $aes.Key = $key
        $aes.IV = $iv
        $enc = $aes.CreateEncryptor()
        try {
            $cipher = $enc.TransformFinalBlock($PlainBytes, 0, $PlainBytes.Length)
        } finally {
            $enc.Dispose()
        }
    } finally {
        $aes.Dispose()
        [Array]::Clear($key, 0, $key.Length)
    }

    $magic = [Text.Encoding]::ASCII.GetBytes('MBSE1')
    $out = New-Object byte[] ($magic.Length + $salt.Length + $iv.Length + $cipher.Length)
    [Array]::Copy($magic, 0, $out, 0, $magic.Length)
    [Array]::Copy($salt, 0, $out, $magic.Length, $salt.Length)
    [Array]::Copy($iv, 0, $out, $magic.Length + $salt.Length, $iv.Length)
    [Array]::Copy($cipher, 0, $out, $magic.Length + $salt.Length + $iv.Length, $cipher.Length)
    return $out
}

function Unprotect-InstallerSecrets {
    param(
        [Parameter(Mandatory = $true)][byte[]]$ProtectedBytes,
        [Parameter(Mandatory = $true)][string]$Passphrase
    )

    $magicLen = 5
    if ($ProtectedBytes.Length -lt ($magicLen + 32)) {
        throw 'Arquivo de segredos invalido ou truncado.'
    }
    $magic = [Text.Encoding]::ASCII.GetString($ProtectedBytes, 0, $magicLen)
    if ($magic -ne 'MBSE1') {
        throw 'Formato de segredos desconhecido (esperado MBSE1).'
    }

    $salt = New-Object byte[] 16
    $iv = New-Object byte[] 16
    [Array]::Copy($ProtectedBytes, $magicLen, $salt, 0, 16)
    [Array]::Copy($ProtectedBytes, $magicLen + 16, $iv, 0, 16)
    $cipherLen = $ProtectedBytes.Length - $magicLen - 32
    $cipher = New-Object byte[] $cipherLen
    [Array]::Copy($ProtectedBytes, $magicLen + 32, $cipher, 0, $cipherLen)

    $derive = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($Passphrase, $salt, 200000)
    try {
        $key = $derive.GetBytes(32)
    } finally {
        $derive.Dispose()
    }

    $aes = [System.Security.Cryptography.Aes]::Create()
    try {
        $aes.KeySize = 256
        $aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
        $aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7
        $aes.Key = $key
        $aes.IV = $iv
        $dec = $aes.CreateDecryptor()
        try {
            return $dec.TransformFinalBlock($cipher, 0, $cipher.Length)
        } finally {
            $dec.Dispose()
        }
    } finally {
        $aes.Dispose()
        [Array]::Clear($key, 0, $key.Length)
    }
}

function New-SecretsPayloadZipBytes {
    param(
        [Parameter(Mandatory = $true)][string]$EnvPath,
        [string]$TokenPath = ''
    )
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ("mb-secrets-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    try {
        $envDest = Join-Path $tmp 'env.payload'
        Copy-Item -Force $EnvPath $envDest
        # Nome final .env (evita problemas de glob com ponto em alguns hosts)
        $envFinal = Join-Path $tmp '.env'
        Move-Item -Force $envDest $envFinal
        $files = @($envFinal)
        if ($TokenPath -and (Test-Path $TokenPath)) {
            $tokenFinal = Join-Path $tmp '.agro_token.txt'
            Copy-Item -Force $TokenPath $tokenFinal
            $files += $tokenFinal
        }
        $zipPath = Join-Path ([IO.Path]::GetTempPath()) ("mb-secrets-" + [guid]::NewGuid().ToString('N') + '.zip')
        if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
        # Lista explicita de arquivos (nao usa * — mais seguro com dotfiles)
        Compress-Archive -LiteralPath $files -DestinationPath $zipPath -CompressionLevel Optimal -Force
        try {
            return [IO.File]::ReadAllBytes($zipPath)
        } finally {
            Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
        }
    } finally {
        Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Expand-SecretsPayloadZipBytes {
    param(
        [Parameter(Mandatory = $true)][byte[]]$ZipBytes,
        [Parameter(Mandatory = $true)][string]$DestDir
    )
    $zipPath = Join-Path ([IO.Path]::GetTempPath()) ("mb-secrets-out-" + [guid]::NewGuid().ToString('N') + '.zip')
    [IO.File]::WriteAllBytes($zipPath, $ZipBytes)
    try {
        Expand-Archive -Path $zipPath -DestinationPath $DestDir -Force
    } finally {
        Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
    }
}

function Get-SecretsConfigDir {
    $base = Join-Path $env:LOCALAPPDATA 'Agro Rural Zortea\emissor'
    $dir = Join-Path $base 'config'
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    return $dir
}

function Sync-EnvToEmissorRoot {
    param(
        [Parameter(Mandatory = $true)][string]$EmissorRoot,
        [switch]$PreferLocalCanonical,
        [switch]$SkipAcl
    )
    $configDir = Get-SecretsConfigDir
    $canonicalEnv = Join-Path $configDir '.env'
    $canonicalToken = Join-Path $configDir '.agro_token.txt'
    $rootEnv = Join-Path $EmissorRoot '.env'
    $rootToken = Join-Path $EmissorRoot '.agro_token.txt'

    function Copy-SecretFile([string]$From, [string]$To) {
        if (-not (Test-Path -LiteralPath $From)) { return $false }
        try {
            # Nao usa Set-Acl: exige SeSecurityPrivilege (falha em usuario normal).
            if (Test-Path -LiteralPath $To) {
                try { attrib -R -S -H $To 2>$null | Out-Null } catch {}
                try {
                    $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
                    cmd /c "icacls `"$To`" /grant:r *${sid}:(F) >nul 2>nul" | Out-Null
                } catch {}
            }
            $destDir = Split-Path -Parent $To
            if (-not (Test-Path $destDir)) {
                New-Item -ItemType Directory -Force -Path $destDir | Out-Null
            }
            Copy-Item -LiteralPath $From -Destination $To -Force -ErrorAction Stop
            return $true
        } catch {
            Write-Host "[AVISO] Copy-Item falhou ($From -> $To): $_" -ForegroundColor Yellow
            return $false
        }
    }

    if ($PreferLocalCanonical -and (Test-Path -LiteralPath $canonicalEnv)) {
        [void](Copy-SecretFile $canonicalEnv $rootEnv)
        if (Test-Path -LiteralPath $canonicalToken) {
            [void](Copy-SecretFile $canonicalToken $rootToken)
        }
    } elseif (Test-Path -LiteralPath $rootEnv) {
        [void](Copy-SecretFile $rootEnv $canonicalEnv)
        if (Test-Path -LiteralPath $rootToken) {
            [void](Copy-SecretFile $rootToken $canonicalToken)
        }
    }

    if (-not $SkipAcl) {
        if (Test-Path -LiteralPath $canonicalEnv) { Protect-EnvFileAcl -Path $canonicalEnv }
        if (Test-Path -LiteralPath $canonicalToken) { Protect-EnvFileAcl -Path $canonicalToken }
        if (Test-Path -LiteralPath $rootEnv) { Protect-EnvFileAcl -Path $rootEnv }
        if (Test-Path -LiteralPath $rootToken) { Protect-EnvFileAcl -Path $rootToken }
    }

    return (Test-Path -LiteralPath $rootEnv)
}

function Protect-EnvFileAcl {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return }
    try {
        # icacls com SID — sem Set-Acl (SeSecurityPrivilege) e sem /inheritance:r
        # (reset de heranca tambem exige privilegio elevado em alguns PCs).
        $userSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        attrib -R -S -H $Path 2>$null | Out-Null
        cmd /c "icacls `"$Path`" /grant:r *S-1-5-18:(F) *S-1-5-32-544:(F) *${userSid}:(F) >nul 2>nul" | Out-Null
    } catch {
        # Melhor deixar o .env legivel do que abortar o bootstrap.
    }
}

function Resolve-InstallerPassphraseFromText {
    param([Parameter(Mandatory = $true)][string]$Raw)

    # Formato preferido: PASSPHRASE=...
    foreach ($line in ($Raw -split "`r?`n")) {
        $t = $line.Trim()
        if ($t -match '(?i)^PASSPHRASE\s*=\s*(.+)$') {
            $v = $Matches[1].Trim().Trim('"').Trim("'")
            if ($v.Length -ge 16) { return $v }
        }
    }

    # Linha unica que parece a chave (base64url). Nunca "====" nem texto.
    foreach ($line in ($Raw -split "`r?`n")) {
        $t = $line.Trim()
        if ($t.Length -lt 16) { continue }
        if ($t -match '^=+$') { continue } # bug antigo: ===== virava "chave"
        if ($t -match '\s') { continue }
        if ($t -notmatch '^[A-Za-z0-9_-]+$') { continue }
        if ($t -match '(?i)mecanica|guarde|desbloqueio|neon|pendrive|setup|apos|instal') { continue }
        return $t
    }
    return $null
}

function Resolve-InstallerPassphraseFromFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    $raw = Get-Content -LiteralPath $Path -Raw -ErrorAction SilentlyContinue
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    return Resolve-InstallerPassphraseFromText -Raw $raw
}
