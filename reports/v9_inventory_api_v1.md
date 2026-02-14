# V9 Inventory — API Routes

Total: 649

| Route | File | Methods | Type | Auth | Payloads | Status codes | Runtime | Cache | Envelope | Legacy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /api/address/autocomplete | app/api/address/autocomplete/route.ts | GET | public | none detected | query | 429 | nodejs/default/default | default | withApiEnvelope | - |
| /api/address/details | app/api/address/details/route.ts | GET | public | none detected | query | 400, 404, 429, 502 | nodejs/default/default | default | withApiEnvelope | - |
| /api/address/reverse | app/api/address/reverse/route.ts | GET | public | none detected | query | 400, 404, 429, 502 | nodejs/default/default | default | withApiEnvelope | - |
| /api/admin/audit/list | app/api/admin/audit/list/route.ts | GET | admin | admin | query | 200, 500 | default/default/default | default | withApiEnvelope | - |
| /api/admin/config/platform-email | app/api/admin/config/platform-email/route.ts | GET, POST | admin | admin | json | 200 | default/default/default | default | withApiEnvelope | - |
| /api/admin/data/purge | app/api/admin/data/purge/route.ts | POST | admin | admin | json | 200, 400, 500 | default/default/default | default | withApiEnvelope | - |
| /api/admin/eventos/list | app/api/admin/eventos/list/route.ts | GET | admin | admin | query | 200, 500 | default/default/default | default | withApiEnvelope | - |
| /api/admin/eventos/purge | app/api/admin/eventos/purge/route.ts | POST | admin | admin | json | 200, 400, 404, 409, 500 | default/default/default | default | withApiEnvelope | - |
| /api/admin/eventos/update-status | app/api/admin/eventos/update-status/route.ts | POST | admin | admin | json | 200, 400, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/admin/fees | app/api/admin/fees/route.ts | GET, POST | admin | admin | json | 200, 400, 500 | default/default/default | default | withApiEnvelope | - |
| /api/admin/infra/alerts/status | app/api/admin/infra/alerts/status/route.ts | GET | admin | admin | none detected | 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/admin/infra/cost/summary | app/api/admin/infra/cost/summary/route.ts | GET | admin | admin | query | 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/admin/infra/deploy | app/api/admin/infra/deploy/route.ts | POST | admin | admin | json | 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/admin/infra/hard-pause | app/api/admin/infra/hard-pause/route.ts | POST | admin | admin | json | 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/admin/infra/migrate | app/api/admin/infra/migrate/route.ts | POST | admin | admin | json | 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/admin/infra/mode | app/api/admin/infra/mode/route.ts | POST | admin | admin | json | 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/admin/infra/resume | app/api/admin/infra/resume/route.ts | POST | admin | admin | json | 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/admin/infra/rotate-secrets | app/api/admin/infra/rotate-secrets/route.ts | POST | admin | admin | json | 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/admin/infra/soft-pause | app/api/admin/infra/soft-pause/route.ts | POST | admin | admin | json | 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/admin/infra/start | app/api/admin/infra/start/route.ts | POST | admin | admin | json | 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/admin/infra/status | app/api/admin/infra/status/route.ts | GET | admin | admin | none detected | 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/admin/infra/usage/summary | app/api/admin/infra/usage/summary/route.ts | GET | admin | admin | none detected | 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/admin/mfa/enroll | app/api/admin/mfa/enroll/route.ts | POST | admin | admin | none detected | 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/admin/mfa/reset | app/api/admin/mfa/reset/route.ts | POST | admin | admin | json | 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/admin/mfa/session | app/api/admin/mfa/session/route.ts | GET | admin | admin | none detected | 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/admin/mfa/status | app/api/admin/mfa/status/route.ts | GET | admin | admin | none detected | 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/admin/mfa/verify | app/api/admin/mfa/verify/route.ts | POST | admin | admin | json | 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/admin/ops/analytics-rollups | app/api/admin/ops/analytics-rollups/route.ts | GET, POST | admin | admin | json, query | 400, 403, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/admin/organizacoes/event-log | app/api/admin/organizacoes/event-log/route.ts | GET | admin | admin | query | 400, 500 | default/default/default | default | withApiEnvelope | - |
| /api/admin/organizacoes/list | app/api/admin/organizacoes/list/route.ts | GET | admin | admin | query | 400, 500 | default/default/default | default | withApiEnvelope | - |
| /api/admin/organizacoes/refresh-payments-status | app/api/admin/organizacoes/refresh-payments-status/route.ts | POST | admin | admin | json | 400, 404, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/admin/organizacoes/update-payments-mode | app/api/admin/organizacoes/update-payments-mode/route.ts | POST | admin | admin | json | 400, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/admin/organizacoes/update-status | app/api/admin/organizacoes/update-status/route.ts | POST | admin | admin | json | 200, 400, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/admin/organizacoes/verify-platform-email | app/api/admin/organizacoes/verify-platform-email/route.ts | POST | admin | admin | json | 200 | default/default/default | default | withApiEnvelope | - |
| /api/admin/payments/dispute | app/api/admin/payments/dispute/route.ts | POST | admin | admin | json | 200, 400, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/admin/payments/export | app/api/admin/payments/export/route.ts | GET | admin | admin | query | 200, 500 | default/default/default | default | withApiEnvelope | - |
| /api/admin/payments/list | app/api/admin/payments/list/route.ts | GET | admin | admin | query | 200, 500 | default/default/default | default | withApiEnvelope | - |
| /api/admin/payments/overview | app/api/admin/payments/overview/route.ts | GET | admin | admin | query | 200, 500 | default/default/default | default | withApiEnvelope | - |
| /api/admin/payments/refund | app/api/admin/payments/refund/route.ts | POST | admin | admin | json | 200, 400, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/admin/payments/reprocess | app/api/admin/payments/reprocess/route.ts | POST | admin | admin | json | 200, 400, 500 | default/default/default | default | withApiEnvelope | - |
| /api/admin/refunds/list | app/api/admin/refunds/list/route.ts | GET | admin | admin | query | 200, 500 | default/default/default | default | withApiEnvelope | - |
| /api/admin/refunds/retry | app/api/admin/refunds/retry/route.ts | POST | admin | admin | json | 200, 400, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/admin/tickets/export | app/api/admin/tickets/export/route.ts | GET | admin | admin | query | 200, 500 | default/default/default | default | withApiEnvelope | - |
| /api/admin/tickets/list | app/api/admin/tickets/list/route.ts | GET | admin | admin | query | 200, 500 | default/default/default | default | withApiEnvelope | - |
| /api/admin/utilizadores/manage | app/api/admin/utilizadores/manage/route.ts | POST | admin | admin | formData, json | 400, 500 | default/default/default | default | withApiEnvelope | - |
| /api/auth/apple/link | app/api/auth/apple/link/route.ts | POST | public | user | json | 400, 401, 409, 500 | default/default/default | default | withApiEnvelope | - |
| /api/auth/check-email | app/api/auth/check-email/route.ts | GET, POST | public | none detected | json, query | 200, 400, 403, 429, 500 | default/default/default | default | withApiEnvelope | - |
| /api/auth/clear | app/api/auth/clear/route.ts | POST | public | none detected | none detected | 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/auth/login | app/api/auth/login/route.ts | POST | public | none detected | json | 400, 401, 403, 429, 500, 503 | default/default/default | default | withApiEnvelope | - |
| /api/auth/logout | app/api/auth/logout/route.ts | POST | public | none detected | none detected | 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/auth/me | app/api/auth/me/route.ts | GET | public | user | none detected | 200, 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/auth/password/reset-request | app/api/auth/password/reset-request/route.ts | POST | public | none detected | json, query | 400, 403, 429, 500, 502, 503 | default/default/default | default | withApiEnvelope | - |
| /api/auth/refresh | app/api/auth/refresh/route.ts | POST | public | none detected | json | 400, 403, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/auth/send-otp | app/api/auth/send-otp/route.ts | POST | public | none detected | json | 400, 403, 409, 429, 500, 502, 503 | default/default/default | default | withApiEnvelope | - |
| /api/checkout/resale | app/api/checkout/resale/route.ts | POST | public | none detected | none detected | 403 | default/default/default | default | withApiEnvelope | - |
| /api/checkout/status | app/api/checkout/status/route.ts | GET | public | none detected | query | 200, 400, 500 | default/default/default | default | withApiEnvelope | - |
| /api/cobrancas/[token] | app/api/cobrancas/[token]/route.ts | GET | public | none detected | none detected | 500 | default/default/default | default | withApiEnvelope | - |
| /api/cobrancas/[token]/checkout | app/api/cobrancas/[token]/checkout/route.ts | POST | public | none detected | none detected | unknown | default/default/default | default | withApiEnvelope | - |
| /api/convites/[token] | app/api/convites/[token]/route.ts | GET, POST | public | none detected | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/convites/[token]/checkout | app/api/convites/[token]/checkout/route.ts | POST | public | none detected | json | unknown | nodejs/default/default | default | withApiEnvelope | - |
| /api/crm/engagement | app/api/crm/engagement/route.ts | POST | public | user | json | 200, 400, 401, 404, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/cron/analytics/rollup | app/api/cron/analytics/rollup/route.ts | POST | cron | internal | json | 200, 401, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/cron/bookings/cleanup | app/api/cron/bookings/cleanup/route.ts | GET | cron | internal | none detected | 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/cron/creditos/expire | app/api/cron/creditos/expire/route.ts | GET | cron | internal | none detected | 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/cron/crm/campanhas | app/api/cron/crm/campanhas/route.ts | POST | cron | internal | query | 200, 401, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/cron/crm/rebuild | app/api/cron/crm/rebuild/route.ts | POST | cron | internal | query | 200, 401, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/cron/entitlements/qr-cleanup | app/api/cron/entitlements/qr-cleanup/route.ts | GET | cron | internal | none detected | 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/cron/loyalty/expire | app/api/cron/loyalty/expire/route.ts | POST | cron | internal | none detected | 200, 401, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/cron/operations | app/api/cron/operations/route.ts | POST | cron | internal | none detected | 200, 401, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/cron/padel/expire | app/api/cron/padel/expire/route.ts | POST | cron | internal | none detected | 401, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/cron/padel/matchmaking | app/api/cron/padel/matchmaking/route.ts | POST | cron | internal | none detected | 401, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/cron/padel/partnership-grants/revoke | app/api/cron/padel/partnership-grants/revoke/route.ts | GET, POST | cron | internal | none detected | 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/cron/padel/reminders | app/api/cron/padel/reminders/route.ts | POST | cron | internal | none detected | 200, 401, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/cron/padel/split-reminders | app/api/cron/padel/split-reminders/route.ts | POST | cron | internal | none detected | 200, 401, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/cron/padel/tournament-eve | app/api/cron/padel/tournament-eve/route.ts | POST | cron | internal | none detected | 200, 401, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/cron/padel/waitlist | app/api/cron/padel/waitlist/route.ts | POST | cron | internal | none detected | 401, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/cron/repair-usernames | app/api/cron/repair-usernames/route.ts | POST | cron | internal | query | 200, 401, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/cron/reservations/cleanup | app/api/cron/reservations/cleanup/route.ts | GET | cron | internal | none detected | 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/email/verified | app/api/email/verified/route.ts | POST | public | user | none detected | 400, 401 | default/default/default | default | withApiEnvelope | - |
| /api/eventos/[slug]/invite-token | app/api/eventos/[slug]/invite-token/route.ts | POST | public | none detected | json | 500 | default/default/default | default | withApiEnvelope | - |
| /api/eventos/[slug]/invites/check | app/api/eventos/[slug]/invites/check/route.ts | POST | public | none detected | json | 500 | default/default/default | default | withApiEnvelope | - |
| /api/eventos/[slug]/public | app/api/eventos/[slug]/public/route.ts | GET | public | none detected | none detected | 400, 404 | default/default/default | default | withApiEnvelope | - |
| /api/eventos/[slug]/resales | app/api/eventos/[slug]/resales/route.ts | GET | public | none detected | none detected | 200, 400, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/eventos/list | app/api/eventos/list/route.ts | GET | public | user | query | 200 | default/default/default | default | withApiEnvelope | - |
| /api/eventos/lookup | app/api/eventos/lookup/route.ts | GET | public | user | query | 200, 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/events/favorites | app/api/events/favorites/route.ts | GET | public | user | none detected | 200, 401 | nodejs/default/default | default | withApiEnvelope | - |
| /api/events/favorites/notify | app/api/events/favorites/notify/route.ts | POST | public | user | json | 200, 400, 401 | nodejs/default/default | default | withApiEnvelope | - |
| /api/events/favorites/toggle | app/api/events/favorites/toggle/route.ts | POST | public | user | json | 200, 400, 401, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/explorar/eventos/[slug] | app/api/explorar/eventos/[slug]/route.ts | GET | public | none detected | none detected | 404 | default/default/default | default | withApiEnvelope | - |
| /api/explorar/list | app/api/explorar/list/route.ts | GET | public | user | query | 200, 500 | default/default/default | default | withApiEnvelope | - |
| /api/inscricoes/[id]/submit | app/api/inscricoes/[id]/submit/route.ts | POST | public | user | json | 201, 400, 403, 404, 409, 500 | default/default/default | default | withApiEnvelope | - |
| /api/internal/audit | app/api/internal/audit/route.ts | GET | internal | internal | query | 200, 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/internal/checkin/consume | app/api/internal/checkin/consume/route.ts | POST | internal | internal | json | 401, 429, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/internal/checkout/timeline | app/api/internal/checkout/timeline/route.ts | GET | internal | internal | query | 200, 400, 401 | default/default/default | default | withApiEnvelope | - |
| /api/internal/crm/ingest | app/api/internal/crm/ingest/route.ts | POST | internal | internal | json | 400, 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/internal/crm/rebuild | app/api/internal/crm/rebuild/route.ts | POST | internal | internal | json, query | 400, 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/internal/cron/coverage | app/api/internal/cron/coverage/route.ts | GET | internal | internal | none detected | 200, 401 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/internal/notifications/sweep | app/api/internal/notifications/sweep/route.ts | GET | internal | internal | query | 401 | default/default/default | default | withApiEnvelope | - |
| /api/internal/ops/dashboard | app/api/internal/ops/dashboard/route.ts | GET | internal | internal | none detected | 401 | default/default/default | default | withApiEnvelope | - |
| /api/internal/ops/feed | app/api/internal/ops/feed/route.ts | GET | internal | internal | query | 200, 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/internal/ops/health | app/api/internal/ops/health/route.ts | GET | internal | internal | none detected | 401 | default/default/default | default | withApiEnvelope | - |
| /api/internal/ops/outbox/replay | app/api/internal/ops/outbox/replay/route.ts | POST | internal | internal | json | 200, 401 | default/default/default | default | withApiEnvelope | - |
| /api/internal/ops/outbox/summary | app/api/internal/ops/outbox/summary/route.ts | GET | internal | internal | none detected | 200, 401 | default/default/default | default | withApiEnvelope | - |
| /api/internal/ops/padel/backfill | app/api/internal/ops/padel/backfill/route.ts | POST | internal | internal | query | 200, 401 | default/default/default | default | withApiEnvelope | - |
| /api/internal/ops/padel/cleanup | app/api/internal/ops/padel/cleanup/route.ts | POST | internal | internal | query | 200, 401 | default/default/default | default | withApiEnvelope | - |
| /api/internal/ops/padel/integrity | app/api/internal/ops/padel/integrity/route.ts | GET | internal | internal | query | 200, 400, 401 | default/default/default | default | withApiEnvelope | - |
| /api/internal/ops/slo | app/api/internal/ops/slo/route.ts | GET | internal | internal | none detected | 401 | default/default/default | default | withApiEnvelope | - |
| /api/internal/outbox/dlq | app/api/internal/outbox/dlq/route.ts | GET | internal | internal | query | 401 | default/default/default | default | withApiEnvelope | - |
| /api/internal/outbox/replay | app/api/internal/outbox/replay/route.ts | POST | internal | internal | json | 400, 401, 404 | default/default/default | default | withApiEnvelope | - |
| /api/internal/padel/registrations/backfill | app/api/internal/padel/registrations/backfill/route.ts | POST | internal | internal | json | 401 | default/default/default | default | withApiEnvelope | - |
| /api/internal/ping | app/api/internal/ping/route.ts | GET | internal | internal | none detected | 200, 401 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/internal/public-api/keys | app/api/internal/public-api/keys/route.ts | DELETE, GET, POST | internal | internal | json, query | 400, 401, 403 | default/default/default | default | withApiEnvelope | - |
| /api/internal/reconcile | app/api/internal/reconcile/route.ts | POST | internal | internal | json | 200, 401 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/internal/reprocess/payment-intent | app/api/internal/reprocess/payment-intent/route.ts | POST | internal | internal | json | 200, 400, 401 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/internal/reprocess/purchase | app/api/internal/reprocess/purchase/route.ts | POST | internal | internal | json | 200, 400, 401 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/internal/reprocess/stripe-event | app/api/internal/reprocess/stripe-event/route.ts | POST | internal | internal | json | 200, 400, 401 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/internal/worker/operations | app/api/internal/worker/operations/route.ts | POST | internal | internal | none detected | 200, 401 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/live/events/[slug] | app/api/live/events/[slug]/route.ts | GET | public | user | none detected | 200, 400, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/live/events/[slug]/stream | app/api/live/events/[slug]/stream/route.ts | GET | public | none detected | query | 400, 404 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/livehub/[slug] | app/api/livehub/[slug]/route.ts | GET | public | none detected | none detected | 410 | nodejs/default/default | default | withApiEnvelope | - |
| /api/location/ip | app/api/location/ip/route.ts | GET | public | none detected | none detected | 200, 500 | default/default/default | default | withApiEnvelope | - |
| /api/maps/apple-token | app/api/maps/apple-token/route.ts | GET | public | none detected | none detected | 200, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/me | app/api/me/route.ts | GET | me | user | none detected | 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/agenda | app/api/me/agenda/route.ts | GET | me | user | query | 200, 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/claim-guest | app/api/me/claim-guest/route.ts | POST | me | user | json | 401, 403 | default/default/default | default | withApiEnvelope | - |
| /api/me/consents | app/api/me/consents/route.ts | GET, PUT | me | user | json | 400, 401, 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/contact-phone | app/api/me/contact-phone/route.ts | PATCH | me | user | json | 400, 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/creditos | app/api/me/creditos/route.ts | GET | me | user (expected) - NOT DETECTED | none detected | 410 | default/default/default | default | withApiEnvelope | - |
| /api/me/dsar/export | app/api/me/dsar/export/route.ts | GET | me | user | none detected | 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/events/signals | app/api/me/events/signals/route.ts | POST | me | user | json | 200, 400, 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/inscricoes | app/api/me/inscricoes/route.ts | GET | me | user | none detected | 200, 401 | default/default/default | default | withApiEnvelope | - |
| /api/me/inscricoes/[id] | app/api/me/inscricoes/[id]/route.ts | GET | me | user | none detected | 200, 400, 401, 404 | default/default/default | default | withApiEnvelope | - |
| /api/me/location/consent | app/api/me/location/consent/route.ts | POST | me | user | json | 200, 400, 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/loyalty/carteira | app/api/me/loyalty/carteira/route.ts | GET | me | user | none detected | 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/loyalty/recompensas | app/api/me/loyalty/recompensas/route.ts | GET | me | user | none detected | 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/loyalty/recompensas/[rewardId]/resgatar | app/api/me/loyalty/recompensas/[rewardId]/resgatar/route.ts | POST | me | user | none detected | 400, 401, 403, 404, 409, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/notifications | app/api/me/notifications/route.ts | DELETE | me | user | json | 400, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/notifications/[id]/read | app/api/me/notifications/[id]/read/route.ts | POST | me | user | none detected | 400, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/notifications/feed | app/api/me/notifications/feed/route.ts | GET | me | user | query | 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/notifications/mute | app/api/me/notifications/mute/route.ts | DELETE, POST | me | user | json | 400, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/purchases | app/api/me/purchases/route.ts | GET | me | user | query | 200, 401 | default/default/default | default | withApiEnvelope | - |
| /api/me/purchases/store | app/api/me/purchases/store/route.ts | GET | me | user | query | 401, 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/purchases/store/[orderId] | app/api/me/purchases/store/[orderId]/route.ts | GET | me | user | none detected | 400, 401, 403, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/purchases/store/[orderId]/invoice | app/api/me/purchases/store/[orderId]/invoice/route.ts | GET | me | user | none detected | 200, 400, 401, 403, 404, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/me/purchases/store/[orderId]/receipt | app/api/me/purchases/store/[orderId]/receipt/route.ts | GET | me | user | none detected | 400, 401, 403, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/push-tokens | app/api/me/push-tokens/route.ts | POST | me | user | json | 400, 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/reservas | app/api/me/reservas/route.ts | GET | me | user | none detected | unknown | default/default/default | default | withApiEnvelope | - |
| /api/me/reservas/[id] | app/api/me/reservas/[id]/route.ts | GET | me | user | none detected | 400, 401, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/reservas/[id]/calendar.ics | app/api/me/reservas/[id]/calendar.ics/route.ts | GET | me | user | none detected | 200, 400, 401, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/reservas/[id]/cancel | app/api/me/reservas/[id]/cancel/route.ts | POST | me | user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/me/reservas/[id]/cancel/preview | app/api/me/reservas/[id]/cancel/preview/route.ts | POST | me | user | none detected | unknown | default/default/default | default | withApiEnvelope | - |
| /api/me/reservas/[id]/invites | app/api/me/reservas/[id]/invites/route.ts | GET, POST | me | user | json | 201 | default/default/default | default | withApiEnvelope | - |
| /api/me/reservas/[id]/reschedule | app/api/me/reservas/[id]/reschedule/route.ts | POST | me | user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/me/reservas/[id]/reschedule/respond | app/api/me/reservas/[id]/reschedule/respond/route.ts | POST | me | user | json | 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/me/reservas/[id]/review | app/api/me/reservas/[id]/review/route.ts | POST | me | user | json | 400, 401, 403, 404, 409, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/reservas/[id]/split | app/api/me/reservas/[id]/split/route.ts | GET, POST | me | user | json | 500 | default/default/default | dynamic exported | withApiEnvelope | - |
| /api/me/settings/delete | app/api/me/settings/delete/route.ts | POST | me | user | none detected | 200, 400, 401 | default/default/default | default | withApiEnvelope | - |
| /api/me/settings/delete/cancel | app/api/me/settings/delete/cancel/route.ts | POST | me | user | none detected | 200, 400, 401, 404, 409, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/settings/email | app/api/me/settings/email/route.ts | PATCH | me | user | json | 400, 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/settings/save | app/api/me/settings/save/route.ts | PATCH | me | user | json | 400, 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/wallet | app/api/me/wallet/route.ts | GET | me | admin, user | query | 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/me/wallet/[entitlementId] | app/api/me/wallet/[entitlementId]/route.ts | GET | me | admin, user | none detected | 400, 401, 403, 404 | default/default/default | default | withApiEnvelope | - |
| /api/me/wallet/[entitlementId]/pass | app/api/me/wallet/[entitlementId]/pass/route.ts | GET | me | admin, user | none detected | 400, 401, 403, 404, 500, 501 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/messages/attachments/presign | app/api/messages/attachments/presign/route.ts | POST | me | user (expected) - NOT DETECTED | none detected | unknown | nodejs/default/default | default | unknown | - |
| /api/messages/blocks | app/api/messages/blocks/route.ts | DELETE, POST | me | user (expected) - NOT DETECTED | none detected | unknown | nodejs/default/default | default | unknown | - |
| /api/messages/conversations | app/api/messages/conversations/route.ts | GET, POST | me | user (expected) - NOT DETECTED | none detected | 400 | nodejs/default/default | default | jsonWrap | - |
| /api/messages/conversations/[conversationId] | app/api/messages/conversations/[conversationId]/route.ts | PATCH | me | user (expected) - NOT DETECTED | none detected | 403 | nodejs/default/default | default | jsonWrap | - |
| /api/messages/conversations/[conversationId]/leave | app/api/messages/conversations/[conversationId]/leave/route.ts | POST | me | user (expected) - NOT DETECTED | none detected | 403 | nodejs/default/default | default | jsonWrap | - |
| /api/messages/conversations/[conversationId]/messages | app/api/messages/conversations/[conversationId]/messages/route.ts | GET, POST | me | user (expected) - NOT DETECTED | json | unknown | nodejs/default/default | default | unknown | - |
| /api/messages/conversations/[conversationId]/messages/[messageId] | app/api/messages/conversations/[conversationId]/messages/[messageId]/route.ts | DELETE | me | user (expected) - NOT DETECTED | none detected | unknown | nodejs/default/default | default | unknown | - |
| /api/messages/conversations/[conversationId]/notifications | app/api/messages/conversations/[conversationId]/notifications/route.ts | PATCH | me | user (expected) - NOT DETECTED | none detected | unknown | nodejs/default/default | default | unknown | - |
| /api/messages/conversations/[conversationId]/read | app/api/messages/conversations/[conversationId]/read/route.ts | POST | me | user (expected) - NOT DETECTED | none detected | unknown | nodejs/default/default | default | unknown | - |
| /api/messages/conversations/[conversationId]/threads/[messageId] | app/api/messages/conversations/[conversationId]/threads/[messageId]/route.ts | GET | me | user (expected) - NOT DETECTED | none detected | unknown | nodejs/default/default | default | unknown | - |
| /api/messages/conversations/resolve | app/api/messages/conversations/resolve/route.ts | POST | me | admin, org, user | json | 201, 202, 400, 401, 403, 404, 500, 503 | nodejs/default/default | default | jsonWrap | - |
| /api/messages/grants | app/api/messages/grants/route.ts | GET | me | org, user | query | 401, 500 | nodejs/default/default | default | jsonWrap | - |
| /api/messages/grants/[grantId]/accept | app/api/messages/grants/[grantId]/accept/route.ts | POST | me | org, user | none detected | 400, 401, 403, 404, 409, 410, 500, 503 | nodejs/default/default | default | jsonWrap | - |
| /api/messages/grants/[grantId]/cancel | app/api/messages/grants/[grantId]/cancel/route.ts | POST | me | user | none detected | 400, 401, 403, 404, 409, 500 | nodejs/default/default | default | jsonWrap | - |
| /api/messages/grants/[grantId]/decline | app/api/messages/grants/[grantId]/decline/route.ts | POST | me | org, user | none detected | 400, 401, 403, 404, 409, 500 | nodejs/default/default | default | jsonWrap | - |
| /api/messages/messages | app/api/messages/messages/route.ts | POST | me | user (expected) - NOT DETECTED | json | unknown | nodejs/default/default | default | unknown | - |
| /api/messages/messages/[messageId] | app/api/messages/messages/[messageId]/route.ts | DELETE, PATCH | me | user (expected) - NOT DETECTED | none detected | unknown | nodejs/default/default | default | unknown | - |
| /api/messages/messages/[messageId]/pins | app/api/messages/messages/[messageId]/pins/route.ts | DELETE, POST | me | user (expected) - NOT DETECTED | none detected | unknown | nodejs/default/default | default | unknown | - |
| /api/messages/messages/[messageId]/reactions | app/api/messages/messages/[messageId]/reactions/route.ts | DELETE, POST | me | user (expected) - NOT DETECTED | none detected | unknown | nodejs/default/default | default | unknown | - |
| /api/messages/messages/[messageId]/report | app/api/messages/messages/[messageId]/report/route.ts | POST | me | user (expected) - NOT DETECTED | none detected | unknown | nodejs/default/default | default | unknown | - |
| /api/messages/search | app/api/messages/search/route.ts | GET | me | user (expected) - NOT DETECTED | none detected | unknown | nodejs/default/default | default | unknown | - |
| /api/notifications/mark-click | app/api/notifications/mark-click/route.ts | POST | public | user | json | 400, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/notifications/mark-read | app/api/notifications/mark-read/route.ts | POST | public | user | json | 400, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/notifications/prefs | app/api/notifications/prefs/route.ts | GET, POST | public | user | json | 401 | default/default/default | default | withApiEnvelope | - |
| /api/org-hub | app/api/org-hub/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org-hub/become | app/api/org-hub/become/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org-hub/invites | app/api/org-hub/invites/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org-hub/organizations | app/api/org-hub/organizations/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org-hub/organizations/[id] | app/api/org-hub/organizations/[id]/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org-hub/organizations/leave | app/api/org-hub/organizations/leave/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org-hub/organizations/members | app/api/org-hub/organizations/members/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org-hub/organizations/members/invites | app/api/org-hub/organizations/members/invites/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org-hub/organizations/members/permissions | app/api/org-hub/organizations/members/permissions/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org-hub/organizations/owner/confirm | app/api/org-hub/organizations/owner/confirm/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org-hub/organizations/owner/transfer | app/api/org-hub/organizations/owner/transfer/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org-hub/organizations/settings/official-email | app/api/org-hub/organizations/settings/official-email/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org-hub/organizations/settings/official-email/confirm | app/api/org-hub/organizations/settings/official-email/confirm/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org-hub/organizations/switch | app/api/org-hub/organizations/switch/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org-system/payouts/webhook | app/api/org-system/payouts/webhook/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId] | app/api/org/[orgId]/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/agenda | app/api/org/[orgId]/agenda/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/agenda/soft-blocks | app/api/org/[orgId]/agenda/soft-blocks/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/analytics/buyers | app/api/org/[orgId]/analytics/buyers/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/analytics/dimensoes | app/api/org/[orgId]/analytics/dimensoes/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/analytics/overview | app/api/org/[orgId]/analytics/overview/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/analytics/time-series | app/api/org/[orgId]/analytics/time-series/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/audit | app/api/org/[orgId]/audit/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/avaliacoes | app/api/org/[orgId]/avaliacoes/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/checkin | app/api/org/[orgId]/checkin/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/checkin/preview | app/api/org/[orgId]/checkin/preview/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/club/finance/overview | app/api/org/[orgId]/club/finance/overview/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/consentimentos | app/api/org/[orgId]/consentimentos/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/consentimentos/[userId] | app/api/org/[orgId]/consentimentos/[userId]/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/crm/campanhas | app/api/org/[orgId]/crm/campanhas/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/crm/campanhas/[campaignId] | app/api/org/[orgId]/crm/campanhas/[campaignId]/route.ts | PATCH | public | none detected | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/crm/campanhas/[campaignId]/approve | app/api/org/[orgId]/crm/campanhas/[campaignId]/approve/route.ts | POST | public | none detected | none detected | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/crm/campanhas/[campaignId]/cancel | app/api/org/[orgId]/crm/campanhas/[campaignId]/cancel/route.ts | POST | public | none detected | none detected | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/crm/campanhas/[campaignId]/enviar | app/api/org/[orgId]/crm/campanhas/[campaignId]/enviar/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/crm/campanhas/[campaignId]/reject | app/api/org/[orgId]/crm/campanhas/[campaignId]/reject/route.ts | POST | public | none detected | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/crm/campanhas/[campaignId]/submit | app/api/org/[orgId]/crm/campanhas/[campaignId]/submit/route.ts | POST | public | none detected | none detected | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/crm/clientes | app/api/org/[orgId]/crm/clientes/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/crm/clientes/[customerId] | app/api/org/[orgId]/crm/clientes/[customerId]/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/crm/clientes/[customerId]/notas | app/api/org/[orgId]/crm/clientes/[customerId]/notas/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/crm/clientes/[customerId]/tags | app/api/org/[orgId]/crm/clientes/[customerId]/tags/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/crm/config | app/api/org/[orgId]/crm/config/route.ts | GET, PUT | public | none detected | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/crm/journeys | app/api/org/[orgId]/crm/journeys/route.ts | GET, POST | public | none detected | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/crm/journeys/[id] | app/api/org/[orgId]/crm/journeys/[id]/route.ts | GET, PATCH | public | none detected | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/crm/journeys/[id]/pause | app/api/org/[orgId]/crm/journeys/[id]/pause/route.ts | POST | public | none detected | none detected | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/crm/journeys/[id]/publish | app/api/org/[orgId]/crm/journeys/[id]/publish/route.ts | POST | public | none detected | none detected | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/crm/relatorios | app/api/org/[orgId]/crm/relatorios/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/crm/saved-views | app/api/org/[orgId]/crm/saved-views/route.ts | GET, POST | public | none detected | json, query | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/crm/saved-views/[id] | app/api/org/[orgId]/crm/saved-views/[id]/route.ts | DELETE, PATCH | public | none detected | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/crm/segmentos | app/api/org/[orgId]/crm/segmentos/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/crm/segmentos/[segmentId] | app/api/org/[orgId]/crm/segmentos/[segmentId]/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/crm/segmentos/[segmentId]/preview | app/api/org/[orgId]/crm/segmentos/[segmentId]/preview/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/events/[id]/attendees | app/api/org/[orgId]/events/[id]/attendees/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/events/[id]/invite-token | app/api/org/[orgId]/events/[id]/invite-token/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/events/[id]/invites | app/api/org/[orgId]/events/[id]/invites/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/events/[id]/refund | app/api/org/[orgId]/events/[id]/refund/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/events/create | app/api/org/[orgId]/events/create/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/events/list | app/api/org/[orgId]/events/list/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/events/summary | app/api/org/[orgId]/events/summary/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/events/update | app/api/org/[orgId]/events/update/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/faturacao | app/api/org/[orgId]/faturacao/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/finance/exports/fees | app/api/org/[orgId]/finance/exports/fees/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/finance/exports/ledger | app/api/org/[orgId]/finance/exports/ledger/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/finance/exports/payouts | app/api/org/[orgId]/finance/exports/payouts/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/finance/invoicing | app/api/org/[orgId]/finance/invoicing/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/finance/overview | app/api/org/[orgId]/finance/overview/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/finance/reconciliation | app/api/org/[orgId]/finance/reconciliation/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/inscricoes | app/api/org/[orgId]/inscricoes/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/inscricoes/[id] | app/api/org/[orgId]/inscricoes/[id]/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/inscricoes/[id]/export | app/api/org/[orgId]/inscricoes/[id]/export/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/inscricoes/[id]/submissions | app/api/org/[orgId]/inscricoes/[id]/submissions/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/inscricoes/[id]/summary | app/api/org/[orgId]/inscricoes/[id]/summary/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/loyalty/programa | app/api/org/[orgId]/loyalty/programa/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/loyalty/recompensas | app/api/org/[orgId]/loyalty/recompensas/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/loyalty/regras | app/api/org/[orgId]/loyalty/regras/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/marketing/overview | app/api/org/[orgId]/marketing/overview/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/me | app/api/org/[orgId]/me/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/ops/feed | app/api/org/[orgId]/ops/feed/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/padel/analytics | app/api/org/[orgId]/padel/analytics/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/padel/audit | app/api/org/[orgId]/padel/audit/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/padel/broadcast | app/api/org/[orgId]/padel/broadcast/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/padel/courts | app/api/org/[orgId]/padel/courts/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/padel/exports/analytics | app/api/org/[orgId]/padel/exports/analytics/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/padel/exports/bracket | app/api/org/[orgId]/padel/exports/bracket/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/padel/exports/calendario | app/api/org/[orgId]/padel/exports/calendario/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/padel/exports/inscritos | app/api/org/[orgId]/padel/exports/inscritos/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/padel/exports/resultados | app/api/org/[orgId]/padel/exports/resultados/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/padel/imports/inscritos | app/api/org/[orgId]/padel/imports/inscritos/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/padel/pairings/swap | app/api/org/[orgId]/padel/pairings/swap/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/padel/waitlist | app/api/org/[orgId]/padel/waitlist/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/padel/waitlist/promote | app/api/org/[orgId]/padel/waitlist/promote/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/pagamentos/invoices | app/api/org/[orgId]/pagamentos/invoices/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/payouts/connect | app/api/org/[orgId]/payouts/connect/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/payouts/list | app/api/org/[orgId]/payouts/list/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/payouts/settings | app/api/org/[orgId]/payouts/settings/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/payouts/status | app/api/org/[orgId]/payouts/status/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/payouts/summary | app/api/org/[orgId]/payouts/summary/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/policies | app/api/org/[orgId]/policies/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/policies/[id] | app/api/org/[orgId]/policies/[id]/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/promo | app/api/org/[orgId]/promo/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/promo/[id] | app/api/org/[orgId]/promo/[id]/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/refunds/list | app/api/org/[orgId]/refunds/list/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/reservas | app/api/org/[orgId]/reservas/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/reservas/[id]/cancel | app/api/org/[orgId]/reservas/[id]/cancel/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/reservas/[id]/charges | app/api/org/[orgId]/reservas/[id]/charges/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/reservas/[id]/checkout | app/api/org/[orgId]/reservas/[id]/checkout/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/reservas/[id]/invites | app/api/org/[orgId]/reservas/[id]/invites/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/reservas/[id]/no-show | app/api/org/[orgId]/reservas/[id]/no-show/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/reservas/[id]/participants | app/api/org/[orgId]/reservas/[id]/participants/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/reservas/[id]/reschedule | app/api/org/[orgId]/reservas/[id]/reschedule/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/reservas/[id]/split | app/api/org/[orgId]/reservas/[id]/split/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/reservas/clientes | app/api/org/[orgId]/reservas/clientes/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/reservas/delays | app/api/org/[orgId]/reservas/delays/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/reservas/disponibilidade | app/api/org/[orgId]/reservas/disponibilidade/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/reservas/disponibilidade/[overrideId] | app/api/org/[orgId]/reservas/disponibilidade/[overrideId]/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/reservas/profissionais | app/api/org/[orgId]/reservas/profissionais/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/reservas/profissionais/[id] | app/api/org/[orgId]/reservas/profissionais/[id]/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/reservas/recursos | app/api/org/[orgId]/reservas/recursos/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/reservas/recursos/[id] | app/api/org/[orgId]/reservas/recursos/[id]/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/reservas/summary | app/api/org/[orgId]/reservas/summary/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/servicos | app/api/org/[orgId]/servicos/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/servicos/[id] | app/api/org/[orgId]/servicos/[id]/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/servicos/[id]/addons | app/api/org/[orgId]/servicos/[id]/addons/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/servicos/[id]/addons/[addonId] | app/api/org/[orgId]/servicos/[id]/addons/[addonId]/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/servicos/[id]/class-series | app/api/org/[orgId]/servicos/[id]/class-series/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/servicos/[id]/class-series/[seriesId] | app/api/org/[orgId]/servicos/[id]/class-series/[seriesId]/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/servicos/[id]/class-sessions | app/api/org/[orgId]/servicos/[id]/class-sessions/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/servicos/[id]/disponibilidade | app/api/org/[orgId]/servicos/[id]/disponibilidade/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/servicos/[id]/disponibilidade/[availabilityId] | app/api/org/[orgId]/servicos/[id]/disponibilidade/[availabilityId]/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/servicos/[id]/packages | app/api/org/[orgId]/servicos/[id]/packages/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/servicos/[id]/packages/[packageId] | app/api/org/[orgId]/servicos/[id]/packages/[packageId]/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/servicos/[id]/packs | app/api/org/[orgId]/servicos/[id]/packs/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/servicos/[id]/packs/[packId] | app/api/org/[orgId]/servicos/[id]/packs/[packId]/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/store | app/api/org/[orgId]/store/route.ts | GET, PATCH, POST | public | org, orgEmail, user | json | 201, 409 | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/bundles | app/api/org/[orgId]/store/bundles/route.ts | GET, POST | public | org, user | json | 201 | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/bundles/[id] | app/api/org/[orgId]/store/bundles/[id]/route.ts | DELETE, PATCH | public | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/bundles/[id]/items | app/api/org/[orgId]/store/bundles/[id]/items/route.ts | GET, POST | public | org, user | json | 201 | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/bundles/[id]/items/[itemId] | app/api/org/[orgId]/store/bundles/[id]/items/[itemId]/route.ts | DELETE, PATCH | public | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/categories | app/api/org/[orgId]/store/categories/route.ts | GET, POST | public | org, user | json | 201 | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/categories/[id] | app/api/org/[orgId]/store/categories/[id]/route.ts | DELETE, PATCH | public | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/orders | app/api/org/[orgId]/store/orders/route.ts | GET | public | org, user | query | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/orders/[orderId] | app/api/org/[orgId]/store/orders/[orderId]/route.ts | GET, PATCH | public | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/orders/[orderId]/shipments | app/api/org/[orgId]/store/orders/[orderId]/shipments/route.ts | POST | public | org, user | json | 201 | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/overview | app/api/org/[orgId]/store/overview/route.ts | GET | public | org, user | none detected | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/preview | app/api/org/[orgId]/store/preview/route.ts | GET | public | org, user | none detected | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/products | app/api/org/[orgId]/store/products/route.ts | GET, POST | public | org, user | json | 201 | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/products/[id] | app/api/org/[orgId]/store/products/[id]/route.ts | DELETE, PATCH | public | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/products/[id]/digital-assets | app/api/org/[orgId]/store/products/[id]/digital-assets/route.ts | GET, POST | public | org, user | formData | 201 | nodejs/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/products/[id]/digital-assets/[assetId] | app/api/org/[orgId]/store/products/[id]/digital-assets/[assetId]/route.ts | DELETE, PATCH | public | org, user | json | unknown | nodejs/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/products/[id]/images | app/api/org/[orgId]/store/products/[id]/images/route.ts | GET, POST | public | org, user | json | 201 | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/products/[id]/images/[imageId] | app/api/org/[orgId]/store/products/[id]/images/[imageId]/route.ts | DELETE, PATCH | public | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/products/[id]/options | app/api/org/[orgId]/store/products/[id]/options/route.ts | GET, POST | public | org, user | json | 201 | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/products/[id]/options/[optionId] | app/api/org/[orgId]/store/products/[id]/options/[optionId]/route.ts | DELETE, PATCH | public | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/products/[id]/options/[optionId]/values | app/api/org/[orgId]/store/products/[id]/options/[optionId]/values/route.ts | GET, POST | public | org, user | json | 201 | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/products/[id]/options/[optionId]/values/[valueId] | app/api/org/[orgId]/store/products/[id]/options/[optionId]/values/[valueId]/route.ts | DELETE, PATCH | public | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/products/[id]/variants | app/api/org/[orgId]/store/products/[id]/variants/route.ts | GET, POST | public | org, user | json | 201 | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/products/[id]/variants/[variantId] | app/api/org/[orgId]/store/products/[id]/variants/[variantId]/route.ts | DELETE, PATCH | public | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/settings | app/api/org/[orgId]/store/settings/route.ts | GET, PATCH | public | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/shipments/[shipmentId] | app/api/org/[orgId]/store/shipments/[shipmentId]/route.ts | DELETE, PATCH | public | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/shipping/methods/[methodId] | app/api/org/[orgId]/store/shipping/methods/[methodId]/route.ts | DELETE, GET, PATCH | public | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/shipping/methods/[methodId]/tiers | app/api/org/[orgId]/store/shipping/methods/[methodId]/tiers/route.ts | GET, POST | public | org, user | json | 201 | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/shipping/settings | app/api/org/[orgId]/store/shipping/settings/route.ts | GET, PATCH | public | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/shipping/tiers/[tierId] | app/api/org/[orgId]/store/shipping/tiers/[tierId]/route.ts | DELETE, GET, PATCH | public | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/shipping/zones | app/api/org/[orgId]/store/shipping/zones/route.ts | GET, POST | public | org, user | json | 201 | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/shipping/zones/[zoneId] | app/api/org/[orgId]/store/shipping/zones/[zoneId]/route.ts | DELETE, GET, PATCH | public | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/store/shipping/zones/[zoneId]/methods | app/api/org/[orgId]/store/shipping/zones/[zoneId]/methods/route.ts | GET, POST | public | org, user | json | 201 | default/default/default | default | withApiEnvelope | - |
| /api/org/[orgId]/trainers | app/api/org/[orgId]/trainers/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/trainers/profile | app/api/org/[orgId]/trainers/profile/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/username | app/api/org/[orgId]/username/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/org/[orgId]/venues/recent | app/api/org/[orgId]/venues/recent/route.ts | unknown | public | none detected | none detected | unknown | default/default/default | default | unknown | - |
| /api/organizacao/agenda | app/api/organizacao/agenda/route.ts | GET | organizacao | org, user | query | 200, 400, 403, 404 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/agenda/soft-blocks | app/api/organizacao/agenda/soft-blocks/route.ts | DELETE, PATCH, POST | organizacao | org, orgEmail, user | json | 200, 201, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/analytics/buyers | app/api/organizacao/analytics/buyers/route.ts | GET | organizacao | org, user | query | 200, 400, 401, 403, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/analytics/dimensoes | app/api/organizacao/analytics/dimensoes/route.ts | GET | organizacao | org, user | query | 400, 401, 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/analytics/overview | app/api/organizacao/analytics/overview/route.ts | GET | organizacao | org, user | query | 200, 401, 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/analytics/time-series | app/api/organizacao/analytics/time-series/route.ts | GET | organizacao | org, user | query | 400, 401, 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/audit | app/api/organizacao/audit/route.ts | GET | organizacao | org, user | query | 200, 401, 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/avaliacoes | app/api/organizacao/avaliacoes/route.ts | GET | organizacao | org, user | query | 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/become | app/api/organizacao/become/route.ts | DELETE, GET, POST | organizacao | org, user | formData, json | 200, 400, 401, 403, 409, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/checkin | app/api/organizacao/checkin/route.ts | POST | organizacao | admin, org, orgEmail, user | json | 200, 403, 429 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/checkin/preview | app/api/organizacao/checkin/preview/route.ts | POST | organizacao | admin, org, orgEmail, user | json | 200, 403, 429 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/club/finance/overview | app/api/organizacao/club/finance/overview/route.ts | GET | organizacao | org, user | none detected | 401, 403, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/organizacao/consentimentos | app/api/organizacao/consentimentos/route.ts | GET | organizacao | org, user | query | 401, 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/consentimentos/[userId] | app/api/organizacao/consentimentos/[userId]/route.ts | PUT | organizacao | org, orgEmail, user | json | 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/crm/campanhas | app/api/organizacao/crm/campanhas/route.ts | GET, POST | organizacao | org, orgEmail, user | json | 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/crm/campanhas/[campaignId] | app/api/organizacao/crm/campanhas/[campaignId]/route.ts | unknown | organizacao | user+org (expected) - NOT DETECTED | none detected | unknown | default/default/default | default | unknown | - |
| /api/organizacao/crm/campanhas/[campaignId]/approve | app/api/organizacao/crm/campanhas/[campaignId]/approve/route.ts | unknown | organizacao | user+org (expected) - NOT DETECTED | none detected | unknown | default/default/default | default | unknown | - |
| /api/organizacao/crm/campanhas/[campaignId]/cancel | app/api/organizacao/crm/campanhas/[campaignId]/cancel/route.ts | unknown | organizacao | user+org (expected) - NOT DETECTED | none detected | unknown | default/default/default | default | unknown | - |
| /api/organizacao/crm/campanhas/[campaignId]/enviar | app/api/organizacao/crm/campanhas/[campaignId]/enviar/route.ts | POST | organizacao | org, orgEmail, user | none detected | 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/crm/campanhas/[campaignId]/reject | app/api/organizacao/crm/campanhas/[campaignId]/reject/route.ts | unknown | organizacao | user+org (expected) - NOT DETECTED | none detected | unknown | default/default/default | default | unknown | - |
| /api/organizacao/crm/campanhas/[campaignId]/submit | app/api/organizacao/crm/campanhas/[campaignId]/submit/route.ts | unknown | organizacao | user+org (expected) - NOT DETECTED | none detected | unknown | default/default/default | default | unknown | - |
| /api/organizacao/crm/clientes | app/api/organizacao/crm/clientes/route.ts | GET | organizacao | org, user | query | 401, 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/crm/clientes/[customerId] | app/api/organizacao/crm/clientes/[customerId]/route.ts | GET | organizacao | org, user | none detected | 401, 403, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/crm/clientes/[customerId]/notas | app/api/organizacao/crm/clientes/[customerId]/notas/route.ts | POST | organizacao | org, orgEmail, user | json | 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/crm/clientes/[customerId]/tags | app/api/organizacao/crm/clientes/[customerId]/tags/route.ts | PUT | organizacao | org, orgEmail, user | json | 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/crm/config | app/api/organizacao/crm/config/route.ts | unknown | organizacao | user+org (expected) - NOT DETECTED | none detected | unknown | default/default/default | default | unknown | - |
| /api/organizacao/crm/journeys | app/api/organizacao/crm/journeys/route.ts | unknown | organizacao | user+org (expected) - NOT DETECTED | none detected | unknown | default/default/default | default | unknown | - |
| /api/organizacao/crm/journeys/[id] | app/api/organizacao/crm/journeys/[id]/route.ts | unknown | organizacao | user+org (expected) - NOT DETECTED | none detected | unknown | default/default/default | default | unknown | - |
| /api/organizacao/crm/journeys/[id]/pause | app/api/organizacao/crm/journeys/[id]/pause/route.ts | unknown | organizacao | user+org (expected) - NOT DETECTED | none detected | unknown | default/default/default | default | unknown | - |
| /api/organizacao/crm/journeys/[id]/publish | app/api/organizacao/crm/journeys/[id]/publish/route.ts | unknown | organizacao | user+org (expected) - NOT DETECTED | none detected | unknown | default/default/default | default | unknown | - |
| /api/organizacao/crm/relatorios | app/api/organizacao/crm/relatorios/route.ts | GET | organizacao | org, user | none detected | 401, 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/crm/saved-views | app/api/organizacao/crm/saved-views/route.ts | unknown | organizacao | user+org (expected) - NOT DETECTED | none detected | unknown | default/default/default | default | unknown | - |
| /api/organizacao/crm/saved-views/[id] | app/api/organizacao/crm/saved-views/[id]/route.ts | unknown | organizacao | user+org (expected) - NOT DETECTED | none detected | unknown | default/default/default | default | unknown | - |
| /api/organizacao/crm/segmentos | app/api/organizacao/crm/segmentos/route.ts | GET, POST | organizacao | org, orgEmail, user | json | 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/crm/segmentos/[segmentId] | app/api/organizacao/crm/segmentos/[segmentId]/route.ts | GET | organizacao | org, user | none detected | 401, 403, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/crm/segmentos/[segmentId]/preview | app/api/organizacao/crm/segmentos/[segmentId]/preview/route.ts | GET | organizacao | org, user | none detected | 401, 403, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/events/[id]/attendees | app/api/organizacao/events/[id]/attendees/route.ts | GET | organizacao | admin, org, user | query | 400, 401, 403, 404 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/events/[id]/invite-token | app/api/organizacao/events/[id]/invite-token/route.ts | POST | organizacao | org, orgEmail, user | json | 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/events/[id]/invites | app/api/organizacao/events/[id]/invites/route.ts | DELETE, GET, POST | organizacao | admin, org, orgEmail, user | json, query | 403, 404 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/events/[id]/refund | app/api/organizacao/events/[id]/refund/route.ts | POST | organizacao | org, orgEmail, user | json | 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/events/create | app/api/organizacao/events/create/route.ts | POST | organizacao | admin, org, orgEmail, user | json | 201, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/events/list | app/api/organizacao/events/list/route.ts | GET | organizacao | org, user | query | 200, 401, 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/events/summary | app/api/organizacao/events/summary/route.ts | GET | organizacao | org, user | query | 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/events/update | app/api/organizacao/events/update/route.ts | POST | organizacao | admin, org, orgEmail, user | json | 200, 400, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/faturacao | app/api/organizacao/faturacao/route.ts | GET | organizacao | org, user | none detected | 200, 401, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/finance/exports/fees | app/api/organizacao/finance/exports/fees/route.ts | GET | organizacao | org, user | query | 200, 403 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/organizacao/finance/exports/ledger | app/api/organizacao/finance/exports/ledger/route.ts | GET | organizacao | org, user | query | 200, 403 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/organizacao/finance/exports/payouts | app/api/organizacao/finance/exports/payouts/route.ts | GET | organizacao | org, user | query | 200, 403 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/organizacao/finance/invoicing | app/api/organizacao/finance/invoicing/route.ts | GET, POST | organizacao | org, orgEmail, user | json | 200, 401, 403 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/organizacao/finance/overview | app/api/organizacao/finance/overview/route.ts | GET | organizacao | org, user | query | 200, 401, 403, 500, 503 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/finance/reconciliation | app/api/organizacao/finance/reconciliation/route.ts | GET | organizacao | org, user | none detected | 200, 401, 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/inscricoes | app/api/organizacao/inscricoes/route.ts | GET, POST | organizacao | org, orgEmail, user | json | 200, 201, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/inscricoes/[id] | app/api/organizacao/inscricoes/[id]/route.ts | DELETE, GET, PATCH | organizacao | org, orgEmail, user | json | 200, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/inscricoes/[id]/export | app/api/organizacao/inscricoes/[id]/export/route.ts | GET | organizacao | org, user | none detected | 200, 400, 403, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/inscricoes/[id]/submissions | app/api/organizacao/inscricoes/[id]/submissions/route.ts | GET, PATCH | organizacao | org, orgEmail, user | json, query | 200, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/inscricoes/[id]/summary | app/api/organizacao/inscricoes/[id]/summary/route.ts | GET | organizacao | org, user | none detected | 200, 400, 403, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/invites | app/api/organizacao/invites/route.ts | GET | organizacao | user | query | 200, 401, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/loyalty/programa | app/api/organizacao/loyalty/programa/route.ts | GET, PUT | organizacao | org, orgEmail, user | json | 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/loyalty/recompensas | app/api/organizacao/loyalty/recompensas/route.ts | GET, POST | organizacao | org, orgEmail, user | json | 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/loyalty/regras | app/api/organizacao/loyalty/regras/route.ts | GET, POST | organizacao | org, orgEmail, user | json | 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/marketing/overview | app/api/organizacao/marketing/overview/route.ts | GET | organizacao | org, user | query | 200, 401, 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/me | app/api/organizacao/me/route.ts | GET, PATCH | organizacao | admin, org, orgEmail, user | json | 200, 401, 403, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/ops/feed | app/api/organizacao/ops/feed/route.ts | GET | organizacao | org, user | query | 400, 401, 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/organizations | app/api/organizacao/organizations/route.ts | GET, POST | organizacao | org, user | json | 200, 201, 400, 409, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/organizations/[id] | app/api/organizacao/organizations/[id]/route.ts | DELETE | organizacao | org, orgEmail, user | none detected | 200, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/organizations/leave | app/api/organizacao/organizations/leave/route.ts | POST | organizacao | org, user | json | 200 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/organizations/members | app/api/organizacao/organizations/members/route.ts | DELETE, GET, PATCH | organizacao | org, orgEmail, user | json, query | 200, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/organizations/members/invites | app/api/organizacao/organizations/members/invites/route.ts | GET, PATCH, POST | organizacao | org, orgEmail, user | json, query | 200, 201, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/organizations/members/permissions | app/api/organizacao/organizations/members/permissions/route.ts | GET, PATCH | organizacao | org, orgEmail, user | json | 200, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/organizations/owner/confirm | app/api/organizacao/organizations/owner/confirm/route.ts | POST | organizacao | org, orgEmail, user | json | 200, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/organizations/owner/transfer | app/api/organizacao/organizations/owner/transfer/route.ts | POST | organizacao | org, orgEmail, user | json | 200, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/organizations/settings/official-email | app/api/organizacao/organizations/settings/official-email/route.ts | POST | organizacao | org, user | json | 200 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/organizations/settings/official-email/confirm | app/api/organizacao/organizations/settings/official-email/confirm/route.ts | POST | organizacao | org, user | json | 200 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/organizations/switch | app/api/organizacao/organizations/switch/route.ts | POST | organizacao | user | json | 400, 401, 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/padel/analytics | app/api/organizacao/padel/analytics/route.ts | GET | organizacao | org, user | query | 200, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/organizacao/padel/audit | app/api/organizacao/padel/audit/route.ts | GET | organizacao | org, user | query | 200, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/organizacao/padel/broadcast | app/api/organizacao/padel/broadcast/route.ts | POST | organizacao | org, orgEmail, user | json | 200, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/padel/courts | app/api/organizacao/padel/courts/route.ts | GET | organizacao | org, user | none detected | 200, 401, 403, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/organizacao/padel/exports/analytics | app/api/organizacao/padel/exports/analytics/route.ts | GET | organizacao | org, user | query | 200, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/organizacao/padel/exports/bracket | app/api/organizacao/padel/exports/bracket/route.ts | GET | organizacao | org, user | query | 200, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/organizacao/padel/exports/calendario | app/api/organizacao/padel/exports/calendario/route.ts | GET | organizacao | org, user | query | 200, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/organizacao/padel/exports/inscritos | app/api/organizacao/padel/exports/inscritos/route.ts | GET | organizacao | org, user | query | 200, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/organizacao/padel/exports/resultados | app/api/organizacao/padel/exports/resultados/route.ts | GET | organizacao | org, user | query | 200, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/organizacao/padel/imports/inscritos | app/api/organizacao/padel/imports/inscritos/route.ts | POST | organizacao | org, orgEmail, user | formData | 200, 400, 403 | nodejs/default/default | default | withApiEnvelope | - |
| /api/organizacao/padel/pairings/swap | app/api/organizacao/padel/pairings/swap/route.ts | POST | organizacao | org, orgEmail, user | json | 200, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/padel/waitlist | app/api/organizacao/padel/waitlist/route.ts | GET | organizacao | org, user | query | 200, 400, 401, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/padel/waitlist/promote | app/api/organizacao/padel/waitlist/promote/route.ts | POST | organizacao | org, orgEmail, user | json | 200, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/pagamentos/invoices | app/api/organizacao/pagamentos/invoices/route.ts | GET | organizacao | org, user | query | 200, 400, 401, 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/payouts/connect | app/api/organizacao/payouts/connect/route.ts | POST | organizacao | org, user | none detected | 200, 401, 403, 404, 409, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/organizacao/payouts/list | app/api/organizacao/payouts/list/route.ts | GET | organizacao | org, user | none detected | 200, 401, 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/payouts/settings | app/api/organizacao/payouts/settings/route.ts | POST | organizacao | org, user | json | 200, 400, 401, 403, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/organizacao/payouts/status | app/api/organizacao/payouts/status/route.ts | GET | organizacao | org, user | none detected | 401, 403, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/organizacao/payouts/summary | app/api/organizacao/payouts/summary/route.ts | GET | organizacao | org, user | none detected | 200, 401, 403, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/organizacao/payouts/webhook | app/api/organizacao/payouts/webhook/route.ts | POST | organizacao | webhook | text | 200, 400, 409, 422, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/organizacao/policies | app/api/organizacao/policies/route.ts | GET, POST | organizacao | org, orgEmail, user | json | 201, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/policies/[id] | app/api/organizacao/policies/[id]/route.ts | DELETE, PATCH | organizacao | org, orgEmail, user | json | 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/promo | app/api/organizacao/promo/route.ts | DELETE, GET, PATCH, POST | organizacao | org, orgEmail, user | json | 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/promo/[id] | app/api/organizacao/promo/[id]/route.ts | GET | organizacao | org, user | none detected | 200, 400, 403, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/refunds/list | app/api/organizacao/refunds/list/route.ts | GET | organizacao | org, user | query | 200, 401, 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/reservas | app/api/organizacao/reservas/route.ts | GET, POST | organizacao | org, user | json, query | unknown | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/reservas/[id]/cancel | app/api/organizacao/reservas/[id]/cancel/route.ts | POST | organizacao | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/reservas/[id]/charges | app/api/organizacao/reservas/[id]/charges/route.ts | GET, POST | organizacao | org, user | json | 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/reservas/[id]/checkout | app/api/organizacao/reservas/[id]/checkout/route.ts | POST | organizacao | org, user | json | unknown | nodejs/default/default | default | withApiEnvelope | - |
| /api/organizacao/reservas/[id]/invites | app/api/organizacao/reservas/[id]/invites/route.ts | GET, POST | organizacao | org, user | json | 201 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/reservas/[id]/no-show | app/api/organizacao/reservas/[id]/no-show/route.ts | POST | organizacao | org, user | none detected | unknown | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/reservas/[id]/participants | app/api/organizacao/reservas/[id]/participants/route.ts | GET | organizacao | org, user | none detected | 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/reservas/[id]/reschedule | app/api/organizacao/reservas/[id]/reschedule/route.ts | POST | organizacao | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/reservas/[id]/split | app/api/organizacao/reservas/[id]/split/route.ts | GET, POST | organizacao | org, user | json | 500 | default/default/default | dynamic exported | withApiEnvelope | - |
| /api/organizacao/reservas/clientes | app/api/organizacao/reservas/clientes/route.ts | GET | organizacao | org, user | query | unknown | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/reservas/delays | app/api/organizacao/reservas/delays/route.ts | GET, POST | organizacao | org, user | json, query | 201 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/reservas/disponibilidade | app/api/organizacao/reservas/disponibilidade/route.ts | GET, POST | organizacao | org, user | json, query | 201 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/reservas/disponibilidade/[overrideId] | app/api/organizacao/reservas/disponibilidade/[overrideId]/route.ts | DELETE | organizacao | org, user | none detected | unknown | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/reservas/profissionais | app/api/organizacao/reservas/profissionais/route.ts | GET, POST | organizacao | org, user | json | 201 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/reservas/profissionais/[id] | app/api/organizacao/reservas/profissionais/[id]/route.ts | DELETE, PATCH | organizacao | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/reservas/recursos | app/api/organizacao/reservas/recursos/route.ts | GET, POST | organizacao | org, user | json | 201 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/reservas/recursos/[id] | app/api/organizacao/reservas/recursos/[id]/route.ts | DELETE, PATCH | organizacao | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/reservas/summary | app/api/organizacao/reservas/summary/route.ts | GET | organizacao | org, user | none detected | 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/servicos | app/api/organizacao/servicos/route.ts | GET, POST | organizacao | org, user | json | 201 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/servicos/[id] | app/api/organizacao/servicos/[id]/route.ts | DELETE, GET, PATCH | organizacao | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/servicos/[id]/addons | app/api/organizacao/servicos/[id]/addons/route.ts | GET, POST | organizacao | org, user | json | 201 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/servicos/[id]/addons/[addonId] | app/api/organizacao/servicos/[id]/addons/[addonId]/route.ts | DELETE, PATCH | organizacao | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/servicos/[id]/class-series | app/api/organizacao/servicos/[id]/class-series/route.ts | GET, POST | organizacao | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/servicos/[id]/class-series/[seriesId] | app/api/organizacao/servicos/[id]/class-series/[seriesId]/route.ts | DELETE, PATCH | organizacao | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/servicos/[id]/class-sessions | app/api/organizacao/servicos/[id]/class-sessions/route.ts | GET | organizacao | org, user | query | unknown | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/servicos/[id]/disponibilidade | app/api/organizacao/servicos/[id]/disponibilidade/route.ts | GET, POST | organizacao | org, user | json, query | 201 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/servicos/[id]/disponibilidade/[availabilityId] | app/api/organizacao/servicos/[id]/disponibilidade/[availabilityId]/route.ts | DELETE | organizacao | org, user | none detected | unknown | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/servicos/[id]/packages | app/api/organizacao/servicos/[id]/packages/route.ts | GET, POST | organizacao | org, user | json | 201 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/servicos/[id]/packages/[packageId] | app/api/organizacao/servicos/[id]/packages/[packageId]/route.ts | DELETE, PATCH | organizacao | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/servicos/[id]/packs | app/api/organizacao/servicos/[id]/packs/route.ts | GET, POST | organizacao | org, user | json | 201 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/servicos/[id]/packs/[packId] | app/api/organizacao/servicos/[id]/packs/[packId]/route.ts | DELETE, PATCH | organizacao | org, user | json | unknown | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/tournaments/[id] | app/api/organizacao/tournaments/[id]/route.ts | GET, PATCH | organizacao | org, user | json | 200 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/tournaments/[id]/featured-match | app/api/organizacao/tournaments/[id]/featured-match/route.ts | POST | organizacao | org, orgEmail, user | json | 200, 400, 401, 403, 404 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/tournaments/[id]/finance | app/api/organizacao/tournaments/[id]/finance/route.ts | GET | organizacao | org, user | none detected | 200, 400, 401, 403, 404 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/tournaments/[id]/generate | app/api/organizacao/tournaments/[id]/generate/route.ts | POST | organizacao | org, orgEmail, user | json | 202, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/tournaments/[id]/live | app/api/organizacao/tournaments/[id]/live/route.ts | GET | organizacao | org, user | none detected | 200, 400, 401, 403, 404 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/tournaments/[id]/matches/[matchId]/edit | app/api/organizacao/tournaments/[id]/matches/[matchId]/edit/route.ts | POST | organizacao | org, orgEmail, user | json | 200, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/tournaments/[id]/matches/[matchId]/notify | app/api/organizacao/tournaments/[id]/matches/[matchId]/notify/route.ts | POST | organizacao | org, orgEmail, user | none detected | 200, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/tournaments/[id]/matches/[matchId]/result | app/api/organizacao/tournaments/[id]/matches/[matchId]/result/route.ts | POST | organizacao | admin, org, orgEmail, user | json | 202, 400, 401, 403, 404, 409, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/tournaments/[id]/matches/[matchId]/undo | app/api/organizacao/tournaments/[id]/matches/[matchId]/undo/route.ts | POST | organizacao | org, orgEmail, user | none detected | 200, 400, 401, 403, 404, 409 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/tournaments/[id]/matches/schedule | app/api/organizacao/tournaments/[id]/matches/schedule/route.ts | POST | organizacao | org, orgEmail, user | json | 200, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/tournaments/[id]/participants | app/api/organizacao/tournaments/[id]/participants/route.ts | GET, POST | organizacao | org, orgEmail, user | json | 200, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/tournaments/[id]/rules | app/api/organizacao/tournaments/[id]/rules/route.ts | POST | organizacao | org, orgEmail, user | json | 200, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/tournaments/[id]/sponsors | app/api/organizacao/tournaments/[id]/sponsors/route.ts | POST | organizacao | org, orgEmail, user | json | 200, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/tournaments/[id]/structure | app/api/organizacao/tournaments/[id]/structure/route.ts | GET | organizacao | org, user | none detected | 200, 400, 401, 403, 404 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/tournaments/create | app/api/organizacao/tournaments/create/route.ts | POST | organizacao | org, orgEmail, user | json | 200, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/tournaments/list | app/api/organizacao/tournaments/list/route.ts | GET | organizacao | org, user | query | 200, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/trainers | app/api/organizacao/trainers/route.ts | GET, PATCH, POST | organizacao | org, orgEmail, user | json | 200, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/trainers/profile | app/api/organizacao/trainers/profile/route.ts | GET, PATCH | organizacao | org, orgEmail, user | json | 200, 403 | default/default/default | default | withApiEnvelope | - |
| /api/organizacao/username | app/api/organizacao/username/route.ts | PATCH | organizacao | org, orgEmail, user | json | 200, 403 | nodejs/default/default | default | withApiEnvelope | - |
| /api/organizacao/venues/recent | app/api/organizacao/venues/recent/route.ts | GET | organizacao | org, user | query | 401, 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/organizations/search | app/api/organizations/search/route.ts | GET | public | user | query | 200, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/calendar | app/api/padel/calendar/route.ts | DELETE, GET, PATCH, POST | public | org, user | json, query | 200, 201, 400, 401, 403, 404, 409, 410, 423, 503 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/calendar/auto-schedule | app/api/padel/calendar/auto-schedule/route.ts | POST | public | org, user | json, query | 200, 400, 401, 403, 404, 409, 503 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/calendar/claims/commit | app/api/padel/calendar/claims/commit/route.ts | PATCH, POST | public | org, user | json, query | 200, 201, 400, 401, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/categories/my | app/api/padel/categories/my/route.ts | DELETE, GET, PATCH, POST | public | org, user | json, query | 200, 201, 400, 401, 403, 404, 409, 500 | default/default/default | default | withApiEnvelope | - |
| /api/padel/clubs | app/api/padel/clubs/route.ts | DELETE, GET, POST | public | org, user | json, query | 200, 400, 401, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/clubs/[id]/courts | app/api/padel/clubs/[id]/courts/route.ts | DELETE, GET, POST | public | org, user | json, query | 200, 400, 401, 403, 404, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/clubs/[id]/staff | app/api/padel/clubs/[id]/staff/route.ts | DELETE, GET, POST | public | org, user | json, query | 200, 400, 401, 403, 404, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/community/posts | app/api/padel/community/posts/route.ts | GET, POST | public | org, user | json, query | 200, 201, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/community/posts/[id]/comments | app/api/padel/community/posts/[id]/comments/route.ts | GET, POST | public | org, user | json | 200, 201, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/community/posts/[id]/reactions | app/api/padel/community/posts/[id]/reactions/route.ts | POST | public | org, user | json | 200, 201, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/discover | app/api/padel/discover/route.ts | GET | public | none detected | query | 200, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/event-categories | app/api/padel/event-categories/route.ts | GET, POST | public | org, user | json, query | 200, 400, 401, 403, 404, 409, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/live | app/api/padel/live/route.ts | GET | public | none detected | query | 410 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/live/timer/next-round | app/api/padel/live/timer/next-round/route.ts | POST | public | org, user | json | 400, 401, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/live/timer/start | app/api/padel/live/timer/start/route.ts | POST | public | org, user | json | 400, 401, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/live/timer/stop | app/api/padel/live/timer/stop/route.ts | POST | public | org, user | json | 400, 401, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/matches | app/api/padel/matches/route.ts | GET, POST | public | admin, org, user | json, query | 200 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/matches/[id]/delay | app/api/padel/matches/[id]/delay/route.ts | POST | public | org, user | json | 202, 400, 401, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/matches/[id]/dispute | app/api/padel/matches/[id]/dispute/route.ts | PATCH, POST | public | org, user | json | 200, 400, 401, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/matches/[id]/undo | app/api/padel/matches/[id]/undo/route.ts | POST | public | org, user | json | 200, 400, 401, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/matches/[id]/walkover | app/api/padel/matches/[id]/walkover/route.ts | POST | public | org, user | json | 200, 400, 401, 403, 404, 409 | default/default/default | default | withApiEnvelope | - |
| /api/padel/matches/assign | app/api/padel/matches/assign/route.ts | POST | public | org, user | json | 200, 400, 401, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/matches/generate | app/api/padel/matches/generate/route.ts | POST | public | org, user | json | 200, 400, 401, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/me/history | app/api/padel/me/history/route.ts | GET | public | user | none detected | 200, 401 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/me/matches | app/api/padel/me/matches/route.ts | GET | public | user | query | 200, 401 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/me/summary | app/api/padel/me/summary/route.ts | GET | public | user | none detected | 200, 401 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/onboarding | app/api/padel/onboarding/route.ts | GET, POST | public | user | json | 200, 400, 401, 404, 409, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/ops/summary | app/api/padel/ops/summary/route.ts | GET | public | org, user | query | 200, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/pairings | app/api/padel/pairings/route.ts | GET, POST | public | org, user | json, query | 200, 400, 401, 403, 404, 409, 423, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/pairings/[id]/accept | app/api/padel/pairings/[id]/accept/route.ts | POST | public | user | none detected | 200, 400, 401, 402, 403, 404, 409, 423, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/pairings/[id]/assume | app/api/padel/pairings/[id]/assume/route.ts | POST | public | user | none detected | 400, 401, 402, 403, 404, 409, 423 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/pairings/[id]/cancel | app/api/padel/pairings/[id]/cancel/route.ts | POST | public | org, user | none detected | 200, 400, 401, 403, 404, 409, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/pairings/[id]/checkout | app/api/padel/pairings/[id]/checkout/route.ts | POST | public | user | json | unknown | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/pairings/[id]/decline | app/api/padel/pairings/[id]/decline/route.ts | POST | public | user | none detected | 200, 400, 401, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/pairings/[id]/invite | app/api/padel/pairings/[id]/invite/route.ts | POST | public | org, user | json | 200, 400, 401, 403, 404, 409, 423 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/pairings/[id]/public | app/api/padel/pairings/[id]/public/route.ts | PATCH | public | org, user | json | 200, 400, 401, 403, 404, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/pairings/[id]/regularize | app/api/padel/pairings/[id]/regularize/route.ts | POST | public | org, user | none detected | 200, 400, 401, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/pairings/[id]/reopen | app/api/padel/pairings/[id]/reopen/route.ts | POST | public | org, user | json | 200, 400, 401, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/pairings/[id]/swap | app/api/padel/pairings/[id]/swap/route.ts | POST | public | user | none detected | 200, 400, 401, 403, 404, 409 | default/default/default | default | withApiEnvelope | - |
| /api/padel/pairings/claim/[token] | app/api/padel/pairings/claim/[token]/route.ts | GET, POST | public | user | none detected | 200, 400, 401, 402, 404, 409, 423, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/pairings/invite-status | app/api/padel/pairings/invite-status/route.ts | GET | public | user | query | 200, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/pairings/my | app/api/padel/pairings/my/route.ts | GET | public | user | query | 200, 401, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/pairings/open | app/api/padel/pairings/open/route.ts | POST | public | user | json | 200, 400, 401, 402, 403, 404, 409, 423, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/partnerships/agreements | app/api/padel/partnerships/agreements/route.ts | GET, POST | public | none detected | json, query | 200, 201, 400, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/partnerships/agreements/[id]/approve | app/api/padel/partnerships/agreements/[id]/approve/route.ts | POST | public | none detected | json | 200, 400, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/partnerships/agreements/[id]/grants | app/api/padel/partnerships/agreements/[id]/grants/route.ts | DELETE, GET, PATCH, POST | public | none detected | json, query | 200, 201, 400, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/partnerships/agreements/[id]/pause | app/api/padel/partnerships/agreements/[id]/pause/route.ts | POST | public | none detected | json | 200, 400, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/partnerships/agreements/[id]/revoke | app/api/padel/partnerships/agreements/[id]/revoke/route.ts | POST | public | none detected | json | 200, 400, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/partnerships/agreements/[id]/windows | app/api/padel/partnerships/agreements/[id]/windows/route.ts | DELETE, GET, PATCH, POST | public | none detected | json, query | 200, 201, 400, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/partnerships/compensation-cases | app/api/padel/partnerships/compensation-cases/route.ts | GET, PATCH | public | none detected | json, query | 200, 400, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/partnerships/overrides | app/api/padel/partnerships/overrides/route.ts | GET, POST | public | none detected | json | 200, 201, 400, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/partnerships/overrides/[id]/execute | app/api/padel/partnerships/overrides/[id]/execute/route.ts | POST | public | none detected | json | 200, 400, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/partnerships/workspace/[id]/calendar | app/api/padel/partnerships/workspace/[id]/calendar/route.ts | GET | public | none detected | query | 200, 400, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/players | app/api/padel/players/route.ts | GET, POST | public | org, user | json, query | 200, 201, 400, 401, 403, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/public/calendar | app/api/padel/public/calendar/route.ts | GET | public | none detected | query | 200 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/public/clubs | app/api/padel/public/clubs/route.ts | GET | public | none detected | query | 200, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/public/open-pairings | app/api/padel/public/open-pairings/route.ts | GET | public | none detected | query | 200, 400, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/rankings | app/api/padel/rankings/route.ts | GET, POST | public | org, user | json, query | 200, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/rankings/rebuild | app/api/padel/rankings/rebuild/route.ts | POST | public | org, user | json | 200, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/rankings/sanctions | app/api/padel/rankings/sanctions/route.ts | POST | public | org, user | json | 201, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/rulesets | app/api/padel/rulesets/route.ts | GET, POST | public | org, user | json, query | 200, 400, 401, 403, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/standings | app/api/padel/standings/route.ts | GET | public | org, user | query | 400, 401, 403, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/padel/teams | app/api/padel/teams/route.ts | GET, POST | public | org, user | json, query | 200, 201, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/teams/[id]/members | app/api/padel/teams/[id]/members/route.ts | DELETE, GET, POST | public | org, user | json | 200, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/teams/entries | app/api/padel/teams/entries/route.ts | GET, POST | public | org, user | json, query | 200, 400, 401, 403, 404, 409 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/tournaments/config | app/api/padel/tournaments/config/route.ts | GET, POST | public | org, user | json, query | 200, 400, 401, 403, 404, 409, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/tournaments/lifecycle | app/api/padel/tournaments/lifecycle/route.ts | GET, POST | public | org, user | json, query | 200, 400, 401, 403, 404, 409, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/tournaments/roles | app/api/padel/tournaments/roles/route.ts | DELETE, GET, POST | public | org, user | json, query | 200, 201, 400, 401, 403, 404, 409, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/tournaments/seeds | app/api/padel/tournaments/seeds/route.ts | POST | public | org, user | json | 200, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/tournaments/tier-approvals/[id]/approve | app/api/padel/tournaments/tier-approvals/[id]/approve/route.ts | POST | public | org, user | json | 200, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/tournaments/tier-approvals/[id]/reject | app/api/padel/tournaments/tier-approvals/[id]/reject/route.ts | POST | public | org, user | json | 200, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/padel/tournaments/tier-approvals/request | app/api/padel/tournaments/tier-approvals/request/route.ts | POST | public | org, user | json | 200, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/payments/intent | app/api/payments/intent/route.ts | POST | public | admin, user | json | 200, 400, 401, 403, 404, 409, 410, 429, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/platform/fees | app/api/platform/fees/route.ts | GET | public | none detected | none detected | 200, 500 | default/default/default | default | withApiEnvelope | - |
| /api/profiles/check-username | app/api/profiles/check-username/route.ts | POST | public | user | json | 400, 500 | default/default/default | default | withApiEnvelope | - |
| /api/profiles/save-basic | app/api/profiles/save-basic/route.ts | POST | public | user | json | 200, 400, 401, 409, 500 | default/default/default | default | withApiEnvelope | - |
| /api/public/agenda | app/api/public/agenda/route.ts | GET | public | none detected | query | 200 | nodejs/default/default | default | withApiEnvelope | - |
| /api/public/profile | app/api/public/profile/route.ts | GET | public | user | query | 200, 400, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/public/profile/events | app/api/public/profile/events/route.ts | GET | public | user | query | 200, 400, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/public/store/bundles | app/api/public/store/bundles/route.ts | GET | public | none detected | query | 400, 403, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/public/store/cart | app/api/public/store/cart/route.ts | GET | public | user | query | 400, 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/public/store/cart/bundles | app/api/public/store/cart/bundles/route.ts | POST | public | user | json, query | 400, 403, 404, 409, 500 | default/default/default | default | withApiEnvelope | - |
| /api/public/store/cart/bundles/[bundleKey] | app/api/public/store/cart/bundles/[bundleKey]/route.ts | DELETE, PATCH | public | user | json, query | 400, 403, 404, 409, 500 | default/default/default | default | withApiEnvelope | - |
| /api/public/store/cart/items | app/api/public/store/cart/items/route.ts | POST | public | user | json, query | 400, 403, 404, 409, 500 | default/default/default | default | withApiEnvelope | - |
| /api/public/store/cart/items/[itemId] | app/api/public/store/cart/items/[itemId]/route.ts | DELETE, PATCH | public | user | json, query | 400, 403, 404, 409, 500 | default/default/default | default | withApiEnvelope | - |
| /api/public/store/catalog | app/api/public/store/catalog/route.ts | GET | public | none detected | query | 400, 403, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/public/store/checkout | app/api/public/store/checkout/route.ts | POST | public | user | json, query | unknown | nodejs/default/default | default | withApiEnvelope | - |
| /api/public/store/checkout/prefill | app/api/public/store/checkout/prefill/route.ts | GET | public | user | query | 403 | default/default/default | default | withApiEnvelope | - |
| /api/public/store/digital/download | app/api/public/store/digital/download/route.ts | GET, POST | public | user | json, query | 400, 401, 403, 404, 409, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/public/store/digital/grants | app/api/public/store/digital/grants/route.ts | GET | public | user | query | 400, 401, 403, 500 | default/default/default | default | withApiEnvelope | - |
| /api/public/store/digital/lookup | app/api/public/store/digital/lookup/route.ts | POST | public | none detected | json, query | 400, 403, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/public/store/orders/invoice | app/api/public/store/orders/invoice/route.ts | POST | public | none detected | json | 200, 400, 403, 404, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/public/store/orders/lookup | app/api/public/store/orders/lookup/route.ts | POST | public | none detected | json | 400, 403, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/public/store/orders/receipt | app/api/public/store/orders/receipt/route.ts | POST | public | none detected | json | 400, 403, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/public/store/product | app/api/public/store/product/route.ts | GET | public | none detected | query | 400, 403, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/public/store/recommendations | app/api/public/store/recommendations/route.ts | GET | public | none detected | query | 400, 403, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/public/store/shipping/methods | app/api/public/store/shipping/methods/route.ts | GET | public | none detected | query | 400, 403, 404, 409, 500 | default/default/default | default | withApiEnvelope | - |
| /api/public/store/shipping/quote | app/api/public/store/shipping/quote/route.ts | GET | public | none detected | query | 400, 403, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/qr/[token] | app/api/qr/[token]/route.ts | GET | public | none detected | query | 200, 400, 404, 410, 429, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/search | app/api/search/route.ts | GET | public | none detected | query | 500 | default/default/default | default | withApiEnvelope | - |
| /api/servicos/[id] | app/api/servicos/[id]/route.ts | GET | public | none detected | none detected | 400, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/servicos/[id]/booking-status | app/api/servicos/[id]/booking-status/route.ts | GET | public | none detected | query | 200, 400, 404, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/servicos/[id]/calendario | app/api/servicos/[id]/calendario/route.ts | GET | public | none detected | query | 400, 404, 409, 500 | default/default/default | default | withApiEnvelope | - |
| /api/servicos/[id]/checkout | app/api/servicos/[id]/checkout/route.ts | POST | public | user | json | unknown | nodejs/default/default | default | withApiEnvelope | - |
| /api/servicos/[id]/creditos | app/api/servicos/[id]/creditos/route.ts | GET | public | none detected | none detected | 400, 410 | default/default/default | default | withApiEnvelope | - |
| /api/servicos/[id]/creditos/checkout | app/api/servicos/[id]/creditos/checkout/route.ts | POST | public | none detected | none detected | 400, 410 | nodejs/default/default | default | withApiEnvelope | - |
| /api/servicos/[id]/disponibilidade | app/api/servicos/[id]/disponibilidade/route.ts | GET | public | none detected | query | 400, 404, 409, 500 | default/default/default | default | withApiEnvelope | - |
| /api/servicos/[id]/reservar | app/api/servicos/[id]/reservar/route.ts | POST | public | user | json | 400, 401, 404, 409, 429, 500, 503 | nodejs/default/default | default | withApiEnvelope | - |
| /api/servicos/[id]/slots | app/api/servicos/[id]/slots/route.ts | GET | public | none detected | query | 400, 404, 409, 500 | default/default/default | default | withApiEnvelope | - |
| /api/servicos/list | app/api/servicos/list/route.ts | GET | public | none detected | query | 200, 500 | default/default/default | default | withApiEnvelope | - |
| /api/social/feed | app/api/social/feed/route.ts | GET | public | user | query | 200, 400, 401 | nodejs/default/default | default | withApiEnvelope | - |
| /api/social/follow | app/api/social/follow/route.ts | POST | public | user | json | 200, 400, 401, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/social/follow-organization | app/api/social/follow-organization/route.ts | POST | public | user | json | 200, 400, 401, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/social/follow-requests | app/api/social/follow-requests/route.ts | GET | public | user | none detected | 200, 401 | nodejs/default/default | default | withApiEnvelope | - |
| /api/social/follow-requests/accept | app/api/social/follow-requests/accept/route.ts | POST | public | user | json | 200, 400, 401, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/social/follow-requests/cancel | app/api/social/follow-requests/cancel/route.ts | POST | public | user | json | 200, 400, 401 | nodejs/default/default | default | withApiEnvelope | - |
| /api/social/follow-requests/decline | app/api/social/follow-requests/decline/route.ts | POST | public | user | json | 200, 400, 401, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/social/follow-status | app/api/social/follow-status/route.ts | GET | public | user | query | 200, 400, 401 | nodejs/default/default | default | withApiEnvelope | - |
| /api/social/followers | app/api/social/followers/route.ts | GET | public | user | query | 200, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/social/following | app/api/social/following/route.ts | GET | public | user | query | 200, 400, 401, 403, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/social/organization-follow-status | app/api/social/organization-follow-status/route.ts | GET | public | user | query | 200, 400, 401, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/social/organization-followers | app/api/social/organization-followers/route.ts | GET | public | none detected | query | 200, 400, 404 | nodejs/default/default | default | withApiEnvelope | - |
| /api/social/suggestions | app/api/social/suggestions/route.ts | GET | public | user | query | 200, 401 | nodejs/default/default | default | withApiEnvelope | - |
| /api/social/unfollow | app/api/social/unfollow/route.ts | POST | public | user | json | 200, 400, 401, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/social/unfollow-organization | app/api/social/unfollow-organization/route.ts | POST | public | user | json | 200, 400, 401 | nodejs/default/default | default | withApiEnvelope | - |
| /api/stripe/webhook | app/api/stripe/webhook/route.ts | POST | public | webhook | text | 200, 400, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/tickets/resale/cancel | app/api/tickets/resale/cancel/route.ts | POST | public | admin, user | json | 200, 400, 401, 403, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/tickets/resale/list | app/api/tickets/resale/list/route.ts | POST | public | admin, user | json | 200, 400, 401, 403, 404, 500 | default/default/default | default | withApiEnvelope | - |
| /api/tournaments/[id] | app/api/tournaments/[id]/route.ts | GET | public | none detected | none detected | 200, 400, 404 | default/default/default | default | withApiEnvelope | - |
| /api/tournaments/[id]/live | app/api/tournaments/[id]/live/route.ts | GET | public | user | none detected | 200, 400, 404 | default/default/default | default | withApiEnvelope | - |
| /api/tournaments/[id]/monitor | app/api/tournaments/[id]/monitor/route.ts | GET | public | none detected | none detected | 200, 400, 404 | default/default/default | default | withApiEnvelope | - |
| /api/tournaments/[id]/structure | app/api/tournaments/[id]/structure/route.ts | GET | public | none detected | none detected | 200, 400, 404 | default/default/default | default | withApiEnvelope | - |
| /api/tournaments/list | app/api/tournaments/list/route.ts | GET | public | none detected | query | 200 | default/default/default | default | withApiEnvelope | - |
| /api/upload | app/api/upload/route.ts | POST | public | org, user | formData, query | 201, 400, 401, 403, 413, 429, 500 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/upload/delete | app/api/upload/delete/route.ts | POST | public | org, user | json | 400, 401, 403, 404, 409, 500, 502 | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/username/check | app/api/username/check/route.ts | GET | public | user | query | 200, 400, 403, 429, 500, 503 | default/default/default | default | withApiEnvelope | - |
| /api/users/search | app/api/users/search/route.ts | GET | public | user | query | 200, 500 | nodejs/default/default | default | withApiEnvelope | - |
| /api/webhooks/stripe | app/api/webhooks/stripe/route.ts | POST | public | none detected | none detected | unknown | nodejs/force-dynamic/default | dynamic exported | withApiEnvelope | - |
| /api/widgets/padel/bracket | app/api/widgets/padel/bracket/route.ts | GET | public | none detected | query | 200 | nodejs/default/default | default | withApiEnvelope | - |
| /api/widgets/padel/calendar | app/api/widgets/padel/calendar/route.ts | GET | public | none detected | query | 200, 400 | nodejs/default/default | default | withApiEnvelope | - |
| /api/widgets/padel/next | app/api/widgets/padel/next/route.ts | GET | public | none detected | query | 200 | nodejs/default/default | default | withApiEnvelope | - |
| /api/widgets/padel/standings | app/api/widgets/padel/standings/route.ts | GET | public | none detected | query | 200, 400, 404 | nodejs/default/default | default | withApiEnvelope | - |

Notas:
- Auth/códigos/payloads foram inferidos por heurística; revisar manualmente endpoints críticos.
- Envelope indica uso detectado (withApiEnvelope/respond*/jsonWrap); raw = potencial não conformidade.