# API <-> UI Coverage Report

Generated: 2026-02-11T12:05:29.340Z
CSV: reports/api_ui_coverage.csv

## Summary
- API routes total: 566
- Covered by UI: 520
- Orphan (no UI): 0
- Exempt (internal/cron/webhook): 46
- UI endpoints missing API: 0

## UI endpoints missing API routes
- none

## API routes without UI usage (excluding internal/cron/webhook)
- none

## Exempt routes (internal/cron/webhook)
- /api/cron/bookings/cleanup (app/api/cron/bookings/cleanup/route.ts)
- /api/cron/chat/maintenance (app/api/cron/chat/maintenance/route.ts)
- /api/cron/creditos/expire (app/api/cron/creditos/expire/route.ts)
- /api/cron/crm/campanhas (app/api/cron/crm/campanhas/route.ts)
- /api/cron/crm/rebuild (app/api/cron/crm/rebuild/route.ts)
- /api/cron/entitlements/qr-cleanup (app/api/cron/entitlements/qr-cleanup/route.ts)
- /api/cron/loyalty/expire (app/api/cron/loyalty/expire/route.ts)
- /api/cron/operations (app/api/cron/operations/route.ts)
- /api/cron/padel/expire (app/api/cron/padel/expire/route.ts)
- /api/cron/padel/matchmaking (app/api/cron/padel/matchmaking/route.ts)
- /api/cron/padel/reminders (app/api/cron/padel/reminders/route.ts)
- /api/cron/padel/split-reminders (app/api/cron/padel/split-reminders/route.ts)
- /api/cron/padel/tournament-eve (app/api/cron/padel/tournament-eve/route.ts)
- /api/cron/padel/waitlist (app/api/cron/padel/waitlist/route.ts)
- /api/cron/payouts/release (app/api/cron/payouts/release/route.ts)
- /api/cron/repair-usernames (app/api/cron/repair-usernames/route.ts)
- /api/cron/reservations/cleanup (app/api/cron/reservations/cleanup/route.ts)
- /api/internal/analytics/rollup (app/api/internal/analytics/rollup/route.ts)
- /api/internal/audit (app/api/internal/audit/route.ts)
- /api/internal/chat/backfill (app/api/internal/chat/backfill/route.ts)
- /api/internal/checkin/consume (app/api/internal/checkin/consume/route.ts)
- /api/internal/checkout/timeline (app/api/internal/checkout/timeline/route.ts)
- /api/internal/crm/ingest (app/api/internal/crm/ingest/route.ts)
- /api/internal/crm/rebuild (app/api/internal/crm/rebuild/route.ts)
- /api/internal/notifications/sweep (app/api/internal/notifications/sweep/route.ts)
- /api/internal/ops/dashboard (app/api/internal/ops/dashboard/route.ts)
- /api/internal/ops/feed (app/api/internal/ops/feed/route.ts)
- /api/internal/ops/health (app/api/internal/ops/health/route.ts)
- /api/internal/ops/outbox/replay (app/api/internal/ops/outbox/replay/route.ts)
- /api/internal/ops/outbox/summary (app/api/internal/ops/outbox/summary/route.ts)
- /api/internal/ops/padel/cleanup (app/api/internal/ops/padel/cleanup/route.ts)
- /api/internal/ops/padel/integrity (app/api/internal/ops/padel/integrity/route.ts)
- /api/internal/ops/slo (app/api/internal/ops/slo/route.ts)
- /api/internal/outbox/dlq (app/api/internal/outbox/dlq/route.ts)
- /api/internal/outbox/replay (app/api/internal/outbox/replay/route.ts)
- /api/internal/padel/registrations/backfill (app/api/internal/padel/registrations/backfill/route.ts)
- /api/internal/ping (app/api/internal/ping/route.ts)
- /api/internal/public-api/keys (app/api/internal/public-api/keys/route.ts)
- /api/internal/reconcile (app/api/internal/reconcile/route.ts)
- /api/internal/reprocess/payment-intent (app/api/internal/reprocess/payment-intent/route.ts)
- /api/internal/reprocess/purchase (app/api/internal/reprocess/purchase/route.ts)
- /api/internal/reprocess/stripe-event (app/api/internal/reprocess/stripe-event/route.ts)
- /api/internal/worker/operations (app/api/internal/worker/operations/route.ts)
- /api/organizacao/payouts/webhook (app/api/organizacao/payouts/webhook/route.ts)
- /api/stripe/webhook (app/api/stripe/webhook/route.ts)
- /api/webhooks/stripe (app/api/webhooks/stripe/route.ts)

