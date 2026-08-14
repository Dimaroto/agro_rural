# Catálogo WhatsApp

Catálogo PWA compartilhável pelo WhatsApp, com controle de estoque manual e pagamento PIX (v2).

## Stack

- Next.js 16 + TypeScript + Tailwind
- PostgreSQL + Prisma
- NextAuth (credenciais) para admin
- PIX e cartão via Mercado Pago (ou mock em desenvolvimento) 
  
   
## Início rápido

### 1. Banco de dados 

O projeto usa **PostgreSQL** (Prisma). Em desenvolvimento, suba o Postgres com Docker: 

```bash
docker compose up -d 
```

Configure `DATABASE_URL` e `DIRECT_URL` no `.env` (veja `env.example`).

Para produção na **Vercel**, use [Neon](https://neon.tech) ou [Supabase](https://supabase.com). Guia completo: [`deploy/vercel/DEPLOY-VERCEL.md`](deploy/vercel/DEPLOY-VERCEL.md).

### 2. Variáveis de ambiente

```bash
cp env.example .env
```

Edite `DATABASE_URL` e `AUTH_SECRET`.

### 3. Instalar e migrar

```bash
npm install
npm run db:push
npm run db:seed
```

### 4. Rodar

```bash
npm run dev
```

### Testar no emulador Android ou celular na mesma rede

```bash
npm run dev:mobile
```

| Onde abrir | URL |
|------------|-----|
| Emulador Android (Android Studio) | `http://10.0.2.2:3000/s/minha-loja` |
| Celular físico (mesmo Wi‑Fi) | `http://SEU_IP:3000/s/minha-loja` (ex: `http://192.168.0.6:3000/s/minha-loja`) |

No `.env`, ajuste `NEXT_PUBLIC_APP_URL` para o mesmo endereço que o emulador usa.

- **Catálogo público:** http://localhost:3000/s/minha-loja
- **Admin:** http://localhost:3000/admin/login — `admin@loja.com` / `admin123`

## Habilitar pagamentos (PIX + cartão)

No `.env`:

```
PAYMENTS_ENABLED=true
NEXT_PUBLIC_PAYMENTS_ENABLED=true
NEXT_PUBLIC_CARD_PAYMENTS_ENABLED=true
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...   # Access Token (servidor)
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=APP_USR-...  # Public Key (frontend) — NÃO use o Access Token aqui
MERCADOPAGO_WEBHOOK_SECRET=seu_segredo_do_webhook
NEXT_PUBLIC_APP_URL=https://seu-dominio.com
```

As duas chaves vêm do mesmo app em [Suas integrações](https://www.mercadopago.com.br/developers/panel/app) → **Credenciais de produção**.
Elas precisam ser do **mesmo aplicativo**; misturar Access Token de um app com Public Key de outro (ou colocar o token no lugar da public key) gera erro `not found public_key`.

- **PIX:** cobrança via API de pagamentos (QR + copia e cola na tela do pedido)
- **Cartão:** Checkout Pro (redirecionamento para o Mercado Pago)

Sem token, o sistema usa provedor **mock** em desenvolvimento (botão "Simular pagamento" na tela do pedido).

### Webhook

No painel [Suas integrações](https://www.mercadopago.com.br/developers/panel/app) → Webhooks, configure:

```
https://seu-dominio.com/api/webhooks/mercadopago
```

Eventos: **Payments**. Copie o segredo gerado para `MERCADOPAGO_WEBHOOK_SECRET`.

Alias legado (mesmo handler): `POST /api/webhooks/pix`

## Deploy (Vercel)

1. Conecte o repositório na [Vercel](https://vercel.com)
2. Crie PostgreSQL no [Neon](https://neon.tech) — `DATABASE_URL` (pooler) + `DIRECT_URL` (direct)
3. Crie **Vercel Blob** no projeto para uploads de imagens
4. Configure `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL` e demais variáveis
5. Após o deploy: `prisma db push` e `npm run db:seed` no banco de produção

Guia detalhado: [`deploy/vercel/DEPLOY-VERCEL.md`](deploy/vercel/DEPLOY-VERCEL.md)

## Estrutura

- `/s/[slug]` — catálogo público (cliente)
- `/admin` — painel do lojista
- `/produtos` — catálogo completo
- `/produtos/[categoria]` — filtro por categoria
- `/carrinho` — revisão do pedido
- `/checkout` — finalização (PIX / cartão / WhatsApp)
- `/api/webhooks/mercadopago` — confirmação de pagamento (PIX e cartão)

### Schema (produção)

Após o deploy desta feature, rode no banco de produção:

```bash
npx prisma db push
```

Isso cria `isPartyFavor` em produtos e as tabelas de campos/opções de personalização.

## Multi-loja (futuro)

O schema usa `storeId` em todas as entidades. Para adicionar lojas, crie novos registros em `stores` e usuários vinculados.
