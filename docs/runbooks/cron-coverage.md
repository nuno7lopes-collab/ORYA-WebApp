# Cron coverage (jobs + endpoints)

Objetivo: inventario dos cron jobs existentes e como validar localmente.

## Tabela de cobertura

job | intervalo (env/default) | endpoint | secret
---|---|---|---
operations | CRON_OPERATIONS_INTERVAL_MS / 1000ms | POST /api/cron/operations | X-ORYA-CRON-SECRET
chat-maintenance | CRON_CHAT_INTERVAL_MS / 60000ms | GET /api/cron/chat/maintenance | X-ORYA-CRON-SECRET
bookings-cleanup | CRON_BOOKINGS_INTERVAL_MS / 60000ms | GET /api/cron/bookings/cleanup | X-ORYA-CRON-SECRET
reservations-cleanup | CRON_RESERVATIONS_INTERVAL_MS / 60000ms | GET /api/cron/reservations/cleanup | X-ORYA-CRON-SECRET
credits-expire | CRON_CREDITS_INTERVAL_MS / 300000ms | GET /api/cron/creditos/expire | X-ORYA-CRON-SECRET
padel-expire | CRON_PADEL_EXPIRE_INTERVAL_MS / 300000ms | POST /api/cron/padel/expire | X-ORYA-CRON-SECRET
padel-reminders | CRON_PADEL_REMINDERS_INTERVAL_MS / 300000ms | POST /api/cron/padel/reminders | X-ORYA-CRON-SECRET
padel-tournament-eve | CRON_PADEL_TOURNAMENT_EVE_INTERVAL_MS / 3600000ms | POST /api/cron/padel/tournament-eve | X-ORYA-CRON-SECRET
payouts-release | CRON_PAYOUTS_INTERVAL_MS / 300000ms | POST /api/cron/payouts/release | X-ORYA-CRON-SECRET
crm-rebuild | CRON_CRM_REBUILD_INTERVAL_MS / 86400000ms | POST /api/cron/crm/rebuild | X-ORYA-CRON-SECRET
crm-campanhas | CRON_CRM_CAMPAIGNS_INTERVAL_MS / 60000ms | POST /api/cron/crm/campanhas | X-ORYA-CRON-SECRET
loyalty-expire | CRON_LOYALTY_EXPIRE_INTERVAL_MS / 86400000ms | POST /api/cron/loyalty/expire | X-ORYA-CRON-SECRET

Previsto (PR C1: analytics-rollup)
job | intervalo (env/default) | endpoint | secret
---|---|---|---
analytics-rollup | CRON_ANALYTICS_INTERVAL_MS / 86400000ms | POST /api/internal/analytics/rollup | X-ORYA-CRON-SECRET

## Como testar local
- Com secret (esperado 200):
```bash
curl -s -X POST \
  -H "X-ORYA-CRON-SECRET: $ORYA_CRON_SECRET" \
  "http://localhost:3000/api/cron/operations"
```

## Expected 401 sem secret
- Sem header (esperado 401):
```bash
curl -s -X POST \
  "http://localhost:3000/api/cron/operations"
```

## Notas
- Todos os endpoints de cron devem falhar sem `X-ORYA-CRON-SECRET`.
- Evitar chamar cron contra producao a partir de ambiente local.
