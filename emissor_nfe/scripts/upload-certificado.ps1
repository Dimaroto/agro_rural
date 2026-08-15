# Envia certificado A1 (.pfx) para a empresa do emissor.
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\upload-certificado.ps1 -PfxPath "C:\caminho\cert.pfx" -Senha "sua-senha" [-EmpresaId 1]
#
# IMPORTANTE: o CNPJ do certificado deve ser o da mecanica (destinatario das NF-e de compra).
# Atualize a empresa no emissor com o CNPJ real antes de consultar DistDFe.

param(
    [Parameter(Mandatory = $true)][string]$PfxPath,
    [Parameter(Mandatory = $true)][string]$Senha,
    [int]$EmpresaId = 1
)

$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:8000'
$tokenFile = Join-Path $PSScriptRoot '..\.agro_token.txt'

if (-not (Test-Path $PfxPath)) {
    throw "Arquivo nao encontrado: $PfxPath"
}

if (-not (Test-Path $tokenFile)) {
    & (Join-Path $PSScriptRoot 'get-token.ps1') | Out-Null
}

$token = (Get-Content $tokenFile -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($token)) {
    throw 'Token vazio. Rode scripts\get-token.ps1'
}

$form = @{
    pfx = Get-Item -Path $PfxPath
    senha = $Senha
}

$uri = "$base/api/v1/empresas/$EmpresaId/certificado"
Write-Host "Enviando certificado para $uri ..."

# Invoke-RestMethod multipart
Add-Type -AssemblyName System.Net.Http
$client = [System.Net.Http.HttpClient]::new()
$client.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $token)

$multipart = [System.Net.Http.MultipartFormDataContent]::new()
$stream = [System.IO.File]::OpenRead((Resolve-Path $PfxPath))
$fileContent = [System.Net.Http.StreamContent]::new($stream)
$fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse('application/x-pkcs12')
$multipart.Add($fileContent, 'pfx', [System.IO.Path]::GetFileName($PfxPath))
$multipart.Add([System.Net.Http.StringContent]::new($Senha), 'senha')

$response = $client.PostAsync($uri, $multipart).Result
$body = $response.Content.ReadAsStringAsync().Result
$stream.Dispose()
$client.Dispose()

Write-Host "HTTP $([int]$response.StatusCode)"
Write-Host $body

if (-not $response.IsSuccessStatusCode) {
    exit 1
}

Write-Host ''
Write-Host 'Certificado cadastrado. Pode testar a chave no app Flutter.' -ForegroundColor Green
