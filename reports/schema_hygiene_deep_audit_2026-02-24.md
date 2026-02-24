# Schema Hygiene Deep Audit

- GeneratedAtUTC: 2026-02-24T14:58:16.925Z
- Scope: live DB + static scan partitioned by runtime/scripts/tests

## Inventario de schemas (live DB)

- Schemas: app_v3, auth, extensions, graphql, graphql_public, public, realtime, storage, vault
- Contagem de tabelas por schema:
  - app_v3: 231
  - auth: 20
  - public: 1
  - realtime: 3
  - storage: 8
  - vault: 1
- `out` schema: inexistente.

## Cobertura app_v3

- Tabelas app_v3: 231
- Modelos Prisma app_v3: 230
- Tabelas sem modelo Prisma: 1 (cron_job_locks)
- Modelos sem tabela física: 0

## Estado de migrações

- `npm run db:status` em 2026-02-24 reportou 1 migração pendente:
  - `20260224143500_padel_result_validation_mode_enum_alignment`
- O schema físico já expõe `result_validation_mode` no enum canónico, mas o enum legado ainda existe (`app_v3.padel_result_validation_mode`), por isso a higienização não está concluída ao nível de histórico de migrações.

## Atualizacao de runtime (2026-02-24 15:24 UTC)

- Aplicada remocao de fallback Supabase `profiles` em:
  - `app/api/me/route.ts`
  - `app/api/public/profile/route.ts`
  - `app/api/public/profile/events/route.ts`
- Após patch, uso runtime de `.from("profiles")` ficou restrito ao job interno:
  - `app/api/cron/repair-usernames/route.ts`

## Classificacao por uso runtime (app/lib/domain/components/packages/apps)

- runtime_referenced_with_data: 118
- runtime_referenced_empty: 105
- runtime_unreferenced_with_data: 1
- runtime_unreferenced_empty: 7

### Runtime unreferenced + empty (candidatos fortes a limpeza)
- chat_conversation_attachments (scripts_refs=2, tests_refs=0, scans=4717, writes=3, size_mb=0.031)
- crm_journey_enrollments (scripts_refs=0, tests_refs=0, scans=54, writes=30, size_mb=0.039)
- crm_journey_runs (scripts_refs=0, tests_refs=0, scans=54, writes=30, size_mb=0.031)
- padel_partnership_tournament_requests (scripts_refs=0, tests_refs=0, scans=9, writes=0, size_mb=0.070)
- refund_policy_versions (scripts_refs=1, tests_refs=0, scans=935, writes=0, size_mb=0.031)
- store_order_bundle_items (scripts_refs=2, tests_refs=0, scans=211, writes=0, size_mb=0.047)
- ticket_order_lines (scripts_refs=0, tests_refs=0, scans=1451, writes=0, size_mb=0.039)

### Runtime unreferenced + com dados (nao apagar sem owner)
- store_order_addresses (rows=40, scripts_refs=2, tests_refs=0)

