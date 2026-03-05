# Runbook de Scripts Operacionais (Fase 3)

Data de referencia: 2026-02-24

## Objetivo

- Definir ownership, comando npm oficial e contexto operacional para cada script na allowlist ativa.
- Bloquear entrada de scripts sem catalogo atraves de gate automatico (`npm run gate:scripts-catalog`).

## Politica

- Fonte de verdade do catalogo: `scripts/manifests/operational_scripts_catalog_v1.json`.
- Fonte de ambientes permitidos: `scripts/manifests/operational_scripts_allowlist_v1.json`.
- Qualquer novo script operacional requer: owner definido, runbook, comando npm oficial e entrada no catalogo.

## Scripts Nao Conformes

- Resultado desta ronda: nenhum script nao conforme apos normalizacao do catalogo.

## Catalogo por Owner

### communications-realtime

| Script | Comando npm | Ambientes |
| --- | --- | --- |
| `scripts/chat-realtime-doctor.js` | `chat:doctor` | `dev,local` |
| `scripts/chat-ws-server.js` | `chat:ws` | `dev,prod` |

### content-brand

| Script | Comando npm | Ambientes |
| --- | --- | --- |
| `scripts/audit_api_ui_coverage.ts` | `gate:api-ui-coverage` | `ci,dev` |
| `scripts/covers/generate-thumbs.ts` | `covers:thumbs` | `dev,local` |
| `scripts/covers/sync-manifest.ts` | `covers:manifest` | `dev,local` |
| `scripts/covers/validate-manifest.ts` | `covers:validate` | `dev,local` |
| `scripts/fetch_openverse_covers.js` | `covers:fetch` | `dev,local` |
| `scripts/generate_cover_library.js` | `covers:build` | `dev,local` |
| `scripts/regenerate-logo-assets.mjs` | `logo:build` | `dev,local` |

### finance-core

| Script | Comando npm | Ambientes |
| --- | --- | --- |
| `scripts/finance_ledger_hygiene.mjs` | `finance:ledger-hygiene` | `dev,local` |
| `scripts/finance_operational_gate.mjs` | `gate:finance-ops` | `ci,dev` |
| `scripts/finance_prove_cycles.mjs` | `finance:prove-cycles` | `dev,local` |

### identity-access

| Script | Comando npm | Ambientes |
| --- | --- | --- |
| `scripts/generate-admin-totp-key.mjs` | `admin:totp-key` | `dev,local` |
| `scripts/generate-reserved-usernames.ts` | `usernames:generate-reserved` | `dev,local` |

### messaging-core

| Script | Comando npm | Ambientes |
| --- | --- | --- |
| `scripts/messages_purge_attachments_oneoff.ts` | `messages:purge-attachments:dry` | `dev,local` |

### platform-architecture

