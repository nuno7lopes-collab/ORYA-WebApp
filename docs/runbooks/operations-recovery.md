# Runbook - Operations worker (claim/retry/recovery)

Objetivo: garantir execução idempotente das operações assíncronas (FULFILL, REPROCESS, NOTIFY)
com claim winner-only e recuperação segura após crash.

## Como funciona (SSOT)
- Claim usa `FOR UPDATE SKIP LOCKED` + `locked_at` + `status=RUNNING` (winner-only).
- Em pooler `:6543` (ou `OPERATIONS_SKIP_TX=true`), usa claim sem transação com `UPDATE ... RETURNING`.
- `attempts` incrementa no claim (1 tentativa por execução).
- Operações presas são recuperadas via `/api/internal/reconcile`.

## Sinais de problema
- `operations.failedCount` ou `operations.deadLetterCount` aumenta em `/api/internal/ops/health`.
- `operations` com `status=RUNNING` e `locked_at` muito antigo.
- `operations` com `status=FAILED` sem `next_retry_at` futuro.

## Recuperação rápida
1) Verificar logs do worker (requestId/correlationId).
2) Rodar reconcile (requeue stuck):

```bash
curl -s -X POST \
  -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"minutes":15}' \
  "https://<base>/api/internal/reconcile"
```

3) Forçar execução do worker (cron/loop):
```bash
curl -s -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  "https://<base>/api/cron/operations"
```

## O que NÃO fazer
- Não desbloquear rows manualmente em DB.
- Não alterar `attempts`/`status` sem registo de auditoria.
- Não reprocessar sem verificar idempotência do consumer.
