# API <-> UI Coverage Report

Generated: 2026-02-23T14:10:59.475Z
CSV: reports/api_ui_coverage_v1.csv

## Summary
- API routes total: 499
- Covered by UI: 434
- Orphan (no UI): 14
- Orphan baseline: 3
- Orphan (new): 11
- Orphan allowlisted: 3
- Exempt (internal/cron/webhook): 48
- UI endpoints missing API: 0
- UI coverage hints (routes): 30

## UI endpoints missing API routes
- none

## UI endpoints treated as base templates (not API routes)
- /api/org (files: lib/canonicalOrgApiPath.ts)
- /api/org-system (files: lib/canonicalOrgApiPath.ts)
- /api/public/store (files: apps/mobile/lib/api.ts)

## UI coverage hints applied
- /api/org/[param]/store/bundles (files: app/org/[orgId]/store/OrgStoreToolClient.tsx, components/store/StoreBundleItemsPanel.tsx, components/store/StoreBundlesPanel.tsx)
- /api/org/[param]/store/bundles/[param] (files: components/store/StoreBundlesPanel.tsx)
- /api/org/[param]/store/bundles/[param]/items (files: components/store/StoreBundleItemsPanel.tsx, components/store/StoreBundlesPanel.tsx)
- /api/org/[param]/store/bundles/[param]/items/[param] (files: components/store/StoreBundleItemsPanel.tsx)
- /api/org/[param]/store/categories (files: app/org/[orgId]/store/OrgStoreToolClient.tsx, components/store/StoreCategoriesPanel.tsx, components/store/StoreProductsPanel.tsx)
- /api/org/[param]/store/categories/[param] (files: components/store/StoreCategoriesPanel.tsx)
- /api/org/[param]/store/orders (files: app/org/[orgId]/store/OrgStoreToolClient.tsx, components/store/StoreOrdersPanel.tsx)
- /api/org/[param]/store/orders/[param] (files: components/store/StoreOrdersPanel.tsx)
- /api/org/[param]/store/orders/[param]/shipments (files: components/store/StoreOrdersPanel.tsx)
- /api/org/[param]/store/overview (files: app/org/[orgId]/store/OrgStoreToolClient.tsx, components/store/StoreOverviewPanel.tsx)
- /api/org/[param]/store/products (files: app/org/[orgId]/store/OrgStoreToolClient.tsx, components/store/StoreProductDigitalAssetsPanel.tsx, components/store/StoreProductImagesPanel.tsx, components/store/StoreProductOptionValuesPanel.tsx, components/store/StoreProductOptionsPanel.tsx, components/store/StoreProductVariantsPanel.tsx, components/store/StoreProductsPanel.tsx)
- /api/org/[param]/store/products/[param] (files: components/store/StoreProductsPanel.tsx)
- /api/org/[param]/store/products/[param]/digital-assets (files: components/store/StoreProductDigitalAssetsPanel.tsx, components/store/StoreProductsPanel.tsx)
- /api/org/[param]/store/products/[param]/digital-assets/[param] (files: components/store/StoreProductDigitalAssetsPanel.tsx)
- /api/org/[param]/store/products/[param]/images (files: components/store/StoreProductImagesPanel.tsx, components/store/StoreProductsPanel.tsx)
- /api/org/[param]/store/products/[param]/images/[param] (files: components/store/StoreProductImagesPanel.tsx)
- /api/org/[param]/store/products/[param]/options (files: components/store/StoreProductOptionsPanel.tsx, components/store/StoreProductsPanel.tsx)
- /api/org/[param]/store/products/[param]/options/[param] (files: components/store/StoreProductOptionsPanel.tsx, components/store/StoreProductsPanel.tsx)
- /api/org/[param]/store/products/[param]/options/[param]/values (files: components/store/StoreProductOptionValuesPanel.tsx)
- /api/org/[param]/store/products/[param]/options/[param]/values/[param] (files: components/store/StoreProductOptionValuesPanel.tsx)
- /api/org/[param]/store/products/[param]/variants (files: components/store/StoreBundleItemsPanel.tsx, components/store/StoreProductVariantsPanel.tsx, components/store/StoreProductsPanel.tsx)
- /api/org/[param]/store/products/[param]/variants/[param] (files: components/store/StoreProductVariantsPanel.tsx, components/store/StoreProductsPanel.tsx)
- /api/org/[param]/store/shipments/[param] (files: components/store/StoreOrdersPanel.tsx)
- /api/org/[param]/store/shipping/methods/[param] (files: components/store/StoreShippingMethodsPanel.tsx, components/store/StoreShippingSettingsPanel.tsx)
- /api/org/[param]/store/shipping/methods/[param]/tiers (files: components/store/StoreShippingTiersPanel.tsx)
- /api/org/[param]/store/shipping/settings (files: app/org/[orgId]/store/OrgStoreToolClient.tsx, components/store/StoreShippingSettingsPanel.tsx)
- /api/org/[param]/store/shipping/tiers/[param] (files: components/store/StoreShippingTiersPanel.tsx)
- /api/org/[param]/store/shipping/zones (files: app/org/[orgId]/store/OrgStoreToolClient.tsx, components/store/StoreShippingMethodsPanel.tsx, components/store/StoreShippingSettingsPanel.tsx, components/store/StoreShippingTiersPanel.tsx, components/store/StoreShippingZonesPanel.tsx)
- /api/org/[param]/store/shipping/zones/[param] (files: components/store/StoreShippingSettingsPanel.tsx, components/store/StoreShippingZonesPanel.tsx)
- /api/org/[param]/store/shipping/zones/[param]/methods (files: components/store/StoreShippingMethodsPanel.tsx, components/store/StoreShippingSettingsPanel.tsx, components/store/StoreShippingTiersPanel.tsx)

