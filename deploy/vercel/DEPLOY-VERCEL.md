# Deploy na Vercel

Guia para publicar o Catálogo SaboArt na [Vercel](https://vercel.com).

## Pré-requisitos

- Repositório no GitHub: [EdemSoftware/saboartdadag](https://github.com/EdemSoftware/saboartdadag)
- Conta na Vercel (plano Hobby gratuito funciona)
- Banco **PostgreSQL** (Neon ou Supabase — plano gratuito)
- **Vercel Blob** para upload de imagens no admin

## 1. Banco PostgreSQL (Neon)

1. Crie um projeto em [neon.tech](https://neon.tech)
2. Copie duas connection strings:
   - **Pooled** → `DATABASE_URL` (termina em `-pooler`)
   - **Direct** → `DIRECT_URL` (sem pooler, para migrations)

Exemplo:

```
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.sa-east-1.aws.neon.tech/catalogo?sslmode=require
DIRECT_URL=postgresql://user:pass@ep-xxx.sa-east-1.aws.neon.tech/catalogo?sslmode=require
```

## 2. Vercel Blob (imagens)

1. No projeto Vercel: **Storage** → **Create Database** → **Blob**
2. Conecte ao projeto — a variável `BLOB_READ_WRITE_TOKEN` é criada automaticamente

Sem Blob, uploads no admin **não persistem** em produção.

## 3. Importar projeto na Vercel

1. [vercel.com/new](https://vercel.com/new) → importe o repositório GitHub
2. Framework: **Next.js** (detectado automaticamente)
3. Build Command: `prisma generate && next build` (já em `vercel.json`)

## 4. Variáveis de ambiente

Configure em **Settings → Environment Variables**:

| Variável | Obrigatória | Exemplo |
|----------|-------------|---------|
| `DATABASE_URL` | Sim | URL pooled do Neon |
| `DIRECT_URL` | Sim | URL direct do Neon |
| `AUTH_SECRET` | Sim | string aleatória longa |
| `NEXT_PUBLIC_APP_URL` | Sim | `https://seu-app.vercel.app` |
| `DEFAULT_STORE_SLUG` | Sim | `saboart` |
| `NEXT_PUBLIC_DEFAULT_STORE_SLUG` | Sim | `saboart` |
| `BLOB_READ_WRITE_TOKEN` | Sim* | auto ao conectar Blob |
| `CUSTOMER_AUTH_PROVIDER` | Não | `mock` |
| `PAYMENTS_ENABLED` | Não | `false` |
| `NEXT_PUBLIC_PAYMENTS_ENABLED` | Não | `false` |
| `NEXT_PUBLIC_CARD_PAYMENTS_ENABLED` | Não | `true` (com Mercado Pago) |
| `MERCADOPAGO_ACCESS_TOKEN` | Não* | Access Token (PIX + cartão) — servidor |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Não* | Public Key (formulário de cartão) — **não** é o Access Token |
| `MERCADOPAGO_WEBHOOK_SECRET` | Não* | segredo do webhook |
| `PIX_ORDER_EXPIRY_MINUTES` | Não | `30` |
| `CHECKOUT_EXPIRY_MINUTES` | Não | `60` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Sim* | chave pública Web Push |
| `VAPID_PRIVATE_KEY` | Sim* | chave privada Web Push |
| `VAPID_SUBJECT` | Não | `mailto:seu@email.com` |

\* Necessárias para alertas instantâneos no dispositivo via Web Push.

Gere o par VAPID com:

```bash
npx web-push generate-vapid-keys
```

Gere `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

## 5. Criar tabelas e dados iniciais

Após o primeiro deploy (ou após features que alteram o schema, como lembrancinhas), rode no seu computador (com as URLs de produção):

```bash
# Aplicar schema (inclui isPartyFavor e campos de personalização)
DATABASE_URL="..." DATABASE_URL_UNPOOLED="..." npx prisma db push

# Popular loja, produtos e admin
DATABASE_URL="..." DATABASE_URL_UNPOOLED="..." npm run db:seed
```

Credenciais padrão do seed: `admin@loja.com` / `admin123`

## 6. Deploy

Cada push na branch `main` dispara deploy automático (se configurado).

Deploy manual: **Deployments** → **Redeploy**

## 7. Verificar

- Loja: `https://seu-app.vercel.app/`
- Admin: `https://seu-app.vercel.app/admin/login`
- Upload de imagem em **Admin → Produtos** ou **Categorias**

## Desenvolvimento local

```bash
docker compose up -d
cp env.example .env
npm install
npm run db:push
npm run db:seed
npm run dev
```

Upload local grava em `public/uploads/` quando `BLOB_READ_WRITE_TOKEN` está vazio.

## Pagamentos com Mercado Pago (PIX + cartão)

1. Crie uma aplicação em [Suas integrações](https://www.mercadopago.com.br/developers/panel/app)
2. Copie o **Access Token** (use o de teste/`TEST-` no sandbox)
3. Configure as variáveis na Vercel:

| Variável | Exemplo |
|----------|---------|
| `PAYMENTS_ENABLED` | `true` |
| `NEXT_PUBLIC_PAYMENTS_ENABLED` | `true` |
| `NEXT_PUBLIC_CARD_PAYMENTS_ENABLED` | `true` |
| `MERCADOPAGO_ACCESS_TOKEN` | Access Token |
| `MERCADOPAGO_WEBHOOK_SECRET` | segredo do webhook |
| `NEXT_PUBLIC_APP_URL` | `https://seu-app.vercel.app` |
| `PIX_ORDER_EXPIRY_MINUTES` | `30` |
| `CHECKOUT_EXPIRY_MINUTES` | `60` |

4. Em **Webhooks → Configurar notificações**, use a URL:

```
https://seu-app.vercel.app/api/webhooks/mercadopago
```

5. Marque o evento **Payments** (`payment`) e copie o **segredo** gerado para `MERCADOPAGO_WEBHOOK_SECRET`

### Como funciona

| Método | Fluxo |
|--------|--------|
| **PIX** | API `/v1/payments` → QR na tela `/pedido/[id]` → webhook confirma |
| **Cartão** | Checkout Pro (`/checkout/preferences`) → redirect ao MP → webhook confirma |

O webhook valida o header `x-signature` (HMAC-SHA256), busca o pagamento na API do MP e só marca o pedido como pago se `status === approved`. Para cartão, o `external_reference` liga o pagamento ao pedido (o `externalId` inicial é o `preference_id`).

Alias legado (mesmo handler): `/api/webhooks/pix`

## Solução de problemas

| Problema | Solução |
|----------|---------|
| Build falha no Prisma | Confirme `DATABASE_URL` e `DIRECT_URL` nas env vars da Vercel |
| Admin sem login | Rode `db:seed` no banco de produção |
| Imagens somem após deploy | Conecte Vercel Blob; não use `public/uploads` em produção |
| Erro de conexão Neon | Use URL `-pooler` em `DATABASE_URL` e URL direct em `DIRECT_URL` |
