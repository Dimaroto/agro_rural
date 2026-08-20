# Emissor NF-e / NFS-e (Laravel) — AgroRural

Cópia de trabalho de `C:\Flutter\emissor_NFE_NFSE`, embutida no app Windows via Electron sidecar.

## Setup local

```bash
cd services/emissor
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate
```

Coloque o PHP 8.3+ no PATH (ou em `bin/php/php.exe` para o instalador).

## API AgroRural

Com Sanctum autenticado:

- `POST /api/v1/integracoes/agrorural/nfe/emitir`
- `POST /api/v1/integracoes/agrorural/nfce/emitir`
- `POST /api/v1/integracoes/agrorural/nfse/emitir`

Mesmo formato de payload do adaptador Mecânica. Configurações fiscais (certificado A1, CSC, numeração) são preenchidas depois na UI Fiscal do admin.

Porta padrão do sidecar Electron: `http://127.0.0.1:8787`
