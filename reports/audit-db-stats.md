# DB Read-only Profiling

## SQL

```sql

BEGIN READ ONLY;
SET statement_timeout = '5s';
SET lock_timeout = '1s';

-- Top tables by live rows
SELECT schemaname, relname, n_live_tup, n_dead_tup, last_autovacuum, last_analyze
FROM pg_stat_all_tables
WHERE schemaname = 'app_v3'
ORDER BY n_live_tup DESC
LIMIT 20;

-- Tables with most dead tuples
SELECT schemaname, relname, n_live_tup, n_dead_tup, last_autovacuum, last_analyze
FROM pg_stat_all_tables
WHERE schemaname = 'app_v3'
ORDER BY n_dead_tup DESC NULLS LAST
LIMIT 20;

-- Unused indexes (idx_scan = 0)
SELECT schemaname, relname, indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE schemaname = 'app_v3' AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 50;

-- High null fraction columns (possible legacy)
SELECT schemaname, tablename, attname, null_frac, n_distinct
FROM pg_stats
WHERE schemaname = 'app_v3' AND null_frac > 0.98
ORDER BY null_frac DESC
LIMIT 50;

-- Low distinct columns (possible enums/flags, check usage)
SELECT schemaname, tablename, attname, null_frac, n_distinct
FROM pg_stats
WHERE schemaname = 'app_v3' AND n_distinct BETWEEN -1 AND 5 AND null_frac < 0.5
ORDER BY n_distinct ASC
LIMIT 50;

-- Chat tables: high-null columns
SELECT tablename, attname, null_frac, n_distinct
FROM pg_stats
WHERE schemaname = 'app_v3' AND tablename LIKE 'chat_%' AND null_frac > 0.9
ORDER BY null_frac DESC, tablename, attname
LIMIT 100;

-- Store tables: high-null columns
SELECT tablename, attname, null_frac, n_distinct
FROM pg_stats
WHERE schemaname = 'app_v3' AND tablename LIKE 'store_%' AND null_frac > 0.9
ORDER BY null_frac DESC, tablename, attname
LIMIT 100;

COMMIT;
```

## Output

