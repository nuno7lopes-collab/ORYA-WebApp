# Runbook - RequestId trace (4xx/5xx)

Objetivo: localizar erros a partir de requestId/correlationId, encontrar logs e decidir replay/rollback seguro.

## 1) Recolher IDs (requestId + correlationId)
- Preferir headers: `x-orya-request-id` e `x-orya-correlation-id`.
- Se nao houver headers, ler do body: `requestId` e `correlationId`.

Exemplo curl (inspecionar headers):
```bash
curl -i -sS https://<base>/api/... | rg -i "x-orya-request-id|x-orya-correlation-id"
```

## 2) Procurar nos logs
- Procurar primeiro por `requestId`.
- Se nao houver, procurar por `correlationId`.
- Em caso de fluxo async/outbox, `correlationId` costuma ser `purchaseId`.

Sugestoes (ajustar ao log backend):
- "requestId=<id>" ou "requestId": "<id>"
- "correlationId=<id>" ou "correlationId": "<id>"

## 3) Classificar o erro
- **Erro transitorio** (timeouts/rede/5xx): pode ser replay seguro.
- **Erro deterministico** (validacao/contrato): corrigir causa antes de replay.
- **Erro de autorizacao** (401/403): validar gates/roles/secret.

## 4) Replay / rollback seguro (quando aplicavel)
- Se o erro foi no fluxo financeiro ou fulfillment, usar endpoints internos:
  - `POST /api/internal/reprocess/payment-intent` com `{ "paymentIntentId": "pi_..." }`
  - `POST /api/internal/reprocess/purchase` com `{ "purchaseId": "pur_..." }`
  - `POST /api/internal/reprocess/stripe-event` com `{ "stripeEventId": "evt_..." }`
  - `POST /api/internal/reconcile` com `{ "minutes": 15 }` (requeue stuck ops)

Exemplo curl (reprocess purchase):
```bash
curl -sS -X POST \
  -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"purchaseId":"pur_..."}' \
  "https://<base>/api/internal/reprocess/purchase"
```

## 5) Checklist de fecho
- [ ] requestId/correlationId registados no ticket
- [ ] causa raiz identificada
- [ ] replay/rollback executado (se aplicavel)
- [ ] verificacao pos-acao (read-models, ops feed, UI)

Notas
- Nunca editar rows de ledger/outbox manualmente.
- Se o mesmo erro voltar, parar e abrir issue com logs + requestId.
