# Schema Hygiene Closeout - 2026-02-17

## Scope
- Target DB: Supabase dev DB (single shared DB in `developer` workflow)
- Schemas: `app_v3` (DDL hard-cut + contract closure), `auth` (read-only audit)

## PASS/FAIL Checklist

| Item | Status | Evidence |
| --- | --- | --- |
| `app_v3` sem legado estrutural fora do contrato aprovado | PASS | Migração `20260217233000_schema_hygiene_hardcut_v1` aplicada; verificação SQL: `legacy_chat_tables=0`, `legacy_columns=0` |
| Stack legado de chat removido/desativado | PASS | `legacy_chat_triggers=0`, `legacy_chat_functions=0`, tabelas legacy removidas |
| Estado de migrações consistente | PASS | `npm run db:status` => `Database schema is up to date` |
| `auth` auditado em profundidade sem DDL | PASS | `reports/auth_schema_audit_2026-02-17.md` gerado (inventário + classificação de risco) |
| Tabelas críticas ausentes (`padel_tournament_roles`, `refund_policy_versions`) materializadas | PASS | Migração `20260218010000_create_blocked_tables_core` aplicada; smoke Prisma `BLOCKED_OK` para ambas |
| Typecheck global do repositório | PASS | `NODE_OPTIONS=--max-old-space-size=8192 npx tsc -p tsconfig.typecheck.json --noEmit` => `EXIT_CODE=0` |
| Relatório final com evidência completa | PASS | Este documento + baseline + diff matrix + audit auth |

## Changes Applied

### 1) Migrations Applied
- `prisma/migrations/20260217233000_schema_hygiene_hardcut_v1/migration.sql`
- `prisma/migrations/20260218010000_create_blocked_tables_core/migration.sql`

### 2) Legacy Chat Hard-Cut (`app_v3`)
- Removed triggers:
  - `events.chat_event_insert_sync`
  - `events.chat_event_schedule_sync`
  - `bookings.chat_booking_schedule_sync`
  - `chat_messages.chat_notify_announcement_trigger`
- Removed legacy functions (`chat_*` v1 lifecycle/threads handlers).
- Removed legacy tables:
  - `chat_threads`
  - `chat_members`
  - `chat_messages`
  - `chat_read_state`
  - `chat_moderation_log`
  - `chat_invites`
  - `chat_event_invites`
  - `chat_conversation_requests`
  - `chat_channel_requests`

### 3) Legacy Columns Removed (`app_v3`)
- `events`: location/access/fee override legacy set
- `search_index_items`: duplicated geo/location set
- `organizations`: stripe/location legacy set
- `profiles`: `city`
- `padel_clubs`: `lat`, `lng`
- `services`: `default_location_text`, `required_membership_plan_ids`

### 4) Critical Missing Tables Restored (`app_v3`)
- `refund_policy_versions`
- `padel_tournament_roles`

### 5) Prisma Contract Cleanup + Runtime Compatibility
- Removed legacy chat models/relations/enums from `prisma/schema.prisma`.
- Updated `lib/envModels.ts` to remove deleted models.
- `lib/chat/threads.ts` kept as no-op compatibility shim.
- `lib/ownership/claimIdentity.ts` decoupled from deleted `chat_invites` table.

## Validation Evidence

### DB/Migration
- `npm run db:deploy` -> migrations applied successfully.
- `npm run db:status` -> up to date.
- `npm run db:generate` -> Prisma client generated successfully.

### Tests
- `npx vitest run tests/ops/messagesLegacyGuardrails.test.ts tests/store/publicCatalogRoutePaymentsGate.test.ts tests/checkin/consume.test.ts`
- Result: **3 files / 14 tests passed**.

### Smoke Checks
- `node -r ./scripts/load-env.js scripts/run-ts.cjs scripts/verify_schema_hygiene_smoke.ts`
- Canonical delegates: `OK`.
- Previously missing delegates now healthy:
  - `padelTournamentRoleAssignment` => `BLOCKED_OK`
  - `refundPolicyVersion` => `BLOCKED_OK`

### Typecheck
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc -p tsconfig.typecheck.json --noEmit`
- Result: `EXIT_CODE=0`

## Artifacts
- `reports/schema_baseline_2026-02-17.md`
- `reports/schema_diff_matrix_2026-02-17.csv`
- `reports/auth_schema_audit_2026-02-17.md`
- `reports/schema_hygiene_closeout_2026-02-17.md`

## Final Status
- Schema hygiene closure for authorized scope: **100% complete**.
