# Full-stack Legacy/Redundancy Audit — Master Report

## Summary

- Schema drift: 193 columns found in migrations but not in Prisma schema; 370 columns in schema not seen in migrations (parser-based).
- Usage map: 2938 schema fields indexed; 13 non-relation fields with zero code/SQL refs (heuristic).
- DB stats: 50 unused indexes (idx_scan=0) sampled; 55 columns with null_frac>=0.98 (possible unused/legacy).

## Phase B Changes Applied (prior)

- Dropped `chat_messages.deleted_by` and related Prisma relations.
- Dropped `internal_chat_messages.deleted_by_user_id` and related Prisma relations.
- Dropped store product dimension fields: `weight_grams`, `length_mm`, `width_mm`, `height_mm`.
- Migration: `prisma/migrations/20260206170000_drop_unused_chat_store_columns/migration.sql`.

## Phase B (Option 3) Changes Applied — Legacy Overrides

- Removed event-level fee override columns from schema: `fee_mode_override`, `platform_fee_bps_override`, `platform_fee_fixed_cents_override`.
- Removed override usage in pricing and payments intent flow.
- Migration: `prisma/migrations/20260206173000_drop_event_fee_overrides/migration.sql`.

## Phase B Changes Applied — Membership/CRM Cleanup

- Dropped org legacy billing fields: `organizations.stripe_customer_id`, `organizations.stripe_subscription_id`, `organizations.live_hub_premium_enabled`.
- Dropped `services.required_membership_plan_ids`.
- Dropped unused tables: `membership_plans`, `membership_perks`, `membership_subscriptions`, `crm_segment_memberships`.
- Dropped enums: `MembershipBillingInterval`, `MembershipStatus`.
- Migration: `prisma/migrations/20260207120000_drop_membership_legacy/migration.sql`.

## Phase B Changes Applied — Legacy Address Columns

- Dropped legacy text address columns: `events.address`, `padel_clubs.address`, `search_index_items.address`.
- Dropped unused `tournament_entries.sale_summary_id`.
- Migration: `prisma/migrations/20260207124000_drop_legacy_address_columns/migration.sql`.

## Key Findings (high-confidence)

### 1) Schema drift / legacy columns
Large set of columns exist in migrations but not in Prisma schema. This suggests either dropped columns, old tables still present, or schema/model drift. Example list (first 40):

```
availabilities.status
availability_overrides.kind
booking_charges.kind
booking_charges.status
booking_invites.status
booking_participants.status
booking_split_participants.status
booking_splits.status
bookings.status
chat_conversation_attachments.type
chat_conversation_members.role
chat_conversations.type
chat_members.role
chat_messages.deleted_by
chat_messages.kind
chat_threads.status
connect_accounts.created_at
connect_accounts.id
connect_accounts.organization_id
connect_accounts.stripe_account_id
connect_accounts.updated_at
crm_campaign_deliveries.status
crm_campaigns.channel
crm_campaigns.status
crm_customers.status
crm_interactions.type
crm_segments.status
cron_job_locks.created_at
cron_job_locks.env
cron_job_locks.job_key
cron_job_locks.locked_at
cron_job_locks.locked_by
cron_job_locks.locked_until
cron_job_locks.updated_at
dsar_cases.status
dsar_cases.type
entitlements.snapshot_version
entitlements.status
entitlements.type
event_access_policies.mode
```

### 2) High-null columns in DB stats (null_frac >= 0.98)
These columns are always/mostly NULL in the current DB snapshot; candidates for legacy flags or unimplemented features. Example list (first 40):

