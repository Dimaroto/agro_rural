# App Windows — Agro Rural

Shell Electron (Edem Software) que abre o admin na nuvem (com cookie `client=desktop`) e o emissor local em janela separada.

```powershell
cd desktop
npm install
npm start
```

Empacotar pasta `dist/win-unpacked` (usado pelo Inno):

```powershell
npm run pack
```

- **F11** — tela cheia
- Barra — Iniciar / Configurar emissor (`emissor_nfe\scripts\start-local-hidden.vbs`)
- Admin abre em `/admin/app-boot?client=desktop` para liberar a UI completa (portal web só baixa o instalador)
