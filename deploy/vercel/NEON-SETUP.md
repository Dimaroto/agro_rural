# Neon — passo 2 do deploy

Configure o PostgreSQL para o projeto **catalogo** na Vercel.

## Opção A — pelo painel Vercel (recomendado)

1. Abra o projeto: https://vercel.com/contateiedem-1067s-projects/catalogo
2. Aba **Storage** → **Create Database** → **Neon** (ou **Integrations** → Neon)
3. Crie o banco e **conecte ao projeto** `catalogo`
4. A Vercel adiciona automaticamente:
   - `DATABASE_URL` (connection pooled)
   - `POSTGRES_URL` / variáveis relacionadas
5. Adicione manualmente **`DIRECT_URL`** com a connection string **direct** do Neon (sem `-pooler`):
   - No Neon Console → Connection Details → **Direct connection**
   - Vercel → Settings → Environment Variables → `DIRECT_URL`

## Opção B — Neon Console direto

1. https://console.neon.tech → **New Project** (nome: `catalogo-saboart`)
2. Região: **South America (São Paulo)** se disponível
3. Copie as strings:
   - **Pooled** → `DATABASE_URL` na Vercel
   - **Direct** → `DIRECT_URL` na Vercel

## Variáveis obrigatórias na Vercel

Depois do Neon, configure em **Settings → Environment Variables** (Production, Preview, Development):

| Variável | Valor |
|----------|-------|
| `DATABASE_URL` | pooled do Neon |
| `DIRECT_URL` | direct do Neon |
| `AUTH_SECRET` | gere: `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | `https://catalogo-*.vercel.app` (ajuste após deploy) |
| `DEFAULT_STORE_SLUG` | `saboart` |
| `NEXT_PUBLIC_DEFAULT_STORE_SLUG` | `saboart` |
| `CUSTOMER_AUTH_PROVIDER` | `mock` |

## Criar tabelas e dados (após salvar as env vars)

No PowerShell, na pasta do projeto:

```powershell
cd C:\Flutter\catalogo

$env:DATABASE_URL = "postgresql://...sua-url-pooled..."
$env:DIRECT_URL = "postgresql://...sua-url-direct..."

npm run db:setup:prod
```

Isso executa `prisma db push` + `db:seed` (loja, produtos, admin).

**Admin:** `admin@loja.com` / `admin123`

## Conectar GitHub (se ainda não conectou)

O CLI falhou ao conectar o repo automaticamente. No painel Vercel:

1. **Settings → Git** → Connect Git Repository
2. Selecione `EdemSoftware/saboartdadag`
3. Branch de produção: `main`

## Próximo passo (parte 3)

1. **Storage → Blob** no projeto Vercel (upload de imagens)
2. **Deployments → Redeploy** após todas as env vars
3. Testar `/` e `/admin/login`