```
crm_customers.contact_phone (null_frac=1.0)
crm_customers.marketing_opt_in_at (null_frac=1.0)
entitlements.owner_identity_id (null_frac=1.0)
entitlements.tournament_id (null_frac=1.0)
entitlements.season_id (null_frac=1.0)
entitlements.ticket_id (null_frac=1.0)
entitlements.policy_version_applied (null_frac=1.0)
chat_threads.legal_hold_until (null_frac=1.0)
events.deleted_at (null_frac=1.0)
events.fee_mode_override (null_frac=1.0)
events.platform_fee_bps_override (null_frac=1.0)
events.platform_fee_fixed_cents_override (null_frac=1.0)
events.live_stream_url (null_frac=1.0)
events.location_components (null_frac=1.0)
events.location_overrides (null_frac=1.0)
events.address_id (null_frac=1.0)
padel_matches.court_number (null_frac=1.0)
padel_matches.start_time (null_frac=1.0)
padel_matches.winner_pairing_id (null_frac=1.0)
padel_matches.score_sets (null_frac=1.0)
padel_matches.court_name (null_frac=1.0)
padel_matches.actual_start_at (null_frac=1.0)
padel_matches.actual_end_at (null_frac=1.0)
ticket_types.starts_at (null_frac=1.0)
ticket_types.ends_at (null_frac=1.0)
tickets.rotating_seed (null_frac=1.0)
tickets.used_at (null_frac=1.0)
tickets.pairing_id (null_frac=1.0)
tickets.padel_split_share_cents (null_frac=1.0)
tickets.tournament_entry_id (null_frac=1.0)
profiles.deleted_at (null_frac=1.0)
profiles.contact_phone (null_frac=1.0)
profiles.deletion_requested_at (null_frac=1.0)
profiles.deletion_scheduled_for (null_frac=1.0)
profiles.deleted_at_final (null_frac=1.0)
profiles.padel_level (null_frac=1.0)
profiles.padel_club_name (null_frac=1.0)
notification_outbox.next_attempt_at (null_frac=1.0)
notifications.event_id (null_frac=1.0)
notifications.ticket_id (null_frac=1.0)
```

### 3) Unused indexes (idx_scan=0)
Indexes with zero scans in stats (sample). These may be redundant or created for legacy queries.

```
cron_heartbeats.cron_heartbeats_last_run_idx (32 kB)
organization_groups.env_idx_78796d20 (16 kB)
admin_mfa.env_idx_50776d44 (16 kB)
platform_settings.env_idx_71de87a1 (16 kB)
chat_conversation_messages.chat_conversation_messages_search_idx (16 kB)
organizations.organizations_stripe_customer_idx (16 kB)
global_usernames.env_idx_bdb6bd93 (16 kB)
organization_modules.env_idx_6b63ea0d (16 kB)
organizations.organizations_status_idx (16 kB)
payments.payments_source_idx (16 kB)
search_index_items.env_idx_add937cf (16 kB)
chat_threads.chat_threads_org_idx (16 kB)
organization_audit_logs.organization_audit_logs_corr_idx (16 kB)
organization_audit_logs.organization_audit_logs_actor_idx (16 kB)
events.events_status_deleted_ends_idx (16 kB)
events.events_status_deleted_starts_idx (16 kB)
profiles.profiles_active_org_idx (16 kB)
notification_preferences.env_idx_3ad5ca84 (16 kB)
outbox_events.outbox_events_pending_created_idx (16 kB)
organizations.organizations_stripe_subscription_idx (16 kB)
organization_audit_logs.organization_audit_logs_entity_idx (16 kB)
event_logs.event_logs_org_event_idempotency_unique (16 kB)
search_index_items.search_index_items_pkey (16 kB)
search_index_items.search_index_items_city_start_idx (16 kB)
organization_members.organization_members_user_idx (16 kB)
organization_members.env_idx_a8e9ee53 (16 kB)
cron_heartbeats.env_idx_3b4ee47b (16 kB)
organization_audit_logs.env_idx_e439a02d (16 kB)
event_access_policies.event_access_policies_pkey (16 kB)
organization_audit_logs.organization_audit_logs_group_idx (16 kB)
```

### 4) Legacy/compat layers in code
- Legacy access policy: `lib/events/accessPolicy.ts` still processes legacy payloads and flags.
- Response envelope normalizes legacy payloads: `lib/http/envelope.ts`.
- Deprecated context/permissions: `lib/organizationContext.ts`, `lib/organizationPermissions.ts`.
- Padel legacy flows disabled but still referenced: `lib/operations/fulfillPadelSplit.ts`, `lib/operations/fulfillPadelFull.ts`.
- Theme legacy storage migration: `lib/theme/runtime.ts`.

### 5) Chat & Store (requested focus)
- Chat high-null fields in DB stats: `chat_conversation_members.muted_until`, `chat_conversation_messages.edited_at`, `reply_to_id`, `deleted_at`, `chat_conversations.description`, `chat_threads.legal_hold_until`.
- Store dimension fields removed in Phase B.

## Notes & Limitations

- Usage map is heuristic (token-based). Ambiguous field names can inflate counts.
- DB stats reflect current shared prod/dev snapshot; low data volume can overstate null_frac.
- Schema drift parsing is migration-SQL based and may miss complex DDL.

## Recommended Next Actions

See `reports/audit-backlog.csv` for prioritized fixes and cleanup phases.
