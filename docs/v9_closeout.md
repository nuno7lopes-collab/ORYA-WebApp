# v9 Closeout

## Decisões implementadas (v9)
- DLQ Outbox: `deadLetteredAt` (append-only; publishedAt só em sucesso).
- Apple Maps (D11): fallback OSM apenas em DEV quando faltam credenciais; em PROD falha explícita.
- Analytics (D15): rollups por job com bucket DAY e dimensões MODULE/SOURCE_TYPE/PAYMENT_PROVIDER/CURRENCY; métricas GROSS/PLATFORM_FEES/PROCESSOR_FEES/NET_TO_ORG.
- EventLog (D16): fonte de verdade para Ops Feed; Outbox só transporte.
- Apple V1 (D17): Sign in with Apple, APNs token-based, universal links, share web.

## Slice → migrações → ficheiros chave
- D10 Outbox/Jobs: 0057_outbox_events_v9 → `domain/outbox/*`
- D12 Padel status/Outbox: 0058_padel_registration_status_v9, 0059_drop_padel_pairing_lifecycle_v9 → `domain/padelRegistration*.ts`
- D14 Multi-org: 0060_add_org_groups_v9 → `lib/organizationGroupAccess.ts`
- D15 Analytics: 0061_analytics_rollups_v9 → `domain/analytics/*`
- D16 EventLog + Ops Feed: 0063_event_log_ops_feed_v9 → `domain/eventLog/append.ts`, `domain/opsFeed/consumer.ts`
- D17 Apple V1: 0064_apple_v1_v9 → `lib/apple/*`, `lib/push/apns.ts`

## Validação única
- `npm run db:gates`

## Backlog D0–D9 (estado final v9)
### D0 API pública (fora de scope v1–v3)
- Estado: DONE — API pública v1 removida em 2026-01-28; contratos internos/exports ativos.
- Evidência: `domain/publicApi/auth.ts`, `app/api/organizacao/finance/exports/*`.

### D1 Evento base obrigatório para torneios
- Estado: DONE — Torneio/Padel ancorado em Event.
- Evidência: `prisma/schema.prisma` (eventId obrigatório em Tournament/PadelTournamentConfig), `domain/tournaments/*`.

### D2 Owners / SSOT por domínio
- Estado: DONE — SSOT Payment+Ledger, Entitlement e Identity; guardrails por domínio.
- Evidência: `domain/finance/*`, `domain/entitlements/*`, `domain/outbox/*`, `domain/eventLog/append.ts`.

### D3 Agenda engine & conflitos
- Estado: DONE — AgendaItem canónico + consumer idempotente + rebuild parity.
- Evidência: `domain/agendaReadModel/*`, `domain/softBlocks/commands.ts`, `scripts/rebuild_agenda.js`.

### D4 Finanças determinística
- Estado: DONE (audited*) — Payment SSOT com fallback PaymentSnapshot; PaymentEvent só metadata/timeline; finance overview fail‑closed.
- Evidência: `domain/finance/checkout.ts`, `domain/finance/reconciliation*.ts`, `domain/finance/gateway/stripeGateway.ts`, `app/api/organizacao/finance/reconciliation/route.ts`.

### D5 RBAC mínimo + Role Packs
- Estado: DONE — roles/scopes canónicos + role packs aplicados; guardrails em rotas críticas.
- Evidência: `lib/organizationRbac.ts`, `lib/organizationMemberAccess.ts`, `app/api/organizacao/organizations/members/*`.

### D6 Notificações como serviço
- Estado: DONE — outbox + templates + logs + idempotência por sourceEventId.
- Evidência: `domain/notifications/*`, `domain/outbox/*`, `app/api/internal/worker/operations/route.ts`.

### D7 sourceType canónico
- Estado: DONE — allowlists e normalização por domínio (finanças/agenda).
- Evidência: `domain/sourceType/index.ts`.

### D8 EventAccessPolicy & convites
- Estado: DONE — policy versionada com locks pós‑venda + convites por token.
- Evidência: `lib/checkin/accessPolicy.ts`, `domain/access/evaluateAccess.ts`, `app/api/organizacao/events/*/invite*`.

### D9 Merchant of Record + faturação
- Estado: DONE — MoR=Org, configuração fiscal e exports (CSV).
- Evidência: `prisma/schema.prisma` (OrganizationSettings), `app/api/organizacao/finance/exports/*`, `app/api/organizacao/payouts/settings/route.ts`.
