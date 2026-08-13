# Deploy do Catálogo SaboArt na HostGator

Este pacote foi gerado com `npm run build:hostgator` e contém um build **standalone** do Next.js pronto para hospedagem **Node.js** na HostGator.

## Requisitos na HostGator

- Plano com **Node.js** no cPanel (Business ou superior, ou VPS)
- **Node.js 20** (recomendado) selecionado no painel
- Domínio ou subdomínio apontando para a pasta do app

> **Importante:** planos compartilhados apenas com PHP **nao** executam este app. E necessario o recurso "Setup Node.js App" no cPanel.

## 1. Enviar arquivos

1. Compacte esta pasta (`dist/hostgator`) em `.zip`
2. No **Gerenciador de Arquivos** do cPanel, envie para um diretorio fora de `public_html` (ex.: `~/catalogo`) ou conforme indicado pelo "Setup Node.js App"
3. Extraia o `.zip` mantendo a estrutura:
   - `server.js` (arquivo de inicializacao)
   - `.next/`
   - `public/`
   - `prisma/`
   - `data/` (banco SQLite — deve ser gravavel)
   - `node_modules/` (ja incluido no standalone)

## 2. Configurar app Node.js no cPanel

1. Abra **Setup Node.js App** (ou **Aplicacao Node.js**)
2. Clique em **Create Application**
3. Preencha:
   - **Node.js version:** 20.x
   - **Application mode:** Production
   - **Application root:** pasta onde extraiu o pacote (ex. `catalogo`)
   - **Application URL:** seu dominio ou subdominio
   - **Application startup file:** `server.js`
4. Em **Environment variables**, adicione as variaveis do arquivo `env.example` (ou crie `.env` na raiz do app)
5. Clique em **Run NPM Install** apenas se o painel exigir (o standalone ja inclui dependencias)

## 3. Variaveis de ambiente obrigatorias

| Variavel | Exemplo |
|----------|---------|
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_APP_URL` | `https://seudominio.com.br` |
| `DATABASE_URL` | `file:./data/catalogo.db` |
| `AUTH_SECRET` | string aleatoria longa |
| `DEFAULT_STORE_SLUG` | `saboart` |
| `NEXT_PUBLIC_DEFAULT_STORE_SLUG` | `saboart` |

## 4. Criar o banco de dados

Pelo **Terminal** do cPanel, na pasta do app:

```bash
cd ~/catalogo
export DATABASE_URL="file:./data/catalogo.db"
npx prisma db push --schema=./prisma/schema.prisma
```

Se voce gerou o pacote com `npm run build:hostgator -- --with-db` e ja veio `data/catalogo.db`, pule o `db push` ou use apenas para atualizar schema.

### Permissoes

```bash
chmod 755 data
chmod 664 data/catalogo.db
chmod -R 775 public/uploads
```

## 5. Iniciar / reiniciar

No painel **Setup Node.js App**, clique em **Restart**.

Teste:
- Loja: `https://seudominio.com.br/`
- Admin: `https://seudominio.com.br/admin/login`

Credenciais padrao do seed: `admin@loja.com` / `admin123` (altere apos o primeiro acesso).

## 6. Atualizacoes futuras

No seu computador:

```bash
npm run build:hostgator
# ou com banco local ja populado:
npm run build:hostgator -- --with-db
```

Envie novamente a pasta `dist/hostgator`, preserve `data/catalogo.db` e `public/uploads/` no servidor.

## Solucao de problemas

| Problema | Acao |
|----------|------|
| Pagina em branco | Verifique logs no cPanel Node.js; confirme `NEXT_PUBLIC_APP_URL` |
| Erro de banco | Confirme `DATABASE_URL` e permissoes da pasta `data/` |
| Imagens nao sobem | Permissao de escrita em `public/uploads/` |
| 502 Bad Gateway | Reinicie o app Node; confira se `server.js` e o startup file |

## Alternativa recomendada

Para deploy mais simples e CI automatico, considere **Vercel** + banco **Neon/Supabase** (PostgreSQL). A HostGator funciona bem com SQLite para uma unica loja de baixo trafego.