| Script | Comando npm | Ambientes |
| --- | --- | --- |
| `scripts/academy_hardcut_trainer_hygiene.ts` | `academy:hardcut:trainer-hygiene:dry` | `dev,local` |
| `scripts/audit_event_ticket_integrity.ts` | `audit:event-ticket-integrity` | `ci,dev` |
| `scripts/audit_padel_category_ticket_links.ts` | `audit:padel-category-ticket-links` | `ci,dev` |
| `scripts/audit_public_events.ts` | `audit:public-events` | `ci,dev` |
| `scripts/backfill_booking_confirmation_snapshots.ts` | `reservas:backfill-confirmation-snapshots:dry` | `dev,local` |
| `scripts/backfill_booking_court_snapshots.ts` | `reservas:backfill-court-snapshots:dry` | `dev,local` |
| `scripts/codemods/enforce-verified-auth.mjs` | `auth:codemod:enforce-verified` | `dev,local` |
| `scripts/convert_test_orgs_to_platform.ts` | `orgs:convert-test-platform` | `dev,local` |
| `scripts/crm/backfillPadelInteractions.ts` | `crm:backfill-padel:dry` | `dev,local` |
| `scripts/crm/rebuildCrmContacts.ts` | `crm:rebuild` | `dev,local` |
| `scripts/gate_auth_verified.mjs` | `gate:auth-verified` | `ci,dev` |
| `scripts/generate_api_ui_orphan_burndown_plan.mjs` | `report:api-ui-burndown` | `ci,dev` |
| `scripts/operational_scripts_allowlist_gate.mjs` | `gate:scripts-ops` | `ci,dev,local` |
| `scripts/operational_scripts_catalog_gate.mjs` | `gate:scripts-catalog` | `ci,dev,local` |
| `scripts/operational_data_integrity_gate.mjs` | `gate:data-integrity` | `dev,local` |
| `scripts/padel_backfill_tournament_capacity.ts` | `padel:capacity-backfill:dry` | `dev,local` |
| `scripts/reservas_seed_integrity_gate.ts` | `gate:reservas-seed-integrity` | `ci,dev,local` |
| `scripts/smoke_reservas_hybrid.ts` | `smoke:reservas:hybrid` | `dev,local` |
| `scripts/ssot_normative_gate.mjs` | `gate:ssot-normative` | `ci,dev` |
| `scripts/sync_api_ui_orphan_baseline.mjs` | `baseline:api-ui:sync` | `ci,dev` |
| `scripts/sync_ssot_p0_endpoints.mjs` | `ssot:p0:sync` | `ci,dev` |
| `scripts/uiux_gate.mjs` | `gate:ui-ux` | `ci,dev` |
| `scripts/uiux_surface_inventory.mjs` | `gate:ui-ux:inventory` | `ci,dev` |
| `scripts/v9_api_contract_gate.mjs` | `gate:api-contract` | `ci,dev` |
| `scripts/v9_api_frontend_mapping.mjs` | `v9:api-mapping` | `ci,dev` |
| `scripts/v9_api_ui_baseline_gate.mjs` | `gate:api-ui-baseline` | `ci,dev` |
| `scripts/v9_frontend_usage_hints_gate.mjs` | `gate:api-ui-hints` | `ci,dev` |
| `scripts/v9_generate_checklist.mjs` | `v9:checklist` | `ci,dev` |
| `scripts/v9_internal_secret_gate.mjs` | `gate:internal-secret` | `ci,dev` |
| `scripts/v9_inventory.mjs` | `v9:inventory` | `ci,dev` |
| `scripts/v9_org_context_gate.mjs` | `gate:org-context` | `ci,dev` |
| `scripts/v9_org_id_parser_gate.mjs` | `gate:org-id-parser` | `ci,dev` |
| `scripts/v9_p0_error_gate.mjs` | `gate:p0-errors` | `ci,dev` |
| `scripts/v9_p0_policy_gate.mjs` | `gate:p0-policy` | `ci,dev` |
| `scripts/v9_parity_gate.mjs` | `gate:parity` | `ci,dev` |
| `scripts/v9_readme_route_refs_gate.mjs` | `gate:readme-refs` | `ci,dev` |
| `scripts/v9_runbook_gate.mjs` | `gate:runbooks` | `ci,dev` |
| `scripts/v9_todo_gate.mjs` | `gate:todo` | `ci,dev` |
| `scripts/verify_schema_hygiene_smoke.ts` | `db:schema-hygiene:smoke` | `dev,local` |

### platform-data

| Script | Comando npm | Ambientes |
| --- | --- | --- |
| `scripts/check-db-env.js` | `db:env` | `dev,local` |
| `scripts/db/gates.js` | `db:gates` | `dev,local` |
| `scripts/db/preflight.js` | `db:preflight` | `dev,local` |
| `scripts/db/prisma-retry.js` | `db:generate` | `dev,local` |
| `scripts/db/resolve-public-dns.js` | `db:resolve-public-dns` | `dev,local` |
| `scripts/db/schema_hygiene_snapshot.mjs` | `db:schema-hygiene:snapshot` | `dev,local` |

