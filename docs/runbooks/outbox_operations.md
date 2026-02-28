# Runbook: Outbox Operations

## Objetivo
Operar a fila `app_v3.outbox_events` com segurança, sem apagar eventos, e com fallback robusto para `eventType` desconhecido.

## Fluxo normal
1. `publishOutboxBatch` reclama pendentes (`published_at IS NULL` e `dead_lettered_at IS NULL`).
2. Eventos suportados seguem o caminho normal (operation `OUTBOX_EVENT` + worker).
3. Eventos desconhecidos podem ser marcados como dead-letter automaticamente (feature flag).

## Feature flag (rollback de emergência)
- Nome: `OUTBOX_UNKNOWN_DEFAULT_HANDLER_ENABLED`
- Default: `true`
- `true`: evento desconhecido é dead-lettered no publisher (não crasha worker).
- `false`: volta ao comportamento legado (publisher enfileira operação e o worker decide).

Exemplo:
```bash
OUTBOX_UNKNOWN_DEFAULT_HANDLER_ENABLED=false npm run test -- tests/outbox/publisher.test.ts
```

## Verificações rápidas
Pendentes:
```sql
SELECT COUNT(*) AS outbox_pending
FROM app_v3.outbox_events
WHERE published_at IS NULL AND dead_lettered_at IS NULL;
```

Dead-letter:
```sql
SELECT event_id, event_type, reason_code, error_class, dead_lettered_at
FROM app_v3.outbox_events
WHERE dead_lettered_at IS NOT NULL
ORDER BY dead_lettered_at DESC
LIMIT 20;
```

Eventos não suportados:
```sql
SELECT event_id, event_type, reason_code, error_class
FROM app_v3.outbox_events
WHERE reason_code = 'UNKNOWN_EVENT_TYPE'
ORDER BY created_at DESC
LIMIT 20;
```

## Sinais de observabilidade
- Log estruturado: `outbox.unsupported_event.dead_lettered`
- Métrica emitida em log JSON:
  - `kind=outbox_metric`
  - `metric=outbox_event_unsupported_total`

## Política
- Nunca apagar eventos para “limpar” backlog.
- Preferir dead-letter com `reason_code` explícito + evento de auditoria (`event_logs`) quando houver `organizationId` resolvível.