## P0 endpoints coverage (docs/ssot_registry.md)
- Total: 62

### P0 missing files
- app/api/store/checkout/route.ts
- app/api/store/checkout/prefill/route.ts
- app/api/admin/payouts/list/route.ts
- app/api/admin/payouts/[id]/route.ts
- app/api/admin/payouts/[id]/block/route.ts
- app/api/admin/payouts/[id]/unblock/route.ts
- app/api/admin/payouts/[id]/cancel/route.ts
- app/api/admin/payouts/[id]/force-release/route.ts
- app/api/**/route.ts
- app/api/store/orders/invoice/route.ts

### P0 exempt (internal/cron/webhook)
- /api/organizacao/payouts/webhook (app/api/organizacao/payouts/webhook/route.ts)
- /api/internal/reconcile (app/api/internal/reconcile/route.ts)
- /api/internal/outbox/dlq (app/api/internal/outbox/dlq/route.ts)
- /api/internal/outbox/replay (app/api/internal/outbox/replay/route.ts)
- /api/internal/worker/operations (app/api/internal/worker/operations/route.ts)
- /api/internal/reprocess/purchase (app/api/internal/reprocess/purchase/route.ts)
- /api/internal/reprocess/payment-intent (app/api/internal/reprocess/payment-intent/route.ts)
- /api/internal/reprocess/stripe-event (app/api/internal/reprocess/stripe-event/route.ts)
- /api/internal/checkout/timeline (app/api/internal/checkout/timeline/route.ts)
- /api/internal/checkin/consume (app/api/internal/checkin/consume/route.ts)
- /api/cron/operations (app/api/cron/operations/route.ts)
- /api/cron/payouts/release (app/api/cron/payouts/release/route.ts)
- /api/stripe/webhook (app/api/stripe/webhook/route.ts)
- /api/webhooks/stripe (app/api/webhooks/stripe/route.ts)
- /api/internal/public-api/keys (app/api/internal/public-api/keys/route.ts)
- /api/cron/padel/expire (app/api/cron/padel/expire/route.ts)
- /api/internal/notifications/sweep (app/api/internal/notifications/sweep/route.ts)
- /api/cron/loyalty/expire (app/api/cron/loyalty/expire/route.ts)
- /api/cron/chat/maintenance (app/api/cron/chat/maintenance/route.ts)