### Runtime referenced + empty (feature flag, seed pendente ou legado ativo sem dados)
- class_sessions (runtime_refs=32, scans=887, writes=0)
- padel_registrations (runtime_refs=28, scans=13550, writes=12)
- padel_court_blocks (runtime_refs=26, scans=1527, writes=0)
- booking_split_participants (runtime_refs=20, scans=93, writes=0)
- group_membership_requests (runtime_refs=20, scans=599, writes=0)
- padel_partnership_agreements (runtime_refs=20, scans=404, writes=0)
- store_carts (runtime_refs=20, scans=568, writes=27)
- booking_splits (runtime_refs=19, scans=3463, writes=0)
- soft_blocks (runtime_refs=19, scans=60, writes=0)
- organization_member_overrides (runtime_refs=17, scans=56442, writes=0)
- store_bundles (runtime_refs=17, scans=722, writes=1)
- agenda_resource_claims (runtime_refs=16, scans=1067, writes=0)
- booking_invites (runtime_refs=16, scans=2947, writes=0)
- store_product_options (runtime_refs=15, scans=307, writes=0)
- entitlement_qr_tokens (runtime_refs=14, scans=420, writes=33)
- organization_form_submissions (runtime_refs=14, scans=914, writes=0)
- padel_club_staff_invites (runtime_refs=14, scans=388, writes=0)
- padel_team_member_invites (runtime_refs=14, scans=341, writes=0)
- tournament_matches (runtime_refs=14, scans=1288, writes=0)
- event_invites (runtime_refs=13, scans=3299, writes=9)
- padel_availabilities (runtime_refs=13, scans=1219, writes=0)
- padel_partnership_windows (runtime_refs=13, scans=387, writes=0)
- availability_change_sets (runtime_refs=12, scans=84, writes=0)
- follow_requests (runtime_refs=12, scans=1256, writes=12)
- availability_change_conflicts (runtime_refs=11, scans=4, writes=0)
- booking_change_requests (runtime_refs=11, scans=3912, writes=0)
- entitlement_checkins (runtime_refs=11, scans=504, writes=1)
- organization_official_email_requests (runtime_refs=11, scans=4208, writes=14)
- padel_partner_role_grants (runtime_refs=11, scans=2066, writes=0)
- padel_schedule_runs (runtime_refs=11, scans=150, writes=0)
- padel_waitlist_entries (runtime_refs=11, scans=6594, writes=0)
- store_product_option_values (runtime_refs=11, scans=74, writes=0)
- email_outbox (runtime_refs=10, scans=216, writes=0)
- padel_partnership_overrides (runtime_refs=10, scans=1413, writes=0)
- store_digital_assets (runtime_refs=10, scans=158, writes=0)
- ticket_resales (runtime_refs=10, scans=4947, writes=0)
- admin_mfa (runtime_refs=9, scans=148, writes=7)
- booking_split_share_attempts (runtime_refs=9, scans=31, writes=0)
- crm_journeys (runtime_refs=9, scans=81, writes=10)
- loyalty_ledger (runtime_refs=9, scans=259, writes=6)
- loyalty_programs (runtime_refs=9, scans=486, writes=5)
- organization_group_owner_transfers (runtime_refs=9, scans=572, writes=0)
- store_cart_items (runtime_refs=9, scans=690, writes=46)
- store_shipping_tiers (runtime_refs=9, scans=95, writes=0)
- chat_message_reactions (runtime_refs=8, scans=4728, writes=11)
- crm_saved_views (runtime_refs=8, scans=105, writes=10)
- padel_partnership_compensation_cases (runtime_refs=8, scans=1101, writes=0)
- padel_rating_sanctions (runtime_refs=8, scans=102, writes=0)
- service_credit_balances (runtime_refs=8, scans=5004, writes=0)
- store_digital_grants (runtime_refs=8, scans=491, writes=0)
- support_tickets (runtime_refs=8, scans=35, writes=0)
- agenda_arbitration_decisions (runtime_refs=7, scans=868, writes=0)
- chat_user_blocks (runtime_refs=7, scans=134, writes=0)
- padel_match_result_cards (runtime_refs=7, scans=2262, writes=0)
- padel_registration_lines (runtime_refs=7, scans=48, writes=4)
- store_bundle_items (runtime_refs=7, scans=741, writes=2)
- class_series (runtime_refs=6, scans=837, writes=0)
- identity_tombstones (runtime_refs=6, scans=621, writes=0)
- organization_step_up_challenges (runtime_refs=6, scans=34, writes=0)
- ticket_reservations (runtime_refs=6, scans=43273, writes=0)

## Tabelas usadas apenas em scripts ou testes

- apenas scripts: 4
- chat_conversation_attachments (scripts_refs=2, rows=0)
- refund_policy_versions (scripts_refs=1, rows=0)
- store_order_addresses (scripts_refs=2, rows=40)
- store_order_bundle_items (scripts_refs=2, rows=0)

- apenas testes: 0
- apenas testes: (nenhuma)

## Supabase .from/.schema