### platform-infra

| Script | Comando npm | Ambientes |
| --- | --- | --- |
| `scripts/aws/pause-prod.sh` | `aws:prod:pause` | `dev,prod` |
| `scripts/aws/redis-start.sh` | `aws:prod:redis:start` | `dev,prod` |
| `scripts/aws/redis-stop.sh` | `aws:prod:redis:stop` | `dev,prod` |
| `scripts/aws/start-prod.sh` | `aws:prod:start` | `dev,prod` |
| `scripts/build-and-push.sh` | `deploy:build-push` | `dev,prod` |
| `scripts/deploy-cf.sh` | `deploy:cf` | `dev,prod` |
| `scripts/deploy-dev.sh` | `deploy:dev` | `dev,prod` |
| `scripts/healthcheck.sh` | `ops:healthcheck` | `dev,prod` |
| `scripts/prepare-secrets-json.sh` | `secrets:prepare-json` | `dev,prod` |
| `scripts/upload-secrets.sh` | `secrets:upload` | `dev,prod` |

### platform-runtime

| Script | Comando npm | Ambientes |
| --- | --- | --- |
| `scripts/codespaces-bootstrap.sh` | `codespace:setup` | `dev,local` |
| `scripts/cron-loop.js` | `cron:local` | `dev,prod` |
| `scripts/dev-all.js` | `dev:all` | `dev,local` |
| `scripts/load-env.js` | `db:env` | `dev,local` |
| `scripts/mobile-clean-cache.js` | `mobile:cache:clean` | `dev,local` |
| `scripts/operations-loop.js` | `worker` | `dev,prod` |
| `scripts/reset-dev-servers.sh` | `reset` | `dev,local` |
| `scripts/run-next-dev.mjs` | `dev:fast` | `dev,local` |
| `scripts/run-ts.cjs` | `usernames:generate-reserved` | `dev,local` |

### qa-automation

| Script | Comando npm | Ambientes |
| --- | --- | --- |
| `scripts/e2e/address_event_checklist.mjs` | `e2e:address:checklist` | `ci,local` |
| `scripts/e2e/ui_auth_bootstrap.mjs` | `e2e:ui:auth-bootstrap` | `ci,local` |
| `scripts/e2e/ui_seed_guard.mjs` | `e2e:ui:seed-guard` | `ci,local` |
| `scripts/run-playwright-ui.mjs` | `test:ui:web` | `ci,local` |
| `scripts/start-ui-e2e-server.mjs` | `test:ui:server:start` | `ci,local` |
| `scripts/test_hygiene_gate.mjs` | `gate:test-hygiene` | `ci,dev,local` |

## Detalhe por Script

### academy-hardcut-trainer-hygiene-ts

- Script: `scripts/academy_hardcut_trainer_hygiene.ts`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run academy:hardcut:trainer-hygiene:dry`
- Ambientes: `dev,local`

### audit-api-ui-coverage-ts

- Script: `scripts/audit_api_ui_coverage.ts`
- Owner: `content-brand`
- Comando npm oficial: `npm run gate:api-ui-coverage`
- Ambientes: `ci,dev`

### audit-event-ticket-integrity-ts

- Script: `scripts/audit_event_ticket_integrity.ts`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run audit:event-ticket-integrity`
- Ambientes: `ci,dev`

### audit-padel-category-ticket-links-ts

- Script: `scripts/audit_padel_category_ticket_links.ts`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run audit:padel-category-ticket-links`
- Ambientes: `ci,dev`

### audit-public-events-ts

- Script: `scripts/audit_public_events.ts`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run audit:public-events`
- Ambientes: `ci,dev`

### aws-pause-prod-sh

- Script: `scripts/aws/pause-prod.sh`
- Owner: `platform-infra`
- Comando npm oficial: `npm run aws:prod:pause`
- Ambientes: `dev,prod`

