# Instalador Windows — Agro Rural (Edem Software)

Gera `AgroRural-Setup-{version}.exe` com o **app Windows** (janela nativa) + emissor NF-e local, no mesmo estilo da Mecânica Bedendo.

## Pré-requisitos

- Windows 10/11
- Node.js 20+ (para empacotar o Electron)
- [Inno Setup 6](https://jrsoftware.org/isinfo.php)
- Rede (PHP portátil / Composer / Electron)

## Build

```powershell
powershell -ExecutionPolicy Bypass -File installer\build-windows.ps1 -Version 1.1.0
```

Saída: `installer\output\AgroRural-Setup-*.exe`

- `-SkipDesktop` — não recompila o app Electron (usa `desktop\dist\win-unpacked` já existente)
- `-SkipComposer` / `-SkipCompile` / `-IncludeSecrets` — iguais ao fluxo anterior

## O que o Setup instala

| Item | Destino |
|------|---------|
| App Windows `AgroRural.exe` | `%LOCALAPPDATA%\Agro Rural Zortea\Agro Rural\` |
| Emissor Laravel + PHP | `...\emissor_nfe\` |
| Atalho | Agro Rural (não é link da internet) |

No app: barra **Iniciar emissor** / **Configurar emissor** (tela separada) e **F11** tela cheia.

## Publicar o download em /admin

```powershell
npm run env:pull
npm run emissor:upload-setup
```

Grave a URL impressa em `EMISSOR_SETUP_URL` no projeto Vercel. A aba `/admin/emissor` usa essa URL no botão **Baixar para Windows**.
