# Integração Agro Rural ↔ emissor local

```http
POST /api/v1/integracoes/agro/nfe/emitir
Authorization: Bearer {token}
```

O admin web monta o payload a partir do pedido (Prisma) e envia ao emissor em `http://127.0.0.1:8000`.

Campos principais: `pedidoId`, `pedidoNumero`, `referenciaId`, `destinatario`, `itens` (com `ncm`), `modelo` 55 ou 65.