### aws-redis-start-sh

- Script: `scripts/aws/redis-start.sh`
- Owner: `platform-infra`
- Comando npm oficial: `npm run aws:prod:redis:start`
- Ambientes: `dev,prod`

### aws-redis-stop-sh

- Script: `scripts/aws/redis-stop.sh`
- Owner: `platform-infra`
- Comando npm oficial: `npm run aws:prod:redis:stop`
- Ambientes: `dev,prod`

### aws-start-prod-sh

- Script: `scripts/aws/start-prod.sh`
- Owner: `platform-infra`
- Comando npm oficial: `npm run aws:prod:start`
- Ambientes: `dev,prod`

### backfill-booking-confirmation-snapshots-ts

- Script: `scripts/backfill_booking_confirmation_snapshots.ts`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run reservas:backfill-confirmation-snapshots:dry`
- Ambientes: `dev,local`

### backfill-booking-court-snapshots-ts

- Script: `scripts/backfill_booking_court_snapshots.ts`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run reservas:backfill-court-snapshots:dry`
- Ambientes: `dev,local`

### build-and-push-sh

- Script: `scripts/build-and-push.sh`
- Owner: `platform-infra`
- Comando npm oficial: `npm run deploy:build-push`
- Ambientes: `dev,prod`

### chat-realtime-doctor-js

- Script: `scripts/chat-realtime-doctor.js`
- Owner: `communications-realtime`
- Comando npm oficial: `npm run chat:doctor`
- Ambientes: `dev,local`

### chat-ws-server-js

- Script: `scripts/chat-ws-server.js`
- Owner: `communications-realtime`
- Comando npm oficial: `npm run chat:ws`
- Ambientes: `dev,prod`

### check-db-env-js

- Script: `scripts/check-db-env.js`
- Owner: `platform-data`
- Comando npm oficial: `npm run db:env`
- Ambientes: `dev,local`

### codemods-enforce-verified-auth-mjs

- Script: `scripts/codemods/enforce-verified-auth.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run auth:codemod:enforce-verified`
- Ambientes: `dev,local`

### convert-test-orgs-to-platform-ts

- Script: `scripts/convert_test_orgs_to_platform.ts`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run orgs:convert-test-platform`
- Ambientes: `dev,local`

### codespaces-bootstrap-sh

- Script: `scripts/codespaces-bootstrap.sh`
- Owner: `platform-runtime`
- Comando npm oficial: `npm run codespace:setup`
- Ambientes: `dev,local`

### covers-generate-thumbs-ts

- Script: `scripts/covers/generate-thumbs.ts`
- Owner: `content-brand`
- Comando npm oficial: `npm run covers:thumbs`
- Ambientes: `dev,local`

### covers-sync-manifest-ts

- Script: `scripts/covers/sync-manifest.ts`
- Owner: `content-brand`
- Comando npm oficial: `npm run covers:manifest`
- Ambientes: `dev,local`

### covers-validate-manifest-ts

- Script: `scripts/covers/validate-manifest.ts`
- Owner: `content-brand`
- Comando npm oficial: `npm run covers:validate`
- Ambientes: `dev,local`

### crm-backfill-padel-interactions-ts

- Script: `scripts/crm/backfillPadelInteractions.ts`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run crm:backfill-padel:dry`
- Ambientes: `dev,local`

### crm-rebuild-crm-contacts-ts

