# Emissor local com Laragon (grátis)

Guia rápido para rodar o emissor NF-e no Windows **sem pagar hospedagem**.

## 1. Instalar o Laragon

1. Baixe: https://laragon.org/download/ (versão **Full**)
   - Ou pelo terminal: `winget install LeNgocKhoa.Laragon`
2. Instale (pode aceitar o caminho padrão `C:\laragon`)
3. Abra o **Laragon**
4. Clique em **Start All** (liga Apache/MySQL se precisar; para este projeto basta o PHP)

## 2. Abrir o terminal do Laragon

No Laragon: menu **Terminal** (ou `Menu → Laragon → Terminal`).

Isso já coloca o `php` e o `composer` no PATH.

## 3. Subir o emissor

```bat
cd emissor_nfe
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

Deixe a janela aberta. A API fica em:

**http://127.0.0.1:8000**

Teste no navegador: http://127.0.0.1:8000/up  
(deve responder OK / status)

## 4. Pegar o token

```powershell
cd emissor_nfe
powershell -ExecutionPolicy Bypass -File scripts\get-token.ps1 -Email "SEU_EMAIL" -Password "SUA_SENHA"
```

(ou defina `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` no `.env`)

Copie o campo `token` / arquivo `.agro_token.txt`.

## 5. No app da mecânica

**Configurações → Fiscal:**

| Campo | Valor |
|-------|--------|
| URL base | `http://127.0.0.1:8000` |
| Token Bearer | (o token do passo 4) |
| ID da empresa | `1` (depois de cadastrar a empresa) |

## 6. Cadastrar empresa + certificado

Ainda precisa:

1. Criar a empresa na API (`POST /api/v1/empresas`)
2. Enviar o certificado A1 (`.pfx`)

Sem o A1 dá para deixar o emissor no ar, mas **não emite** nota na SEFAZ.

## Atalho: script

Depois do Laragon instalado, rode:

```bat
emissor_nfe\scripts\start-local.bat
```

## Problemas comuns

| Problema | Solução |
|----------|---------|
| `php` não reconhecido | Use o **Terminal do Laragon**, não o PowerShell comum |
| Porta 8000 ocupada | `php artisan serve --port=8001` e use essa URL no app |
| App no celular não conecta | Use o IP do PC na Wi‑Fi, ex.: `http://192.168.0.10:8000` |
