# Schema Hygiene Audit - 2026-02-17

## Scope
- Database: Supabase PostgreSQL (`db.ytdegtoibuxcmmvtbgtq.supabase.co`, DB `postgres`)
- Schemas reviewed: `app_v3` (primary), `auth` (context only)
- Sources reviewed:
  - Live catalog (`pg_tables`, `information_schema.columns`, triggers/functions)
  - Prisma schema (`prisma/schema.prisma`)
  - Runtime and tooling usage (`app/`, `lib/`, `domain/`, `packages/`, `apps/`, `scripts/`, `tests/`)

## Executive Summary
- Status: **Not yet hygienized / not yet "perfect"**.
- Main blockers before new seed data:
  1. **Hard schema drift with runtime impact** (Prisma models pointing to tables that do not exist).
  2. **Legacy columns still physically present** in core tables, outside Prisma canonical model.
  3. **Dual chat persistence paths** (legacy `chat_threads/*` + modern `chat_conversations/*`).
  4. **One migration pending** (`20260217221500_policy_centralization_hardcut`).

## Inventory Snapshot
- `app_v3`:
  - Tables: `232`
  - Views: `0`
  - Functions: `17`
  - Triggers: `4`
- Prisma models mapped to `app_v3`: `233`
- Delta:
  - DB table not in Prisma: `cron_job_locks`
  - Prisma tables missing in DB: `padel_tournament_roles`, `refund_policy_versions`

## Critical Findings (P0)

### 1) Prisma models referencing missing DB tables
- Missing tables:
  - `app_v3.padel_tournament_roles`
  - `app_v3.refund_policy_versions`
- Confirmed runtime failure (`P2021`) when calling delegates:
  - `prisma.padelTournamentRoleAssignment.count()`
  - `prisma.refundPolicyVersion.count()`
- Runtime code currently calls these delegates:
  - `app/api/padel/tournaments/roles/route.ts`
  - `domain/padel/incidentGovernance.ts`
  - `app/api/org/[orgId]/events/create/route.ts`

Impact:
- Padel role flows can fail in production paths as soon as code hits these queries.

### 2) Canonical model vs physical schema mismatch in core tables
Columns exist physically in DB but are not in current Prisma model (legacy/parallel truth):
- `events`: `lat`, `lng`, `location_name`, `location_city`, `address`, `location_source`, `location_provider_id`, `location_formatted_address`, `location_components`, `location_overrides`, `is_free`, `invite_only`, `public_access_mode`, `participant_access_mode`, `public_ticket_type_ids`, `participant_ticket_type_ids`, `fee_mode_override`, `platform_fee_bps_override`, `platform_fee_fixed_cents_override`
- `search_index_items`: `location_formatted_address`, `lat`, `lng`, `location_source`, `location_name`, `location_city`, `address`
- `organizations`: `stripe_customer_id`, `stripe_subscription_id`, `city`, `live_hub_premium_enabled`, `padel_default_city`, `padel_default_address`, `address`
- `profiles`: `city`
- `padel_clubs`: `lat`, `lng`
- `services`: `default_location_text`, `required_membership_plan_ids`
- `stores`: `support_email`, `support_phone`, `return_policy`, `privacy_policy`, `terms_url`
- `organization_settings`: `store_terms_url`, `store_privacy_policy`, `store_return_policy_notes`

Impact:
- DB contains fields outside canonical app contract.
- High risk of hidden dual-truth when ad-hoc SQL, BI, or legacy services read these columns.

### 3) Pending migration
- `npm run db:status` reports pending:
  - `20260217221500_policy_centralization_hardcut`
- This migration explains part of current drift (`store_orders` policy snapshot columns missing; old policy columns still present in `stores`/`organization_settings`).

Impact:
- Schema is between states; hygiene decisions are unreliable until migration state is consistent.

## High Findings (P1)

### 4) Dual chat persistence model still present
- Legacy chat tables modeled: `chat_threads`, `chat_members`, `chat_messages`, `chat_read_state`, `chat_moderation_log`, `chat_invites`, `chat_event_invites`.
- Modern stack modeled and heavily used: `chat_conversations`, `chat_conversation_members`, `chat_conversation_messages`, `chat_access_grants`.
- DB functions and triggers still tied to legacy chat tables:
  - Functions: `chat_ensure_event_thread`, `chat_handle_event_insert`, `chat_handle_booking_change`, etc.
  - Triggers:
    - `events.chat_event_insert_sync -> chat_handle_event_insert`
    - `events.chat_event_schedule_sync -> chat_handle_event_schedule_update`
    - `bookings.chat_booking_schedule_sync -> chat_handle_booking_schedule_update`
    - `chat_messages.chat_notify_announcement_trigger -> chat_notify_announcement`

Impact:
- Two chat data models can co-exist, increasing maintenance and semantic drift risk.

### 5) Dormant or near-dormant models/tables
Based on static usage scan:
- No direct app/script/test references found for:
  - `chat_channel_requests`
  - `chat_conversation_requests`
  - `chat_event_invites`
  - `chat_members`
  - `chat_messages`
  - `chat_moderation_log`
  - `chat_read_state`
  - `payouts`
- Note: `chat_members` is still referenced by DB functions.

Impact:
- Potential dead structures and stale maintenance surface.

## Medium Findings (P2)

### 6) `cron_job_locks` is operational but not modeled in Prisma
- Table exists and is used by raw SQL in `lib/cron/lock.ts`.
- Not necessarily wrong, but this is an intentional "escape hatch" that should be explicit and documented as canonical.

### 7) `auth` schema intentionally under-modeled
- `auth` has many tables not modeled in Prisma (expected in Supabase-managed auth).
- Must remain intentionally out-of-scope for deletion unless full auth strategy changes.

## Recommended Cleanup Plan (before any new seed wave)

### Phase 1 - Stabilize contract (mandatory)
1. Apply pending migration:
   - `20260217221500_policy_centralization_hardcut`
2. Resolve hard missing-table drift:
   - Either create `padel_tournament_roles` + `refund_policy_versions` (if canonical), or
   - Remove/replace these models and all runtime references.
3. Re-run:
   - `npm run db:status`
   - `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma`

### Phase 2 - Remove dual truths
1. Location/access legacy columns hard-cut from `events` and `search_index_items` (plus org/profile leftovers).
2. Keep a single source for store policy fields:
   - Canonical in `organization_settings` + snapshot in `store_orders`.
   - Remove stale policy fields from `stores`.
3. Decide chat canonical model:
   - If `chat_conversations/*` is final, plan migration to retire legacy `chat_threads/*` triggers/functions/tables.

### Phase 3 - Hygiene guardrails
1. Add CI drift gate that fails on:
   - Prisma model table missing physically.
   - DB table in `app_v3` not mapped/documented exception list.
2. Maintain an explicit allowlist for raw-SQL-only tables (`cron_job_locks`, etc).
3. Add quarterly "dead model" scan (runtime + SQL + trigger/function references).

## Confidence / Caveats
- High confidence on structural drift and missing-table findings (validated directly against live DB).
- Static "unused" classification is probabilistic for nested relation writes and dynamic SQL; treat as candidate list, not auto-delete list.

