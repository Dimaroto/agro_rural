# Integração Mecânica Bedendo

Endpoint dedicado ao app Flutter:

```http
POST /api/v1/integracoes/mecanica/nfe/emitir
Authorization: Bearer {token}
```

O payload simplificado do app é convertido para o formato SEFAZ (impostos, totais, pagamentos) e autorizado de forma síncrona.

Documentação espelhada no app: `mecanica_bedendo/docs/nfe-emissor-api.md`.