## API routes without UI usage (new, excluding internal/cron/webhook)
- /api/org/[orgId]/padel/broadcast (app/api/org/[orgId]/padel/broadcast/route.ts)
- /api/org/[orgId]/padel/courts (app/api/org/[orgId]/padel/courts/route.ts)
- /api/org/[orgId]/padel/pairings/swap (app/api/org/[orgId]/padel/pairings/swap/route.ts)
- /api/padel/live (app/api/padel/live/route.ts)
- /api/padel/matches/[id]/delay (app/api/padel/matches/[id]/delay/route.ts)
- /api/padel/pairings/[id]/cancel (app/api/padel/pairings/[id]/cancel/route.ts)
- /api/padel/pairings/[id]/reopen (app/api/padel/pairings/[id]/reopen/route.ts)
- /api/padel/public/calendar (app/api/padel/public/calendar/route.ts)
- /api/padel/tournaments/tier-approvals/[id]/approve (app/api/padel/tournaments/tier-approvals/[id]/approve/route.ts)
- /api/padel/tournaments/tier-approvals/[id]/reject (app/api/padel/tournaments/tier-approvals/[id]/reject/route.ts)
- /api/padel/tournaments/tier-approvals/request (app/api/padel/tournaments/tier-approvals/request/route.ts)

## API orphan baseline matches
- /api/me/dsar/export (app/api/me/dsar/export/route.ts)
- /api/me/wallet/[entitlementId]/pass (app/api/me/wallet/[entitlementId]/pass/route.ts)
- /api/upload/delete (app/api/upload/delete/route.ts)

## API orphan allowlist matches
- /api/auth/clear (app/api/auth/clear/route.ts)
- /api/messages/attachments/presign (app/api/messages/attachments/presign/route.ts)
- /api/messages/messages/[messageId]/report (app/api/messages/messages/[messageId]/report/route.ts)

## Exempt routes (internal/cron/webhook)
- /api/cron/analytics/rollup (app/api/cron/analytics/rollup/route.ts)
- /api/cron/bookings/cleanup (app/api/cron/bookings/cleanup/route.ts)
- /api/cron/bookings/split-garantido (app/api/cron/bookings/split-garantido/route.ts)
- /api/cron/creditos/expire (app/api/cron/creditos/expire/route.ts)
- /api/cron/crm/campanhas (app/api/cron/crm/campanhas/route.ts)
- /api/cron/crm/rebuild (app/api/cron/crm/rebuild/route.ts)
- /api/cron/entitlements/qr-cleanup (app/api/cron/entitlements/qr-cleanup/route.ts)
- /api/cron/loyalty/expire (app/api/cron/loyalty/expire/route.ts)
- /api/cron/operations (app/api/cron/operations/route.ts)
- /api/cron/padel/arbitration-compensation (app/api/cron/padel/arbitration-compensation/route.ts)
- /api/cron/padel/expire (app/api/cron/padel/expire/route.ts)
- /api/cron/padel/matchmaking (app/api/cron/padel/matchmaking/route.ts)
- /api/cron/padel/partnership-grants/revoke (app/api/cron/padel/partnership-grants/revoke/route.ts)
- /api/cron/padel/reminders (app/api/cron/padel/reminders/route.ts)
- /api/cron/padel/split-reminders (app/api/cron/padel/split-reminders/route.ts)
- /api/cron/padel/tournament-eve (app/api/cron/padel/tournament-eve/route.ts)
- /api/cron/padel/waitlist (app/api/cron/padel/waitlist/route.ts)
- /api/cron/repair-usernames (app/api/cron/repair-usernames/route.ts)
- /api/cron/reservations/cleanup (app/api/cron/reservations/cleanup/route.ts)
- /api/internal/audit (app/api/internal/audit/route.ts)
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
- /api/internal/ops/padel/backfill (app/api/internal/ops/padel/backfill/route.ts)
- /api/internal/ops/padel/cleanup (app/api/internal/ops/padel/cleanup/route.ts)
- /api/internal/ops/padel/integrity (app/api/internal/ops/padel/integrity/route.ts)
- /api/internal/ops/padel/workforce-hygiene (app/api/internal/ops/padel/workforce-hygiene/route.ts)
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
- /api/org-system/payouts/webhook (app/api/org-system/payouts/webhook/route.ts)
- /api/stripe/webhook (app/api/stripe/webhook/route.ts)
- /api/webhooks/stripe (app/api/webhooks/stripe/route.ts)