- Script: `scripts/crm/rebuildCrmContacts.ts`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run crm:rebuild`
- Ambientes: `dev,local`

### prepare-secrets-json-sh

- Script: `scripts/prepare-secrets-json.sh`
- Owner: `platform-infra`
- Comando npm oficial: `npm run secrets:prepare-json`
- Ambientes: `dev,prod`

### cron-loop-js

- Script: `scripts/cron-loop.js`
- Owner: `platform-runtime`
- Comando npm oficial: `npm run cron:local`
- Ambientes: `dev,prod`

### db-gates-js

- Script: `scripts/db/gates.js`
- Owner: `platform-data`
- Comando npm oficial: `npm run db:gates`
- Ambientes: `dev,local`

### db-preflight-js

- Script: `scripts/db/preflight.js`
- Owner: `platform-data`
- Comando npm oficial: `npm run db:preflight`
- Ambientes: `dev,local`

### db-prisma-retry-js

- Script: `scripts/db/prisma-retry.js`
- Owner: `platform-data`
- Comando npm oficial: `npm run db:generate`
- Ambientes: `dev,local`

### db-resolve-public-dns-js

- Script: `scripts/db/resolve-public-dns.js`
- Owner: `platform-data`
- Comando npm oficial: `npm run db:resolve-public-dns`
- Ambientes: `dev,local`

### db-schema-hygiene-snapshot-mjs

- Script: `scripts/db/schema_hygiene_snapshot.mjs`
- Owner: `platform-data`
- Comando npm oficial: `npm run db:schema-hygiene:snapshot`
- Ambientes: `dev,local`

### deploy-cf-sh

- Script: `scripts/deploy-cf.sh`
- Owner: `platform-infra`
- Comando npm oficial: `npm run deploy:cf`
- Ambientes: `dev,prod`

### deploy-dev-sh

- Script: `scripts/deploy-dev.sh`
- Owner: `platform-infra`
- Comando npm oficial: `npm run deploy:dev`
- Ambientes: `dev,prod`

### dev-all-js

- Script: `scripts/dev-all.js`
- Owner: `platform-runtime`
- Comando npm oficial: `npm run dev:all`
- Ambientes: `dev,local`

### e2e-address-event-checklist-mjs

- Script: `scripts/e2e/address_event_checklist.mjs`
- Owner: `qa-automation`
- Comando npm oficial: `npm run e2e:address:checklist`
- Ambientes: `ci,local`

### e2e-ui-auth-bootstrap-mjs

- Script: `scripts/e2e/ui_auth_bootstrap.mjs`
- Owner: `qa-automation`
- Comando npm oficial: `npm run e2e:ui:auth-bootstrap`
- Ambientes: `ci,local`

### e2e-ui-seed-guard-mjs

- Script: `scripts/e2e/ui_seed_guard.mjs`
- Owner: `qa-automation`
- Comando npm oficial: `npm run e2e:ui:seed-guard`
- Ambientes: `ci,local`

### fetch-openverse-covers-js

- Script: `scripts/fetch_openverse_covers.js`
- Owner: `content-brand`
- Comando npm oficial: `npm run covers:fetch`
- Ambientes: `dev,local`

### finance-ledger-hygiene-mjs

- Script: `scripts/finance_ledger_hygiene.mjs`
- Owner: `finance-core`
- Comando npm oficial: `npm run finance:ledger-hygiene`
- Ambientes: `dev,local`

### finance-operational-gate-mjs

- Script: `scripts/finance_operational_gate.mjs`
- Owner: `finance-core`
- Comando npm oficial: `npm run gate:finance-ops`
- Ambientes: `ci,dev`

### finance-prove-cycles-mjs

- Script: `scripts/finance_prove_cycles.mjs`
- Owner: `finance-core`
- Comando npm oficial: `npm run finance:prove-cycles`
- Ambientes: `dev,local`

### gate-auth-verified-mjs

- Script: `scripts/gate_auth_verified.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run gate:auth-verified`
- Ambientes: `ci,dev`

### generate-admin-totp-key-mjs

- Script: `scripts/generate-admin-totp-key.mjs`
- Owner: `identity-access`
- Comando npm oficial: `npm run admin:totp-key`
- Ambientes: `dev,local`

### generate-reserved-usernames-ts

- Script: `scripts/generate-reserved-usernames.ts`
- Owner: `identity-access`
- Comando npm oficial: `npm run usernames:generate-reserved`
- Ambientes: `dev,local`

### generate-api-ui-orphan-burndown-plan-mjs

- Script: `scripts/generate_api_ui_orphan_burndown_plan.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run report:api-ui-burndown`
- Ambientes: `ci,dev`

### generate-cover-library-js

- Script: `scripts/generate_cover_library.js`
- Owner: `content-brand`
- Comando npm oficial: `npm run covers:build`
- Ambientes: `dev,local`

### healthcheck-sh

- Script: `scripts/healthcheck.sh`
- Owner: `platform-infra`
- Comando npm oficial: `npm run ops:healthcheck`
- Ambientes: `dev,prod`

### load-env-js

- Script: `scripts/load-env.js`
- Owner: `platform-runtime`
- Comando npm oficial: `npm run db:env`
- Ambientes: `dev,local`

### messages-purge-attachments-oneoff-ts

- Script: `scripts/messages_purge_attachments_oneoff.ts`
- Owner: `messaging-core`
- Comando npm oficial: `npm run messages:purge-attachments:dry`
- Ambientes: `dev,local`

### mobile-clean-cache-js

- Script: `scripts/mobile-clean-cache.js`
- Owner: `platform-runtime`
- Comando npm oficial: `npm run mobile:cache:clean`
- Ambientes: `dev,local`

### operational-scripts-allowlist-gate-mjs

- Script: `scripts/operational_scripts_allowlist_gate.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run gate:scripts-ops`
- Ambientes: `ci,dev,local`

### operational-scripts-catalog-gate-mjs

- Script: `scripts/operational_scripts_catalog_gate.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run gate:scripts-catalog`
- Ambientes: `ci,dev,local`

### operational-data-integrity-gate-mjs

- Script: `scripts/operational_data_integrity_gate.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run gate:data-integrity`
- Ambientes: `dev,local`

### operations-loop-js

- Script: `scripts/operations-loop.js`
- Owner: `platform-runtime`
- Comando npm oficial: `npm run worker`
- Ambientes: `dev,prod`

### padel-backfill-tournament-capacity-ts

- Script: `scripts/padel_backfill_tournament_capacity.ts`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run padel:capacity-backfill:dry`
- Ambientes: `dev,local`