- Runtime .from(): profiles:1 (apos patch runtime 15:24 UTC)
- Runtime .schema(): none
- Schemas existentes no DB (subset publico): app_v3, auth, graphql_public, public
- Resultado de teste API REST Supabase nesta env: schema permitido = public/graphql_public; app_v3 nao exposto.

## Redundancia estrutural (pares com alto overlap de colunas)

- `padel_registrations` <-> `ticket_orders` (score=0.90)
- `organization_member_invites` <-> `padel_team_member_invites` (score=0.88)
- `crm_contact_consents` <-> `user_consents` (score=0.85)
- `organization_group_owner_transfers` <-> `organization_owner_transfers` (score=0.83)
- `padel_club_staff_invites` <-> `padel_team_member_invites` (score=0.82)
- `organization_member_invites` <-> `padel_club_staff_invites` (score=0.82)
- Nota: isto indica redundancia estrutural (shape parecido), não prova de redundancia funcional.

## Colunas candidatas (null_frac>=0.99, sem constraints, tabela sem refs runtime)

- total: 0
- (nenhuma)

## Indices com idx_scan=0 (candidato a revisao, nao drop automatico)

- total: 435
- tournament_entries.tournament_entries_pairing_idx (size_mb=0.203)
- padel_rating_events.padel_rating_events_pkey (size_mb=0.055)
- tickets.tickets_qr_secret_key (size_mb=0.055)
- user_event_signals.user_event_signals_pkey (size_mb=0.039)
- padel_rating_events.padel_rating_events_player_created_idx (size_mb=0.039)
- sale_lines.sale_lines_pkey (size_mb=0.039)
- crm_contact_consents.crm_contact_consents_pkey (size_mb=0.039)
- analytics_rollups.analytics_rollups_pkey (size_mb=0.039)
- chat_conversation_messages.chat_conversation_messages_search_idx (size_mb=0.031)
- padel_tournament_roles.padel_tournament_roles_user_idx (size_mb=0.016)
- ticket_types.env_idx_47fdbbd5 (size_mb=0.016)
- notifications.notifications_invite_id_idx (size_mb=0.016)
- email_identities.env_idx_1edf1409 (size_mb=0.016)
- organization_member_invites.organization_member_invites_identifier_idx (size_mb=0.016)
- organization_member_invites.organization_member_invites_target_idx (size_mb=0.016)
- padel_ranking_entries.env_idx_93d362e5 (size_mb=0.016)
- bookings.bookings_party_size_idx (size_mb=0.016)
- services.services_category_tag_idx (size_mb=0.016)
- services.services_address_idx (size_mb=0.016)
- promo_codes.promo_codes_code_ci_unique (size_mb=0.016)
- promo_codes.promo_codes_valid_idx (size_mb=0.016)
- tournaments.env_idx_39412d6e (size_mb=0.016)
- user_activities.user_activities_type_idx (size_mb=0.016)
- user_activities.env_idx_8214c16b (size_mb=0.016)
- trainer_profiles.trainer_profiles_org_published_idx (size_mb=0.016)
- trainer_profiles.trainer_profiles_org_prof_unique (size_mb=0.016)
- trainer_profiles.trainer_profiles_professional_idx (size_mb=0.016)
- chat_conversations.chat_conversations_user_dm_pair_unique (size_mb=0.016)
- chat_conversations.chat_conversations_org_context_customer_unique (size_mb=0.016)
- chat_conversations.env_idx_0e6432ae (size_mb=0.016)
- chat_conversations.chat_conversations_customer_idx (size_mb=0.016)
- chat_conversations.chat_conversations_professional_idx (size_mb=0.016)
- crm_interactions.env_idx_c4abea79 (size_mb=0.016)
- crm_campaign_deliveries.env_idx_0486ed6e (size_mb=0.016)
- service_duration_prices.service_duration_prices_service_idx (size_mb=0.016)
- chat_conversation_members.env_idx_0a8fb88f (size_mb=0.016)
- organization_groups.env_idx_78796d20 (size_mb=0.016)
- schedule_delays.schedule_delays_pkey (size_mb=0.016)
- schedule_delays.schedule_delays_env_idx (size_mb=0.016)
- schedule_delays.env_idx_af81546d (size_mb=0.016)
- booking_participants.booking_participants_pkey (size_mb=0.016)
- booking_participants.booking_participants_invite_id_key (size_mb=0.016)
- booking_participants.booking_participants_invite_id_idx (size_mb=0.016)
- booking_participants.booking_participants_status_idx (size_mb=0.016)
- booking_participants.env_idx_f8b28f07 (size_mb=0.016)
- booking_charges.booking_charges_pkey (size_mb=0.016)
- booking_charges.booking_charges_token_unique (size_mb=0.016)
- booking_charges.booking_charges_status_idx (size_mb=0.016)
- booking_charges.booking_charges_payment_intent_idx (size_mb=0.016)
- event_favorites.event_favorites_pkey (size_mb=0.016)
- user_event_signals.user_event_signals_org_idx (size_mb=0.016)
- crm_contact_padel.crm_contact_padel_pkey (size_mb=0.016)
- crm_contact_padel.crm_contact_padel_org_contact_idx (size_mb=0.016)
- crm_contact_padel.crm_contact_padel_env_idx (size_mb=0.016)
- padel_rating_profiles.padel_rating_profiles_pkey (size_mb=0.016)
- padel_rating_events.padel_rating_events_org_idx (size_mb=0.016)
- padel_rating_events.padel_rating_events_org_tier_idx (size_mb=0.016)
- reservation_professionals.reservation_professionals_org_user_unique (size_mb=0.016)
- crm_contact_notes.crm_contact_notes_pkey (size_mb=0.016)
- crm_contact_notes.crm_contact_notes_env_idx (size_mb=0.016)
- store_orders.store_orders_order_number_unique (size_mb=0.016)
- store_orders.store_orders_payment_intent_idx (size_mb=0.016)
- store_orders.store_orders_purchase_idx (size_mb=0.016)
- padel_team_members.padel_team_members_team_idx (size_mb=0.016)
- padel_tournament_participants.padel_tournament_participants_org_idx (size_mb=0.016)
- padel_tournament_participants.padel_tournament_participants_status_idx (size_mb=0.016)
- entitlements.entitlements_season_idx (size_mb=0.016)
- entitlements.entitlements_tournament_idx (size_mb=0.016)
- entitlements.entitlements_store_line_idx (size_mb=0.016)
- organizations.organizations_status_idx (size_mb=0.016)
- organizations.organizations_address_idx (size_mb=0.016)
- promo_redemptions.promo_redemptions_guest_email_idx (size_mb=0.016)
- promo_redemptions.promo_redemptions_purchase_idx (size_mb=0.016)
- promo_redemptions.promo_redemptions_user_idx (size_mb=0.016)
- promo_redemptions.env_idx_5c5ff6ce (size_mb=0.016)
- service_packs.service_packs_active_idx (size_mb=0.016)
- service_packs.env_idx_60298a0a (size_mb=0.016)
- service_professionals.env_idx_ce56d5ad (size_mb=0.016)
- service_resources.env_idx_bf01e8f5 (size_mb=0.016)
- store_order_lines.store_order_lines_pkey (size_mb=0.016)

## Artefactos

- reports/schema_hygiene_deep_audit_2026-02-24.md
- reports/schema_hygiene_table_inventory_2026-02-24.csv
- reports/schema_hygiene_column_candidates_2026-02-24.csv
- reports/schema_hygiene_columns_inventory_2026-02-24.csv
- reports/schema_hygiene_columns_never_populated_2026-02-24.csv
- reports/schema_hygiene_field_decision_seed_2026-02-24.csv
- reports/schema_hygiene_table_overlap_candidates_2026-02-24.csv
- reports/schema_hygiene_execution_plan_2026-02-24.md
- reports/schema_hygiene_action_matrix_2026-02-24.csv

## Limites

- Static scan nao apanha SQL dinamico/servicos externos.
- idx_scan=0 e null_frac alto sao sinais, nao prova de desnecessidade.
- Confirmar ownership funcional antes de qualquer DROP TABLE/DROP COLUMN.
