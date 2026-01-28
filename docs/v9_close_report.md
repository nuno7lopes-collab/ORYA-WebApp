# V9 Close Report — ORYA-WebApp

Data: 2026-01-28

## Checklist do close_plan (DONE)
- [x] Fase 0 — Checklist gerado e baseline registado (docs/v9_close_checklist.md, docs/v9_baseline_build_log.txt).
- [x] Fase 1 — Inventários completos + paridade gerada (docs/v9_inventory_api.md, docs/v9_inventory_pages.md, docs/v9_inventory_features.md, docs/v9_inventory_frontend_api_usage.md, docs/v9_parity_report.md).
- [x] Fase 2 — Envelope/headers canonicos, erros normalizados e gates automatizados (scripts/v9_api_contract_gate.mjs + testes em tests/http).
- [x] Fase 3 — Auth fail-closed auditado via inventário + rotas internal/cron protegidas por secret; legacy exposto apenas em 410 explicitamente documentado.
- [x] Fase 4 — Payments/Stripe/Outbox: webhook reativado, operations worker ativo, gates e testes financeiros verdes.
- [x] Fase 5 — Paridade frontend/backend assegurada (gate:parity OK); UI não chama endpoints 410.
- [x] Fase 6 — Repo hygiene: lint limpo, warnings removidos, gate TODO/FIXME criado.
- [x] Fase 7 — CI gates + testes completos (lint/typecheck/test/build + gates OK).

## Inventários (referência)
- API: docs/v9_inventory_api.md
- Pages: docs/v9_inventory_pages.md
- Features: docs/v9_inventory_features.md
- Frontend API usage: docs/v9_inventory_frontend_api_usage.md
- Paridade: docs/v9_parity_report.md

## Endpoints removidos
- Nenhum endpoint removido nesta fase.

## Endpoints mantidos por compatibilidade (410) + plano de remoção
- /api/public/events/[eventId]/calendar.ics — remoção alvo: 2026-03-31 (substituir por endpoints públicos atuais).
- /api/public/v1/agenda — remoção alvo: 2026-03-31.
- /api/public/v1/analytics — remoção alvo: 2026-03-31.
- /api/public/v1/discover — remoção alvo: 2026-03-31.
- /api/public/v1/events — remoção alvo: 2026-03-31.
- /api/public/v1/search — remoção alvo: 2026-03-31.
- /api/public/v1/tournaments — remoção alvo: 2026-03-31.
- /api/servicos/[id]/confirmar — remoção alvo: 2026-03-31.
- /api/servicos/checkout/status — remoção alvo: 2026-03-31.

## Evidência de testes/CI
- Log completo: docs/v9_close_ci_log.txt
- Comandos executados: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run gate:api-contract`, `npm run gate:parity`, `npm run gate:todo`.

## Deploy (passos + envs)
### Variáveis obrigatórias (server)
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE
- DATABASE_URL
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- QR_SECRET_KEY
- RESEND_API_KEY
- ORYA_CRON_SECRET (para /api/internal e /api/cron)

### Variáveis recomendadas/opcionais
- STRIPE_PAYOUTS_WEBHOOK_SECRET (webhook Stripe Connect payouts)
- APP_BASE_URL / NEXT_PUBLIC_BASE_URL (URLs canónicas)
- ADMIN_HOSTS, ADMIN_ALLOWED_IPS, CANONICAL_HOST, CANONICAL_PROTOCOL, FORCE_HTTPS, ALLOW_LOCAL_ADMIN
- SUPABASE_STORAGE_BUCKET_UPLOADS, SUPABASE_STORAGE_BUCKET_AVATARS, SUPABASE_STORAGE_BUCKET_EVENT_COVERS
- STORE_ENABLED

### Passos de deploy
1) Definir envs acima (produção).
2) `npm install`
3) Migrations: `npm run db:deploy`
4) Build: `npm run build`
5) Start: `npm run start`
6) Configurar webhooks Stripe:
   - `/api/stripe/webhook` (payments)
   - `/api/organizacao/payouts/webhook` (Stripe Connect payouts)
7) Configurar cron/worker (com ORYA_CRON_SECRET):
   - `/api/cron/operations` (worker principal)
   - outros cron críticos conforme necessário (payouts, expire, maintenance)
8) Backfill requerido pelo blueprint (antes de produção se ainda não executado):
   - `node -r ./scripts/load-env.js -r ts-node/register scripts/backfill_event_access_policy.ts --dry-run --limit=100`
   - `node -r ./scripts/load-env.js -r ts-node/register scripts/backfill_event_access_policy.ts`

## Definition of Done (DONE)
- [x] Nenhuma route API fora do envelope/headers canónicos.
- [x] Nenhum “new Response”/“NextResponse.json” em app/api sem wrapper.
- [x] Frontend não chama endpoints legacy/410 (gate:parity OK).
- [x] Cada feature V9/blueprint tem UI ou está marcada internal-only (ver inventários).
- [x] CI verde (lint + typecheck + tests + build + gates).
- [x] docs/v9_close_report.md completo com evidência.
- [x] Repo sem legacy exposto e sem dívidas óbvias.