## P0 endpoints coverage (scripts/manifests/p0_endpoints.json)
- Total: 35
- Active (UI expected): 35

### P0 missing files
- none

### P0 exempt (internal/cron/webhook)
- /api/org-system/payouts/webhook (app/api/org-system/payouts/webhook/route.ts)
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
- /api/stripe/webhook (app/api/stripe/webhook/route.ts)
- /api/webhooks/stripe (app/api/webhooks/stripe/route.ts)

### P0 covered by UI
- /api/payments/intent (files: app/components/checkout/Step2Pagamento.tsx, apps/mobile/features/checkout/api.ts)
- /api/checkout/status (files: app/components/checkout/Step3Sucesso.tsx, apps/mobile/features/checkout/api.ts)
- /api/checkout/resale (files: app/resale/[id]/page.tsx)
- /api/convites/[token]/checkout (files: app/convites/[token]/InviteClient.tsx)
- /api/cobrancas/[token]/checkout (files: app/cobrancas/[token]/ChargeClient.tsx)
- /api/servicos/[id]/checkout (files: app/[username]/_components/ReservasBookingClient.tsx, apps/mobile/app/checkout/index.tsx)
- /api/org/[orgId]/reservas/[id]/checkout (files: app/org/_internal/core/(dashboard)/reservas/page.tsx)
- /api/padel/pairings/[id]/checkout (files: apps/mobile/features/checkout/api.ts)
- /api/public/store/checkout (files: apps/mobile/features/store/api.ts, components/storefront/StorefrontCheckoutClient.tsx)
- /api/admin/payments/refund (files: app/admin/(protected)/finance/page.tsx, app/admin/(protected)/tickets/page.tsx)
- /api/admin/payments/dispute (files: app/admin/(protected)/finance/page.tsx)
- /api/admin/payments/reprocess (files: app/admin/(protected)/finance/page.tsx, app/admin/components/PaymentTools.tsx)
- /api/admin/refunds/list (files: app/admin/(protected)/finance/page.tsx)
- /api/admin/refunds/retry (files: app/admin/(protected)/finance/page.tsx)
- /api/org/[orgId]/refunds/list (files: app/org/_internal/core/pagamentos/RefundsPanel.tsx)
- /api/org/[orgId]/events/[id]/refund (files: app/org/_internal/core/(dashboard)/eventos/[id]/EventAttendeesPanel.tsx)
- /api/padel/matches/[id]/dispute (files: app/[username]/padel/PadelDisputeButton.tsx, app/org/_internal/core/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx, app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx)
- /api/org/[orgId]/finance/payouts/status (files: app/org/_internal/core/DashboardClient.tsx)
- /api/org/[orgId]/finance/payouts/list (files: app/org/_internal/core/pagamentos/PayoutsPanel.tsx)
- /api/org/[orgId]/finance/payouts/summary (files: app/org/_internal/core/DashboardClient.tsx)
- /api/org/[orgId]/finance/payouts/settings (files: app/org/_internal/core/DashboardClient.tsx)
- /api/org/[orgId]/finance/payouts/connect (files: app/org/_internal/core/DashboardClient.tsx)

### P0 missing UI usage allowlisted
- none

### P0 missing UI usage
- none