### regenerate-logo-assets-mjs

- Script: `scripts/regenerate-logo-assets.mjs`
- Owner: `content-brand`
- Comando npm oficial: `npm run logo:build`
- Ambientes: `dev,local`

### reservas-seed-integrity-gate-ts

- Script: `scripts/reservas_seed_integrity_gate.ts`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run gate:reservas-seed-integrity`
- Ambientes: `ci,dev,local`

### reset-dev-servers-sh

- Script: `scripts/reset-dev-servers.sh`
- Owner: `platform-runtime`
- Comando npm oficial: `npm run reset`
- Ambientes: `dev,local`

### run-next-dev-mjs

- Script: `scripts/run-next-dev.mjs`
- Owner: `platform-runtime`
- Comando npm oficial: `npm run dev:fast`
- Ambientes: `dev,local`

### run-playwright-ui-mjs

- Script: `scripts/run-playwright-ui.mjs`
- Owner: `qa-automation`
- Comando npm oficial: `npm run test:ui:web`
- Ambientes: `ci,local`

### run-ts-cjs

- Script: `scripts/run-ts.cjs`
- Owner: `platform-runtime`
- Comando npm oficial: `npm run usernames:generate-reserved`
- Ambientes: `dev,local`

### smoke-reservas-hybrid-ts

- Script: `scripts/smoke_reservas_hybrid.ts`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run smoke:reservas:hybrid`
- Ambientes: `dev,local`

### ssot-normative-gate-mjs

- Script: `scripts/ssot_normative_gate.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run gate:ssot-normative`
- Ambientes: `ci,dev`

### start-ui-e2e-server-mjs