### P0 covered by UI
- /api/payments/intent (files: app/components/checkout/Step2Pagamento.tsx, apps/mobile/features/checkout/api.ts)
- /api/checkout/status (files: app/components/checkout/Step3Sucesso.tsx, apps/mobile/features/checkout/api.ts)
- /api/checkout/resale (files: app/resale/[id]/page.tsx)
- /api/convites/[token]/checkout (files: app/convites/[token]/InviteClient.tsx)
- /api/cobrancas/[token]/checkout (files: app/cobrancas/[token]/ChargeClient.tsx)
- /api/servicos/[id]/checkout (files: app/[username]/_components/ReservasBookingClient.tsx, apps/mobile/app/checkout/index.tsx)
- /api/organizacao/reservas/[id]/checkout (files: app/organizacao/(dashboard)/reservas/page.tsx)
- /api/padel/pairings/[id]/checkout (files: apps/mobile/features/checkout/api.ts)
- /api/admin/payments/refund (files: app/admin/(protected)/finance/page.tsx, app/admin/(protected)/tickets/page.tsx)
- /api/admin/payments/dispute (files: app/admin/(protected)/finance/page.tsx)
- /api/admin/payments/reprocess (files: app/admin/(protected)/finance/page.tsx, app/admin/components/PaymentTools.tsx)
- /api/admin/refunds/list (files: app/admin/(protected)/finance/page.tsx)
- /api/admin/refunds/retry (files: app/admin/(protected)/finance/page.tsx)
- /api/organizacao/refunds/list (files: app/organizacao/pagamentos/RefundsPanel.tsx)
- /api/organizacao/payouts/status (files: app/organizacao/DashboardClient.tsx)
- /api/organizacao/payouts/list (files: app/organizacao/pagamentos/PayoutsPanel.tsx)
- /api/organizacao/payouts/summary (files: app/organizacao/DashboardClient.tsx)
- /api/organizacao/payouts/settings (files: lib/organizationId.ts)
- /api/organizacao/payouts/connect (files: app/organizacao/DashboardClient.tsx)
- /api/public/agenda (files: apps/mobile/features/profile/api.ts)
- /api/organizacao/checkin (files: app/components/checkin/CheckinScanner.tsx)
- /api/padel/pairings (files: app/components/checkout/Step1Bilhete.tsx, app/eventos/[slug]/EventPageClient.tsx, app/eventos/[slug]/PadelSignupInline.tsx, app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx, apps/mobile/features/tournaments/api.ts)
- /api/padel/calendar (files: app/organizacao/(dashboard)/padel/PadelHubClient.tsx)
- /api/me/store/purchases/[orderId]/invoice (files: apps/mobile/features/profile/api.ts)
- /api/me/location/consent (files: apps/mobile/features/onboarding/api.ts)
- /api/explorar/list (files: app/components/Navbar.tsx, app/descobrir/_explorar/ExplorarContent.tsx, apps/mobile/features/discover/api.ts)
- /api/eventos/list (files: apps/mobile/features/agora/api.ts)
- /api/me/events/signals (files: apps/mobile/features/events/signals.ts)
- /api/upload (files: app/components/profile/ProfileHeader.tsx, app/organizacao/(dashboard)/eventos/EventEditClient.tsx, app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx, app/organizacao/(dashboard)/eventos/novo/page.tsx, app/organizacao/(dashboard)/reservas/[id]/page.tsx, app/organizacao/(dashboard)/tournaments/[id]/live/page.tsx, app/organizacao/(dashboard)/treinadores/page.tsx, app/organizacao/OrganizationPublicProfilePanel.tsx, apps/mobile/lib/upload.ts, components/store/StoreProductImagesPanel.tsx, components/store/StoreProductsPanel.tsx)
- /api/upload/delete (files: app/components/profile/ProfileHeader.tsx, app/organizacao/(dashboard)/eventos/EventEditClient.tsx, app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx, app/organizacao/(dashboard)/eventos/novo/page.tsx, app/organizacao/(dashboard)/reservas/[id]/page.tsx, app/organizacao/(dashboard)/tournaments/[id]/live/page.tsx, app/organizacao/(dashboard)/treinadores/page.tsx, app/organizacao/OrganizationPublicProfilePanel.tsx, apps/mobile/lib/upload.ts, components/store/StoreProductImagesPanel.tsx, components/store/StoreProductsPanel.tsx)
- /api/chat/messages (files: app/organizacao/(dashboard)/chat/ChatInternoV2Client.tsx, app/organizacao/(dashboard)/chat/preview/useChatPreviewData.ts)
- /api/me/store/products/[id]/digital-assets (files: apps/mobile/features/profile/api.ts)
- /api/organizacao/loja/products/[id]/digital-assets (files: lib/organizationId.ts)

### P0 missing UI usage
- none
