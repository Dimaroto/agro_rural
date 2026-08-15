# Instalador Windows — Agro Rural

Gera `AgroRural-Setup-{version}.exe` com o emissor NF-e local (sem app desktop).

## Pré-requisitos

- Windows 10/11
- [Inno Setup 6](https://jrsoftware.org/isinfo.php) (`ISCC.exe`) — o script tenta instalar via winget
- Rede (para baixar PHP portátil / Composer na máquina de build)

## Build

```powershell
# Setup sem .env embutido (loja configura depois)
powershell -ExecutionPolicy Bypass -File installer\build-windows.ps1 -Version 1.0.0

# Pendrive com Neon (criptografado)
New-Item -ItemType Directory -Force -Path installer\private | Out-Null
Copy-Item emissor_nfe\.env installer\private\.env
powershell -ExecutionPolicy Bypass -File installer\build-windows.ps1 -Version 1.0.0 -IncludeSecrets
```

Saída: `installer\output\AgroRural-Setup-*.exe` (+ `DESBLOQUEIO.txt` se `-IncludeSecrets`).

Só montar stage (sem compilar): `-SkipCompile`.

## O que o Setup instala

| Item | Destino |
|------|---------|
| Emissor Laravel + PHP | `%LOCALAPPDATA%\Agro Rural Zortea\Agro Rural\emissor_nfe\` |
| Protocolo `agro-emissor://` | HKCU (botão Iniciar no admin web) |
| Atalhos | Admin web + Iniciar emissor |

## Fluxo no PC do lojista

1. Rodar o Setup (sem “Executar como administrador”)
2. Abrir https://agroruralzortea.com.br/admin
3. Engrenagem → **Iniciar emissor** → aguardar verde → **Configurar emissor** / **Fiscal**
