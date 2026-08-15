# Setup do emissor NFe — Agro Rural

Pasta versionada junto com o app Next.js (`agro_rural`). Não inclui `vendor/`, `.env` nem certificado A1.

## Arquitetura

- **App web (Vercel):** pedidos, clientes e produtos no **Neon** (schema `public`, Prisma).
- **Emissor Laravel:** roda **local** em cada PC (`127.0.0.1:8000`); tabelas fiscais no **mesmo Neon**, schema `emissor`.
- Nos PCs: **mesmo `APP_KEY`** e **mesmas credenciais Neon** no `.env`.
- O admin em https://agroruralzortea.com.br chama o emissor no browser (`127.0.0.1:8000`) — o servidor Vercel não alcança o localhost.

## Instalador Windows (recomendado no PC do lojista)

1. Na máquina de build: `powershell -ExecutionPolicy Bypass -File installer\build-windows.ps1`
2. Entregue `installer\output\AgroRural-Setup-*.exe` (opcional: `-IncludeSecrets` + `DESBLOQUEIO.txt` no pendrive).
3. No PC da loja: rode o Setup **sem** “Executar como administrador”.
4. Abra https://agroruralzortea.com.br/admin → engrenagem:
   - LED vermelho → **Iniciar emissor** (`agro-emissor://`)
   - LED verde → **Configurar emissor** / preencha **Fiscal / NF-e**
5. Em Vendas, use **Emitir NF-e**.

Detalhes: [`installer/README.md`](../installer/README.md).

## Setup manual (desenvolvimento)

### PC 1 — primeiro setup

1. Use o Neon do projeto Agro Rural (Vercel / `neon-coquelicot-prism`). Copie a connection string **direta** (host **sem** `-pooler`).
2. No PC:

```powershell
cd emissor_nfe
composer install
copy .env.example .env
php artisan key:generate
```

3. Edite `.env` (ou `scripts\wire-neon.ps1`):
   - `DB_CONNECTION=pgsql`
   - `DB_URL="postgresql://..."` — host sem `-pooler`
   - `DB_SSLMODE=require`
   - `DB_SEARCH_PATH=emissor,public`
   - Habilite `pdo_pgsql` no PHP.

4. Migre (cria schema `emissor` + tabelas fiscais):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\wire-neon.ps1 -DatabaseUrl "postgresql://USER:PASS@HOST/neondb?sslmode=require"
php artisan migrate
php artisan db:seed
```

5. Suba:

```bat
scripts\start-local.bat
```

Painel: http://127.0.0.1:8000 — cadastre empresa, certificado A1 e gere o token em Configurações → Integração (ou no admin: **Carregar do emissor local**).

### PC 2 — mesmo banco

```powershell
cd emissor_nfe
composer install
```

Copie o **`.env` completo do PC1** (incluindo `APP_KEY`). **Não** rode `php artisan key:generate`.

```bat
scripts\start-local.bat
```

## Token / admin web

| Campo | Valor |
|-------|--------|
| URL base | `http://127.0.0.1:8000` |
| Token Bearer | Engrenagem → Fiscal → Carregar / login / colar; ou `.agro_token.txt` |
| Protocolo | `agro-emissor://start` (instalador) |
| Origens CORS | `https://agroruralzortea.com.br`, `http://localhost:3000` |

Checklist: PHP portátil ou sistema, Neon acessível, `APP_KEY` compartilhado, primeiro `migrate` via bootstrap ou artisan.

Evite emitir ao mesmo tempo em dois PCs (conflito de numeração).

## Endpoints

| Documento | Rota |
|-----------|------|
| NF-e 55 | `POST /api/v1/integracoes/agro/nfe/emitir` |
| NFC-e 65 | `POST /api/v1/integracoes/agro/nfce/emitir` |
| Download XML | `POST /api/v1/integracoes/agro/nfe/download-por-chave` |
| Token local | `GET /api/v1/integracoes/agro/token-local` |

Health: `GET http://127.0.0.1:8000/up`
