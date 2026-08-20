# Setup do emissor neste monorepo

Pasta versionada junto com o app Flutter. Não inclui `vendor/`, `.env` nem certificado A1.

## Arquitetura (2 PCs)

- **App Flutter:** dados de negócio no **Firebase/Firestore** (já na nuvem).
- **Emissor Laravel:** roda **local** em cada PC (`127.0.0.1:8000`); banco compartilhado no **Neon Postgres**.
- Nos dois PCs: **mesmo `APP_KEY`** e **mesmas credenciais Neon** no `.env`.

## PC 1 — Neon + primeiro setup

1. Crie um projeto em [neon.tech](https://neon.tech) (Postgres free).
2. No console Neon, copie a **Connection string** (URI com `sslmode=require`).
3. No PC:

```powershell
cd emissor_nfe
composer install
copy .env.example .env
php artisan key:generate
```

4. Edite `.env` (ou use `scripts\wire-neon.ps1`):
   - `DB_CONNECTION=pgsql`
   - `DB_URL="postgresql://..."` — use o host **sem** `-pooler` na URI (o script remove automaticamente)
   - `DB_SSLMODE=require`
   - Habilite `pdo_pgsql` no PHP (veja abaixo).

5. Teste e migre (atalho PC1):

```powershell
# Cole a URI do Neon:
powershell -ExecutionPolicy Bypass -File scripts\wire-neon.ps1 -DatabaseUrl "postgresql://USER:PASS@HOST/neondb?sslmode=require"
```

Ou salve a URI em `emissor_nfe/.neon-url` (gitignored) e rode `scripts\wire-neon.ps1`.

Passo a passo manual:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-db.ps1
php artisan migrate
# Opcional: copiar dados do SQLite antigo (se existir database/database.sqlite)
php scripts\copy-sqlite-to-pgsql.php
# Se o Neon estiver vazio e não houver SQLite para copiar:
# php artisan db:seed
```

6. Subir:

```bat
scripts\start-local.bat
```

Painel: http://127.0.0.1:8000 — login do seeder em `SETUP` / checklist.

## PC 2 — mesmo banco

```powershell
cd emissor_nfe
composer install
```

Copie o **`.env` completo do PC1** (ou pelo menos `APP_KEY` + bloco `DB_*` / `DB_URL`).  
**Não** rode `php artisan key:generate` neste PC.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-db.ps1
scripts\start-local.bat
```

Não precisa `migrate` de novo se o Neon já estiver migrado.

## Extensão PHP `pdo_pgsql` (Windows / WinGet)

```powershell
php --ini
# Em php.ini, descomente:
# extension=pdo_pgsql
# extension=pgsql
```

Reinicie o terminal e confira: `php -m` deve listar `pdo_pgsql`.

## Painel visual (browser)

- **http://127.0.0.1:8000** — login se não autenticado
- Credenciais: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` no `.env` (não versionar)

No painel: histórico, **Configurações** (empresa/cert/numeração/CSC/token), etc.

## Token / app Flutter

Em **cada** PC o Flutter aponta para a API **local** daquele PC:

| Campo | Valor |
|-------|--------|
| URL base | `http://127.0.0.1:8000` |
| Token Bearer | painel → Integração app, ou `scripts\get-token.ps1` |
| ID da empresa | `1` |

Os dados fiscais (numeração, certificado, notas) ficam no Neon; o Firestore continua no Firebase.

Evite emitir NF-e **ao mesmo tempo** nos dois PCs (conflito de numeração).

## Endpoints de integração

| Documento | Rota |
|-----------|------|
| NF-e 55 (peças) | `POST /api/v1/integracoes/mecanica/nfe/emitir` |
| NFC-e 65 (legado) | `POST /api/v1/integracoes/mecanica/nfce/emitir` |
| NFS-e (mão de obra) | `POST /api/v1/integracoes/mecanica/nfse/emitir` |

NFS-e: `NFSE_MOCK=true` no `.env` (padrão) até credenciais SEFIN.

Guia: [`docs/emissor-local-checklist.md`](../docs/emissor-local-checklist.md).
