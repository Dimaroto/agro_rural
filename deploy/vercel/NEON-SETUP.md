# Neon — Postgres na Vercel

1. Projeto Vercel → **Storage → Create Database → Neon** → conectar ao projeto.
2. A Vercel injeta `DATABASE_URL` (pooler) e em geral `DATABASE_URL_UNPOOLED` / `POSTGRES_URL_NON_POOLING`.
3. Schema + seed:

```powershell
npm run db:setup:prod
```

Se o CLI mostrar `[SENSITIVE]`, copie as URLs no painel (Reveal) para o PowerShell:

```powershell
$env:DATABASE_URL = 'postgresql://...-pooler.../neondb?sslmode=require'
$env:DATABASE_URL_UNPOOLED = 'postgresql://.../neondb?sslmode=require'
npm run db:setup:prod
```