```
BEGIN
SET
SET
-[ RECORD 1 ]---+------------------------------
schemaname      | app_v3
relname         | organization_modules
n_live_tup      | 41
n_dead_tup      | 34
last_autovacuum | 2026-01-20 09:39:53.496487+00
last_analyze    | 
-[ RECORD 2 ]---+------------------------------
schemaname      | app_v3
relname         | padel_categories
n_live_tup      | 36
n_dead_tup      | 0
last_autovacuum | 
last_analyze    | 
-[ RECORD 3 ]---+------------------------------
schemaname      | app_v3
relname         | cron_heartbeats
n_live_tup      | 15
n_dead_tup      | 0
last_autovacuum | 2026-02-06 20:56:04.936285+00
last_analyze    | 
-[ RECORD 4 ]---+------------------------------
schemaname      | app_v3
relname         | global_usernames
n_live_tup      | 11
n_dead_tup      | 15
last_autovacuum | 
last_analyze    | 
-[ RECORD 5 ]---+------------------------------
schemaname      | app_v3
relname         | outbox_events
n_live_tup      | 11
n_dead_tup      | 0
last_autovacuum | 2026-02-06 20:45:04.899981+00
last_analyze    | 
-[ RECORD 6 ]---+------------------------------
schemaname      | app_v3
relname         | ledger_entries
n_live_tup      | 10
n_dead_tup      | 2
last_autovacuum | 
last_analyze    | 
-[ RECORD 7 ]---+------------------------------
schemaname      | app_v3
relname         | events
n_live_tup      | 10
n_dead_tup      | 7
last_autovacuum | 
last_analyze    | 
-[ RECORD 8 ]---+------------------------------
schemaname      | app_v3
relname         | profiles
n_live_tup      | 9
n_dead_tup      | 25
last_autovacuum | 2026-02-06 16:07:54.988285+00
last_analyze    | 
-[ RECORD 9 ]---+------------------------------
schemaname      | app_v3
relname         | chat_threads
n_live_tup      | 8
n_dead_tup      | 15
last_autovacuum | 
last_analyze    | 
-[ RECORD 10 ]--+------------------------------
schemaname      | app_v3
relname         | notification_preferences
n_live_tup      | 8
n_dead_tup      | 18
last_autovacuum | 
last_analyze    | 
-[ RECORD 11 ]--+------------------------------
schemaname      | app_v3
relname         | organization_groups
n_live_tup      | 7
n_dead_tup      | 3
last_autovacuum | 
last_analyze    | 
-[ RECORD 12 ]--+------------------------------
schemaname      | app_v3
relname         | organizations
n_live_tup      | 7
n_dead_tup      | 8
last_autovacuum | 
last_analyze    | 
-[ RECORD 13 ]--+------------------------------
schemaname      | app_v3
relname         | organization_audit_logs
n_live_tup      | 5
n_dead_tup      | 0
last_autovacuum | 
last_analyze    | 
-[ RECORD 14 ]--+------------------------------
schemaname      | app_v3
relname         | ticket_types
n_live_tup      | 5
n_dead_tup      | 5
last_autovacuum | 2026-01-08 15:41:17.689457+00
last_analyze    | 
-[ RECORD 15 ]--+------------------------------
schemaname      | app_v3
relname         | organization_members
n_live_tup      | 5
n_dead_tup      | 7
last_autovacuum | 
last_analyze    | 
-[ RECORD 16 ]--+------------------------------
schemaname      | app_v3
relname         | event_logs
n_live_tup      | 5
n_dead_tup      | 5
last_autovacuum | 
last_analyze    | 
-[ RECORD 17 ]--+------------------------------
schemaname      | app_v3
relname         | email_identities
n_live_tup      | 3
n_dead_tup      | 27
last_autovacuum | 2026-02-05 10:51:13.502408+00
last_analyze    | 
-[ RECORD 18 ]--+------------------------------
schemaname      | app_v3
relname         | organization_group_members
n_live_tup      | 2
n_dead_tup      | 1
last_autovacuum | 
last_analyze    | 
-[ RECORD 19 ]--+------------------------------
schemaname      | app_v3
relname         | payments
n_live_tup      | 2
n_dead_tup      | 1
last_autovacuum | 
last_analyze    | 
-[ RECORD 20 ]--+------------------------------
schemaname      | app_v3
relname         | event_access_policies
n_live_tup      | 1
n_dead_tup      | 0
last_autovacuum | 
last_analyze    | 

-[ RECORD 1 ]---+------------------------------
schemaname      | app_v3
relname         | organization_modules
n_live_tup      | 41
n_dead_tup      | 34
last_autovacuum | 2026-01-20 09:39:53.496487+00
last_analyze    | 
-[ RECORD 2 ]---+------------------------------
schemaname      | app_v3
relname         | email_identities
n_live_tup      | 3
n_dead_tup      | 27
last_autovacuum | 2026-02-05 10:51:13.502408+00
last_analyze    | 
-[ RECORD 3 ]---+------------------------------
schemaname      | app_v3
relname         | profiles
n_live_tup      | 9
n_dead_tup      | 25
last_autovacuum | 2026-02-06 16:07:54.988285+00
last_analyze    | 
-[ RECORD 4 ]---+------------------------------
schemaname      | app_v3
relname         | cron_job_locks
n_live_tup      | 1
n_dead_tup      | 23
last_autovacuum | 2026-02-06 20:53:04.923858+00
last_analyze    | 
-[ RECORD 5 ]---+------------------------------
schemaname      | app_v3
relname         | notification_preferences
n_live_tup      | 8
n_dead_tup      | 18
last_autovacuum | 
last_analyze    | 
-[ RECORD 6 ]---+------------------------------
schemaname      | app_v3
relname         | chat_threads
n_live_tup      | 8
n_dead_tup      | 15
last_autovacuum | 
last_analyze    | 
-[ RECORD 7 ]---+------------------------------
schemaname      | app_v3
relname         | global_usernames
n_live_tup      | 11
n_dead_tup      | 15
last_autovacuum | 
last_analyze    | 
-[ RECORD 8 ]---+------------------------------
schemaname      | app_v3
relname         | organizations
n_live_tup      | 7
n_dead_tup      | 8
last_autovacuum | 
last_analyze    | 
-[ RECORD 9 ]---+------------------------------
schemaname      | app_v3
relname         | events
n_live_tup      | 10
n_dead_tup      | 7
last_autovacuum | 
last_analyze    | 
-[ RECORD 10 ]--+------------------------------
schemaname      | app_v3
relname         | organization_members
n_live_tup      | 5
n_dead_tup      | 7
last_autovacuum | 
last_analyze    | 
-[ RECORD 11 ]--+------------------------------
schemaname      | app_v3
relname         | event_logs
n_live_tup      | 5
n_dead_tup      | 5
last_autovacuum | 
last_analyze    | 
-[ RECORD 12 ]--+------------------------------
schemaname      | app_v3
relname         | ticket_types
n_live_tup      | 5
n_dead_tup      | 5
last_autovacuum | 2026-01-08 15:41:17.689457+00
last_analyze    | 
-[ RECORD 13 ]--+------------------------------
schemaname      | app_v3
relname         | admin_mfa
n_live_tup      | 0
n_dead_tup      | 3
last_autovacuum | 
last_analyze    | 
-[ RECORD 14 ]--+------------------------------
schemaname      | app_v3
relname         | organization_groups
n_live_tup      | 7
n_dead_tup      | 3
last_autovacuum | 
last_analyze    | 
-[ RECORD 15 ]--+------------------------------
schemaname      | app_v3
relname         | ledger_entries
n_live_tup      | 10
n_dead_tup      | 2
last_autovacuum | 
last_analyze    | 
-[ RECORD 16 ]--+------------------------------
schemaname      | app_v3
relname         | organization_group_members
n_live_tup      | 2
n_dead_tup      | 1
last_autovacuum | 
last_analyze    | 
-[ RECORD 17 ]--+------------------------------
schemaname      | app_v3
relname         | payments
n_live_tup      | 2
n_dead_tup      | 1
last_autovacuum | 
last_analyze    | 
-[ RECORD 18 ]--+------------------------------
schemaname      | app_v3
relname         | match_notifications
n_live_tup      | 0
n_dead_tup      | 0
last_autovacuum | 
last_analyze    | 
-[ RECORD 19 ]--+------------------------------
schemaname      | app_v3
relname         | locks
n_live_tup      | 0
n_dead_tup      | 0
last_autovacuum | 
last_analyze    | 
-[ RECORD 20 ]--+------------------------------
schemaname      | app_v3
relname         | entitlement_qr_tokens
n_live_tup      | 0
n_dead_tup      | 0
last_autovacuum | 
last_analyze    | 

-[ RECORD 1 ]+----------------------------------------
schemaname   | app_v3
relname      | cron_heartbeats
indexrelname | cron_heartbeats_last_run_idx
idx_scan     | 0
size         | 32 kB
-[ RECORD 2 ]+----------------------------------------
schemaname   | app_v3
relname      | organization_groups
indexrelname | env_idx_78796d20
idx_scan     | 0
size         | 16 kB
-[ RECORD 3 ]+----------------------------------------
schemaname   | app_v3
relname      | admin_mfa
indexrelname | env_idx_50776d44
idx_scan     | 0
size         | 16 kB
-[ RECORD 4 ]+----------------------------------------
schemaname   | app_v3
relname      | platform_settings
indexrelname | env_idx_71de87a1
idx_scan     | 0
size         | 16 kB
-[ RECORD 5 ]+----------------------------------------
schemaname   | app_v3
relname      | chat_conversation_messages
indexrelname | chat_conversation_messages_search_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 6 ]+----------------------------------------
schemaname   | app_v3
relname      | organizations
indexrelname | organizations_stripe_customer_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 7 ]+----------------------------------------
schemaname   | app_v3
relname      | global_usernames
indexrelname | env_idx_bdb6bd93
idx_scan     | 0
size         | 16 kB
-[ RECORD 8 ]+----------------------------------------
schemaname   | app_v3
relname      | organization_modules
indexrelname | env_idx_6b63ea0d
idx_scan     | 0
size         | 16 kB
-[ RECORD 9 ]+----------------------------------------
schemaname   | app_v3
relname      | organizations
indexrelname | organizations_status_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 10 ]----------------------------------------
schemaname   | app_v3
relname      | payments
indexrelname | payments_source_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 11 ]----------------------------------------
schemaname   | app_v3
relname      | search_index_items
indexrelname | env_idx_add937cf
idx_scan     | 0
size         | 16 kB
-[ RECORD 12 ]----------------------------------------
schemaname   | app_v3
relname      | chat_threads
indexrelname | chat_threads_org_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 13 ]----------------------------------------
schemaname   | app_v3
relname      | organization_audit_logs
indexrelname | organization_audit_logs_corr_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 14 ]----------------------------------------
schemaname   | app_v3
relname      | organization_audit_logs
indexrelname | organization_audit_logs_actor_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 15 ]----------------------------------------
schemaname   | app_v3
relname      | events
indexrelname | events_status_deleted_ends_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 16 ]----------------------------------------
schemaname   | app_v3
relname      | events
indexrelname | events_status_deleted_starts_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 17 ]----------------------------------------
schemaname   | app_v3
relname      | profiles
indexrelname | profiles_active_org_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 18 ]----------------------------------------
schemaname   | app_v3
relname      | notification_preferences
indexrelname | env_idx_3ad5ca84
idx_scan     | 0
size         | 16 kB
-[ RECORD 19 ]----------------------------------------
schemaname   | app_v3
relname      | outbox_events
indexrelname | outbox_events_pending_created_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 20 ]----------------------------------------
schemaname   | app_v3
relname      | organizations
indexrelname | organizations_stripe_subscription_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 21 ]----------------------------------------
schemaname   | app_v3
relname      | organization_audit_logs
indexrelname | organization_audit_logs_entity_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 22 ]----------------------------------------
schemaname   | app_v3
relname      | event_logs
indexrelname | event_logs_org_event_idempotency_unique
idx_scan     | 0
size         | 16 kB
-[ RECORD 23 ]----------------------------------------
schemaname   | app_v3
relname      | search_index_items
indexrelname | search_index_items_pkey
idx_scan     | 0
size         | 16 kB
-[ RECORD 24 ]----------------------------------------
schemaname   | app_v3
relname      | search_index_items
indexrelname | search_index_items_city_start_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 25 ]----------------------------------------
schemaname   | app_v3
relname      | organization_members
indexrelname | organization_members_user_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 26 ]----------------------------------------
schemaname   | app_v3
relname      | organization_members
indexrelname | env_idx_a8e9ee53
idx_scan     | 0
size         | 16 kB
-[ RECORD 27 ]----------------------------------------
schemaname   | app_v3
relname      | cron_heartbeats
indexrelname | env_idx_3b4ee47b
idx_scan     | 0
size         | 16 kB
-[ RECORD 28 ]----------------------------------------
schemaname   | app_v3
relname      | organization_audit_logs
indexrelname | env_idx_e439a02d
idx_scan     | 0
size         | 16 kB
-[ RECORD 29 ]----------------------------------------
schemaname   | app_v3
relname      | event_access_policies
indexrelname | event_access_policies_pkey
idx_scan     | 0
size         | 16 kB
-[ RECORD 30 ]----------------------------------------
schemaname   | app_v3
relname      | organization_audit_logs
indexrelname | organization_audit_logs_group_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 31 ]----------------------------------------
schemaname   | app_v3
relname      | outbox_events
indexrelname | outbox_events_dedupe_key_unique
idx_scan     | 0
size         | 16 kB
-[ RECORD 32 ]----------------------------------------
schemaname   | app_v3
relname      | chat_threads
indexrelname | chat_threads_close_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 33 ]----------------------------------------
schemaname   | app_v3
relname      | events
indexrelname | events_owner_user_id_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 34 ]----------------------------------------
schemaname   | app_v3
relname      | events
indexrelname | events_address_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 35 ]----------------------------------------
schemaname   | app_v3
relname      | ledger_entries
indexrelname | ledger_entries_source_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 36 ]----------------------------------------
schemaname   | app_v3
relname      | ticket_types
indexrelname | env_idx_47fdbbd5
idx_scan     | 0
size         | 16 kB
-[ RECORD 37 ]----------------------------------------
schemaname   | app_v3
relname      | profiles
indexrelname | env_idx_d9707283
idx_scan     | 0
size         | 16 kB
-[ RECORD 38 ]----------------------------------------
schemaname   | app_v3
relname      | cron_job_locks
indexrelname | cron_job_locks_until_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 39 ]----------------------------------------
schemaname   | app_v3
relname      | email_identities
indexrelname | env_idx_1edf1409
idx_scan     | 0
size         | 16 kB
-[ RECORD 40 ]----------------------------------------
schemaname   | app_v3
relname      | outbox_events
indexrelname | outbox_events_created_at_event_idx
idx_scan     | 0
size         | 16 kB
-[ RECORD 41 ]----------------------------------------
schemaname   | app_v3
relname      | padel_clubs
indexrelname | padel_clubs_address_idx
idx_scan     | 0
size         | 8192 bytes
-[ RECORD 42 ]----------------------------------------
schemaname   | app_v3
relname      | crm_customers
indexrelname | crm_customers_org_spent_idx
idx_scan     | 0
size         | 8192 bytes
-[ RECORD 43 ]----------------------------------------
schemaname   | app_v3
relname      | entitlements
indexrelname | entitlements_store_line_owner_idx
idx_scan     | 0
size         | 8192 bytes
-[ RECORD 44 ]----------------------------------------
schemaname   | app_v3
relname      | entitlements
indexrelname | entitlements_booking_owner_line_idx
idx_scan     | 0
size         | 8192 bytes
-[ RECORD 45 ]----------------------------------------
schemaname   | app_v3
relname      | crm_customer_notes
indexrelname | env_idx_31a8deaf
idx_scan     | 0
size         | 8192 bytes
-[ RECORD 46 ]----------------------------------------
schemaname   | app_v3
relname      | chat_message_reports
indexrelname | env_idx_04db78e1
idx_scan     | 0
size         | 8192 bytes
-[ RECORD 47 ]----------------------------------------
schemaname   | app_v3
relname      | entitlements
indexrelname | entitlements_store_line_idx
idx_scan     | 0
size         | 8192 bytes
-[ RECORD 48 ]----------------------------------------
schemaname   | app_v3
relname      | entitlements
indexrelname | entitlements_booking_idx
idx_scan     | 0
size         | 8192 bytes
-[ RECORD 49 ]----------------------------------------
schemaname   | app_v3
relname      | crm_customer_notes
indexrelname | crm_customer_notes_pkey
idx_scan     | 0
size         | 8192 bytes
-[ RECORD 50 ]----------------------------------------
schemaname   | app_v3
relname      | entitlements
indexrelname | entitlements_ticket_id_key
idx_scan     | 0
size         | 8192 bytes

-[ RECORD 1 ]---------------------------------
schemaname | app_v3
tablename  | crm_customers
attname    | contact_phone
null_frac  | 1
n_distinct | 0
-[ RECORD 2 ]---------------------------------
schemaname | app_v3
tablename  | crm_customers
attname    | marketing_opt_in_at
null_frac  | 1
n_distinct | 0
-[ RECORD 3 ]---------------------------------
schemaname | app_v3
tablename  | entitlements
attname    | owner_identity_id
null_frac  | 1
n_distinct | 0
-[ RECORD 4 ]---------------------------------
schemaname | app_v3
tablename  | entitlements
attname    | tournament_id
null_frac  | 1
n_distinct | 0
-[ RECORD 5 ]---------------------------------
schemaname | app_v3
tablename  | entitlements
attname    | season_id
null_frac  | 1
n_distinct | 0
-[ RECORD 6 ]---------------------------------
schemaname | app_v3
tablename  | entitlements
attname    | ticket_id
null_frac  | 1
n_distinct | 0
-[ RECORD 7 ]---------------------------------
schemaname | app_v3
tablename  | entitlements
attname    | policy_version_applied
null_frac  | 1
n_distinct | 0
-[ RECORD 8 ]---------------------------------
schemaname | app_v3
tablename  | chat_threads
attname    | legal_hold_until
null_frac  | 1
n_distinct | 0
-[ RECORD 9 ]---------------------------------
schemaname | app_v3
tablename  | events
attname    | deleted_at
null_frac  | 1
n_distinct | 0
-[ RECORD 10 ]--------------------------------
schemaname | app_v3
tablename  | events
attname    | fee_mode_override
null_frac  | 1
n_distinct | 0
-[ RECORD 11 ]--------------------------------
schemaname | app_v3
tablename  | events
attname    | platform_fee_bps_override
null_frac  | 1
n_distinct | 0
-[ RECORD 12 ]--------------------------------
schemaname | app_v3
tablename  | events
attname    | platform_fee_fixed_cents_override
null_frac  | 1
n_distinct | 0
-[ RECORD 13 ]--------------------------------
schemaname | app_v3
tablename  | events
attname    | live_stream_url
null_frac  | 1
n_distinct | 0
-[ RECORD 14 ]--------------------------------
schemaname | app_v3
tablename  | events
attname    | location_components
null_frac  | 1
n_distinct | 0
-[ RECORD 15 ]--------------------------------
schemaname | app_v3
tablename  | events
attname    | location_overrides
null_frac  | 1
n_distinct | 0
-[ RECORD 16 ]--------------------------------
schemaname | app_v3
tablename  | events
attname    | address_id
null_frac  | 1
n_distinct | 0
-[ RECORD 17 ]--------------------------------
schemaname | app_v3
tablename  | padel_matches
attname    | court_number
null_frac  | 1
n_distinct | 0
-[ RECORD 18 ]--------------------------------
schemaname | app_v3
tablename  | padel_matches
attname    | start_time
null_frac  | 1
n_distinct | 0
-[ RECORD 19 ]--------------------------------
schemaname | app_v3
tablename  | padel_matches
attname    | winner_pairing_id
null_frac  | 1
n_distinct | 0
-[ RECORD 20 ]--------------------------------
schemaname | app_v3
tablename  | padel_matches
attname    | score_sets
null_frac  | 1
n_distinct | 0
-[ RECORD 21 ]--------------------------------
schemaname | app_v3
tablename  | padel_matches
attname    | court_name
null_frac  | 1
n_distinct | 0
-[ RECORD 22 ]--------------------------------
schemaname | app_v3
tablename  | padel_matches
attname    | actual_start_at
null_frac  | 1
n_distinct | 0
-[ RECORD 23 ]--------------------------------
schemaname | app_v3
tablename  | padel_matches
attname    | actual_end_at
null_frac  | 1
n_distinct | 0
-[ RECORD 24 ]--------------------------------
schemaname | app_v3
tablename  | ticket_types
attname    | starts_at
null_frac  | 1
n_distinct | 0
-[ RECORD 25 ]--------------------------------
schemaname | app_v3
tablename  | ticket_types
attname    | ends_at
null_frac  | 1
n_distinct | 0
-[ RECORD 26 ]--------------------------------
schemaname | app_v3
tablename  | tickets
attname    | rotating_seed
null_frac  | 1
n_distinct | 0
-[ RECORD 27 ]--------------------------------
schemaname | app_v3
tablename  | tickets
attname    | used_at
null_frac  | 1
n_distinct | 0
-[ RECORD 28 ]--------------------------------
schemaname | app_v3
tablename  | tickets
attname    | pairing_id
null_frac  | 1
n_distinct | 0
-[ RECORD 29 ]--------------------------------
schemaname | app_v3
tablename  | tickets
attname    | padel_split_share_cents
null_frac  | 1
n_distinct | 0
-[ RECORD 30 ]--------------------------------
schemaname | app_v3
tablename  | tickets
attname    | tournament_entry_id
null_frac  | 1
n_distinct | 0
-[ RECORD 31 ]--------------------------------
schemaname | app_v3
tablename  | profiles
attname    | deleted_at
null_frac  | 1
n_distinct | 0
-[ RECORD 32 ]--------------------------------
schemaname | app_v3
tablename  | profiles
attname    | contact_phone
null_frac  | 1
n_distinct | 0
-[ RECORD 33 ]--------------------------------
schemaname | app_v3
tablename  | profiles
attname    | deletion_requested_at
null_frac  | 1
n_distinct | 0
-[ RECORD 34 ]--------------------------------
schemaname | app_v3
tablename  | profiles
attname    | deletion_scheduled_for
null_frac  | 1
n_distinct | 0
-[ RECORD 35 ]--------------------------------
schemaname | app_v3
tablename  | profiles
attname    | deleted_at_final
null_frac  | 1
n_distinct | 0
-[ RECORD 36 ]--------------------------------
schemaname | app_v3
tablename  | profiles
attname    | padel_level
null_frac  | 1
n_distinct | 0
-[ RECORD 37 ]--------------------------------
schemaname | app_v3
tablename  | profiles
attname    | padel_club_name
null_frac  | 1
n_distinct | 0
-[ RECORD 38 ]--------------------------------
schemaname | app_v3
tablename  | notification_outbox
attname    | next_attempt_at
null_frac  | 1
n_distinct | 0
-[ RECORD 39 ]--------------------------------
schemaname | app_v3
tablename  | notifications
attname    | event_id
null_frac  | 1
n_distinct | 0
-[ RECORD 40 ]--------------------------------
schemaname | app_v3
tablename  | notifications
attname    | ticket_id
null_frac  | 1
n_distinct | 0
-[ RECORD 41 ]--------------------------------
schemaname | app_v3
tablename  | notifications
attname    | invite_id
null_frac  | 1
n_distinct | 0
-[ RECORD 42 ]--------------------------------
schemaname | app_v3
tablename  | notifications
attname    | expires_at
null_frac  | 1
n_distinct | 0
-[ RECORD 43 ]--------------------------------
schemaname | app_v3
tablename  | operations
attname    | locked_at
null_frac  | 1
n_distinct | 0
-[ RECORD 44 ]--------------------------------
schemaname | app_v3
tablename  | operations
attname    | organization_id
null_frac  | 1
n_distinct | 0
-[ RECORD 45 ]--------------------------------
schemaname | app_v3
tablename  | operations
attname    | pairing_id
null_frac  | 1
n_distinct | 0
-[ RECORD 46 ]--------------------------------
schemaname | app_v3
tablename  | outbox_events
attname    | published_at
null_frac  | 1
n_distinct | 0
-[ RECORD 47 ]--------------------------------
schemaname | app_v3
tablename  | outbox_events
attname    | next_attempt_at
null_frac  | 1
n_distinct | 0
-[ RECORD 48 ]--------------------------------
schemaname | app_v3
tablename  | outbox_events
attname    | dead_lettered_at
null_frac  | 1
n_distinct | 0
-[ RECORD 49 ]--------------------------------
schemaname | app_v3
tablename  | outbox_events
attname    | reason_code
null_frac  | 1
n_distinct | 0
-[ RECORD 50 ]--------------------------------
schemaname | app_v3
tablename  | crm_customers
attname    | contact_email
null_frac  | 1
n_distinct | 0

-[ RECORD 1 ]---------------------------
schemaname | app_v3
tablename  | organizations
attname    | timezone
null_frac  | 0
n_distinct | -1
-[ RECORD 2 ]---------------------------
schemaname | app_v3
tablename  | organizations
attname    | reservation_assignment_mode
null_frac  | 0
n_distinct | -1
-[ RECORD 3 ]---------------------------
schemaname | app_v3
tablename  | organizations
attname    | live_hub_premium_enabled
null_frac  | 0
n_distinct | -1
-[ RECORD 4 ]---------------------------
schemaname | app_v3
tablename  | organizations
attname    | show_address_publicly
null_frac  | 0
n_distinct | -1
-[ RECORD 5 ]---------------------------
schemaname | app_v3
tablename  | organizations
attname    | official_email_verified_at
null_frac  | 0
n_distinct | -1
-[ RECORD 6 ]---------------------------
schemaname | app_v3
tablename  | organizations
attname    | official_email
null_frac  | 0
n_distinct | -1
-[ RECORD 7 ]---------------------------
schemaname | app_v3
tablename  | payment_events
attname    | created_at
null_frac  | 0
n_distinct | -1
-[ RECORD 8 ]---------------------------
schemaname | app_v3
tablename  | organizations
attname    | org_type
null_frac  | 0
n_distinct | -1
-[ RECORD 9 ]---------------------------
schemaname | app_v3
tablename  | organizations
attname    | organization_kind
null_frac  | 0
n_distinct | -1
-[ RECORD 10 ]--------------------------
schemaname | app_v3
tablename  | organizations
attname    | public_name
null_frac  | 0
n_distinct | -1
-[ RECORD 11 ]--------------------------
schemaname | app_v3
tablename  | email_identities
attname    | id
null_frac  | 0
n_distinct | -1
-[ RECORD 12 ]--------------------------
schemaname | app_v3
tablename  | organizations
attname    | alerts_payout_enabled
null_frac  | 0
n_distinct | -1
-[ RECORD 13 ]--------------------------
schemaname | app_v3
tablename  | padel_categories
attname    | id
null_frac  | 0
n_distinct | -1
-[ RECORD 14 ]--------------------------
schemaname | app_v3
tablename  | organizations
attname    | padel_default_courts
null_frac  | 0
n_distinct | -1
-[ RECORD 15 ]--------------------------
schemaname | app_v3
tablename  | organization_audit_logs
attname    | created_at
null_frac  | 0
n_distinct | -1
-[ RECORD 16 ]--------------------------
schemaname | app_v3
tablename  | payment_events
attname    | stripe_event_id
null_frac  | 0
n_distinct | -1
-[ RECORD 17 ]--------------------------
schemaname | app_v3
tablename  | organizations
attname    | padel_favorite_categories
null_frac  | 0
n_distinct | -1
-[ RECORD 18 ]--------------------------
schemaname | app_v3
tablename  | organizations
attname    | username
null_frac  | 0
n_distinct | -1
-[ RECORD 19 ]--------------------------
schemaname | app_v3
tablename  | organizations
attname    | language
null_frac  | 0
n_distinct | -1
-[ RECORD 20 ]--------------------------
schemaname | app_v3
tablename  | organization_audit_logs
attname    | id
null_frac  | 0
n_distinct | -1
-[ RECORD 21 ]--------------------------
schemaname | app_v3
tablename  | organization_audit_logs
attname    | metadata
null_frac  | 0
n_distinct | -1
-[ RECORD 22 ]--------------------------
schemaname | app_v3
tablename  | global_usernames
attname    | updated_at
null_frac  | 0
n_distinct | -1
-[ RECORD 23 ]--------------------------
schemaname | app_v3
tablename  | global_usernames
attname    | owner_id
null_frac  | 0
n_distinct | -1
-[ RECORD 24 ]--------------------------
schemaname | app_v3
tablename  | payment_events
attname    | updated_at
null_frac  | 0
n_distinct | -1
-[ RECORD 25 ]--------------------------
schemaname | app_v3
tablename  | profiles
attname    | id
null_frac  | 0
n_distinct | -1
-[ RECORD 26 ]--------------------------
schemaname | app_v3
tablename  | global_usernames
attname    | created_at
null_frac  | 0
n_distinct | -1
-[ RECORD 27 ]--------------------------
schemaname | app_v3
tablename  | organization_members
attname    | id
null_frac  | 0
n_distinct | -1
-[ RECORD 28 ]--------------------------
schemaname | app_v3
tablename  | organization_members
attname    | organization_id
null_frac  | 0
n_distinct | -1
-[ RECORD 29 ]--------------------------
schemaname | app_v3
tablename  | organization_members
attname    | user_id
null_frac  | 0
n_distinct | -1
-[ RECORD 30 ]--------------------------
schemaname | app_v3
tablename  | organization_members
attname    | role
null_frac  | 0
n_distinct | -1
-[ RECORD 31 ]--------------------------
schemaname | app_v3
tablename  | crm_customers
attname    | env
null_frac  | 0
n_distinct | -1
-[ RECORD 32 ]--------------------------
schemaname | app_v3
tablename  | organization_members
attname    | created_at
null_frac  | 0
n_distinct | -1
-[ RECORD 33 ]--------------------------
schemaname | app_v3
tablename  | organization_members
attname    | updated_at
null_frac  | 0
n_distinct | -1
-[ RECORD 34 ]--------------------------
schemaname | app_v3
tablename  | organization_members
attname    | last_used_at
null_frac  | 0
n_distinct | -1
-[ RECORD 35 ]--------------------------
schemaname | app_v3
tablename  | payment_events
attname    | purchase_id
null_frac  | 0
n_distinct | -1
-[ RECORD 36 ]--------------------------
schemaname | app_v3
tablename  | organizations
attname    | alerts_sales_enabled
null_frac  | 0
n_distinct | -1
-[ RECORD 37 ]--------------------------
schemaname | app_v3
tablename  | global_usernames
attname    | username
null_frac  | 0
n_distinct | -1
-[ RECORD 38 ]--------------------------
schemaname | app_v3
tablename  | organizations
attname    | id
null_frac  | 0
n_distinct | -1
-[ RECORD 39 ]--------------------------
schemaname | app_v3
tablename  | notification_outbox
attname    | dedupe_key
null_frac  | 0
n_distinct | -1
-[ RECORD 40 ]--------------------------
schemaname | app_v3
tablename  | payment_events
attname    | dedupe_key
null_frac  | 0
n_distinct | -1
-[ RECORD 41 ]--------------------------
schemaname | app_v3
tablename  | organizations
attname    | status
null_frac  | 0
n_distinct | -1
-[ RECORD 42 ]--------------------------
schemaname | app_v3
tablename  | organizations
attname    | created_at
null_frac  | 0
n_distinct | -1
-[ RECORD 43 ]--------------------------
schemaname | app_v3
tablename  | organizations
attname    | updated_at
null_frac  | 0
n_distinct | -1
-[ RECORD 44 ]--------------------------
schemaname | app_v3
tablename  | organizations
attname    | fee_mode
null_frac  | 0
n_distinct | -1
-[ RECORD 45 ]--------------------------
schemaname | app_v3
tablename  | organizations
attname    | platform_fee_bps
null_frac  | 0
n_distinct | -1
-[ RECORD 46 ]--------------------------
schemaname | app_v3
tablename  | organizations
attname    | platform_fee_fixed_cents
null_frac  | 0
n_distinct | -1
-[ RECORD 47 ]--------------------------
schemaname | app_v3
tablename  | organizations
attname    | stripe_charges_enabled
null_frac  | 0
n_distinct | -1
-[ RECORD 48 ]--------------------------
schemaname | app_v3
tablename  | organizations
attname    | stripe_payouts_enabled
null_frac  | 0
n_distinct | -1
-[ RECORD 49 ]--------------------------
schemaname | app_v3
tablename  | organizations
attname    | business_name
null_frac  | 0
n_distinct | -1
-[ RECORD 50 ]--------------------------
schemaname | app_v3
tablename  | organizations
attname    | primary_module
null_frac  | 0
n_distinct | -1

-[ RECORD 1 ]--------------------------
tablename  | chat_conversation_members
attname    | muted_until
null_frac  | 1
n_distinct | 0
-[ RECORD 2 ]--------------------------
tablename  | chat_conversation_messages
attname    | edited_at
null_frac  | 1
n_distinct | 0
-[ RECORD 3 ]--------------------------
tablename  | chat_conversation_messages
attname    | reply_to_id
null_frac  | 1
n_distinct | 0
-[ RECORD 4 ]--------------------------
tablename  | chat_conversations
attname    | description
null_frac  | 1
n_distinct | 0
-[ RECORD 5 ]--------------------------
tablename  | chat_threads
attname    | legal_hold_until
null_frac  | 1
n_distinct | 0
-[ RECORD 6 ]--------------------------
tablename  | chat_conversation_messages
attname    | deleted_at
null_frac  | 0.981481
n_distinct | -0.0185185

(0 rows)

COMMIT

```
