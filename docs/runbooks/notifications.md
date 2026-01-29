# Runbook — Notificacoes (email/push)

Objetivo: garantir entrega de emails e push notifications.

## Email (Resend)
- Envio via `email_outbox` e worker `SEND_EMAIL_OUTBOX`.
- Templates: PURCHASE_CONFIRMED, ENTITLEMENT_DELIVERED, REFUND, IMPORTANT_UPDATE, OWNER_TRANSFER.

### Validacao
```sql
select status, error_code, sent_at from app_v3.email_outbox where purchase_id = '<purchaseId>';
```

## Push (APNS)
- Tokens guardados em `push_device_tokens`.
- Envio via `notification_outbox` e consumer.

### Envs necessarios
- `APNS_TEAM_ID`
- `APNS_KEY_ID`
- `APNS_PRIVATE_KEY_BASE64`
- `APNS_TOPIC`

## Troubleshooting rapido
1) Confirmar envs (Resend/APNS).
2) Verificar outbox status (PENDING/FAILED).
3) Reprocessar worker (`/api/cron/operations`).

## Notas
- Falha no envio nao deve bloquear o fluxo financeiro.
- Registrar requestId/correlationId nos incidentes.
