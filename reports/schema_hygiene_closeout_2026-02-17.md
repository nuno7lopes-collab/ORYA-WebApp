# Schema Hygiene Closeout - 2026-02-17

## Scope
- Target DB: Supabase dev DB (single shared DB in `developer` workflow)
- Schemas: `app_v3` (DDL hard-cut), `auth` (read-only audit)
- Hard locks preserved: `app_v3.padel_tournament_roles`, `app_v3.refund_policy_versions`

## PASS/FAIL Checklist

| Item | Status | Evidence |
| --- | --- | --- |
| `app_v3` sem legado estrutural fora do contrato aprovado (exceto locks) | PASS | Migração `20260217233000_schema_hygiene_hardcut_v1` aplicada; verificação SQL: `LEGACY_TABLES_REMAINING=0`, `LEGACY_COLS_REMAINING=0` |
| Stack legado de chat removido/desativado | PASS | `LEGACY_CHAT_TRIGGERS_REMAINING=0`, `LEGACY_CHAT_FUNCTIONS_REMAINING=0`, tabelas legacy removidas |
| Estado de migrações consistente | PASS | `npm run db:deploy` aplicou migração; `npm run db:status` => `Database schema is up to date` |
| `auth` auditado em profundidade sem DDL | PASS | `reports/auth_schema_audit_2026-02-17.md` gerado (inventário + classificação de risco) |
| Relatório final com bloqueios explícitos | PASS | Este documento + `reports/schema_baseline_2026-02-17.md` + `reports/schema_diff_matrix_2026-02-17.csv` |

## Changes Applied

### 1) Migration Applied
- `prisma/migrations/20260217233000_schema_hygiene_hardcut_v1/migration.sql`

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
- `events`: location/access/fee override legacy set (19 cols)
- `search_index_items`: duplicated geo/location set (7 cols)
- `organizations`: stripe/location legacy set (7 cols)
- `profiles`: `city`
- `padel_clubs`: `lat`, `lng`
- `services`: `default_location_text`, `required_membership_plan_ids`

### 4) Prisma Contract Cleanup
- Removed legacy chat models and relations from `prisma/schema.prisma`.
- Removed legacy chat enums no longer used.
- Updated `lib/envModels.ts` to remove deleted Prisma models.
- Preserved lock exceptions (`PadelTournamentRoleAssignment` / `RefundPolicyVersion`) untouched.

### 5) Runtime Compatibility Adjustments
- `lib/chat/threads.ts`: retained API as no-op compatibility shim after legacy thread removal.
- `lib/ownership/claimIdentity.ts`: removed dependency on deleted `chat_invites` table path (legacy moved count fixed to `0`).

## Validation Evidence

### DB/Migration
- `npm run db:deploy` -> migration applied successfully.
- `npm run db:status` -> up to date.
- `npm run db:generate` -> Prisma client generated successfully.

### Tests
- `npx vitest run tests/ops/messagesLegacyGuardrails.test.ts tests/store/publicCatalogRoutePaymentsGate.test.ts tests/checkin/consume.test.ts`
- Result: **3 files / 14 tests passed**.

### Smoke Checks
- `node -r ./scripts/load-env.js scripts/run-ts.cjs scripts/verify_schema_hygiene_smoke.ts`
- Canonical delegates: `OK`.
- Locked exceptions: `P2021` confirmed as expected for missing tables.

## Artifacts
- `reports/schema_baseline_2026-02-17.md`
- `reports/schema_diff_matrix_2026-02-17.csv`
- `reports/auth_schema_audit_2026-02-17.md`
- `reports/schema_hygiene_closeout_2026-02-17.md`

## Explicit Blockers Preserved (by instruction)
- `app_v3.padel_tournament_roles` remains missing and untouched.
- `app_v3.refund_policy_versions` remains missing and untouched.

## Residual Risk
- `npm run typecheck` could not complete in this environment (`exit 137` / process killed), so full repo compile health is not fully proven by this run.