- Script: `scripts/start-ui-e2e-server.mjs`
- Owner: `qa-automation`
- Comando npm oficial: `npm run test:ui:server:start`
- Ambientes: `ci,local`

### sync-api-ui-orphan-baseline-mjs

- Script: `scripts/sync_api_ui_orphan_baseline.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run baseline:api-ui:sync`
- Ambientes: `ci,dev`

### sync-ssot-p0-endpoints-mjs

- Script: `scripts/sync_ssot_p0_endpoints.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run ssot:p0:sync`
- Ambientes: `ci,dev`

### test-hygiene-gate-mjs

- Script: `scripts/test_hygiene_gate.mjs`
- Owner: `qa-automation`
- Comando npm oficial: `npm run gate:test-hygiene`
- Ambientes: `ci,dev,local`

### uiux-gate-mjs

- Script: `scripts/uiux_gate.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run gate:ui-ux`
- Ambientes: `ci,dev`

### uiux-surface-inventory-mjs

- Script: `scripts/uiux_surface_inventory.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run gate:ui-ux:inventory`
- Ambientes: `ci,dev`

### upload-secrets-sh

- Script: `scripts/upload-secrets.sh`
- Owner: `platform-infra`
- Comando npm oficial: `npm run secrets:upload`
- Ambientes: `dev,prod`

### v9-api-contract-gate-mjs

- Script: `scripts/v9_api_contract_gate.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run gate:api-contract`
- Ambientes: `ci,dev`

### v9-api-frontend-mapping-mjs

- Script: `scripts/v9_api_frontend_mapping.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run v9:api-mapping`
- Ambientes: `ci,dev`

### v9-api-ui-baseline-gate-mjs

- Script: `scripts/v9_api_ui_baseline_gate.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run gate:api-ui-baseline`
- Ambientes: `ci,dev`

### v9-frontend-usage-hints-gate-mjs

- Script: `scripts/v9_frontend_usage_hints_gate.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run gate:api-ui-hints`
- Ambientes: `ci,dev`

### v9-generate-checklist-mjs

- Script: `scripts/v9_generate_checklist.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run v9:checklist`
- Ambientes: `ci,dev`

### v9-internal-secret-gate-mjs

- Script: `scripts/v9_internal_secret_gate.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run gate:internal-secret`
- Ambientes: `ci,dev`

### v9-inventory-mjs

- Script: `scripts/v9_inventory.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run v9:inventory`
- Ambientes: `ci,dev`

### v9-org-context-gate-mjs

- Script: `scripts/v9_org_context_gate.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run gate:org-context`
- Ambientes: `ci,dev`

### v9-org-id-parser-gate-mjs

- Script: `scripts/v9_org_id_parser_gate.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run gate:org-id-parser`
- Ambientes: `ci,dev`

### v9-p0-error-gate-mjs

- Script: `scripts/v9_p0_error_gate.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run gate:p0-errors`
- Ambientes: `ci,dev`

### v9-p0-policy-gate-mjs

- Script: `scripts/v9_p0_policy_gate.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run gate:p0-policy`
- Ambientes: `ci,dev`

### v9-parity-gate-mjs

- Script: `scripts/v9_parity_gate.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run gate:parity`
- Ambientes: `ci,dev`

### v9-readme-route-refs-gate-mjs

- Script: `scripts/v9_readme_route_refs_gate.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run gate:readme-refs`
- Ambientes: `ci,dev`

### v9-runbook-gate-mjs

- Script: `scripts/v9_runbook_gate.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run gate:runbooks`
- Ambientes: `ci,dev`

### v9-todo-gate-mjs

- Script: `scripts/v9_todo_gate.mjs`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run gate:todo`
- Ambientes: `ci,dev`

### verify-schema-hygiene-smoke-ts

- Script: `scripts/verify_schema_hygiene_smoke.ts`
- Owner: `platform-architecture`
- Comando npm oficial: `npm run db:schema-hygiene:smoke`
- Ambientes: `dev,local`
