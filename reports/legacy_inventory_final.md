# Legacy Inventory Final Snapshot

Generated at: 2026-02-12T14:57:34Z (UTC)

## Runtime hard-cut checks
- `swap_confirm_route=absent` (`app/api/padel/pairings/swap/confirm/[token]/route.ts` removed)
- No runtime references found for:
  - `isStorePublic`
  - `canCheckoutStore`
  - `legacyStale`
  - `mapLegacyStatusToV7`
  (only guardrail tests reference these tokens as negative checks)

## Inventory artifacts
- `reports/v9_inventory_api_v1.md`
- `reports/v9_inventory_features_v1.md`
- `reports/v9_inventory_frontend_api_usage_v1.md`
- `reports/v9_inventory_pages_v1.md`

## Parity/coverage artifacts
- `reports/v9_parity_report_v1.md`
- `reports/v9_api_frontend_mapping_report_v1.md`
- `reports/v9_api_frontend_mapping_v1.csv`
