# Deploy na Vercel (agro_rural)

Repositório: [Dimaroto/agro_rural](https://github.com/Dimaroto/agro_rural)  
Domínio: `https://agroruralzortea.com.br`

## O que você precisa fazer

1. Na Vercel: importar o GitHub `Dimaroto/agro_rural`.
2. **Storage → Neon** (Postgres) e **Storage → Blob** (imagens).
3. DNS do domínio apontando para a Vercel.
4. Após o Neon conectar, no PC (URLs de produção):

```powershell
npm run db:setup:prod
$env:ADMIN_PASSWORD = 'sua-senha'
npm run admin:update:prod
```

O app mapeia sozinho `DATABASE_URL` / `POSTGRES_URL` (pooled) e `DATABASE_URL_UNPOOLED` / `DIRECT_URL` / `POSTGRES_URL_NON_POOLING` (direta), com `sslmode` e `pgbouncer` no pooler.

Build: `node scripts/vercel-build.cjs` · região `gru1`.

## Variáveis que o painel/integração costuma criar

| Variável | Origem |
|----------|--------|
| `DATABASE_URL` | Neon (pooled) |
| `DATABASE_URL_UNPOOLED` | Neon (direct) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob |
| `AUTH_SECRET` | gerar e colar se ainda não existir |
| `NEXT_PUBLIC_APP_URL` | `https://agroruralzortea.com.br` (fallback no código) |

Pagamentos ficam desligados até você definir tokens do Mercado Pago.

Webhook MP: `https://agroruralzortea.com.br/api/webhooks/mercadopago`
