-- Cleanup unused columns after code/schema audit
ALTER TABLE app_v3.profiles
  DROP COLUMN IF EXISTS padel_level,
  DROP COLUMN IF EXISTS padel_dominant_hand,
  DROP COLUMN IF EXISTS padel_position;

ALTER TABLE app_v3.organizations
  DROP COLUMN IF EXISTS refund_fee_payer,
  DROP COLUMN IF EXISTS is_platform_owned;

ALTER TABLE app_v3.notifications
  DROP COLUMN IF EXISTS seen_at;

ALTER TABLE app_v3.tickets
  DROP COLUMN IF EXISTS padel_pairing_version;

ALTER TABLE app_v3.guest_ticket_links
  DROP COLUMN IF EXISTS migrated_to_user_id,
  DROP COLUMN IF EXISTS migrated_at;

ALTER TABLE app_v3.padel_tournament_configs
  DROP COLUMN IF EXISTS allow_captain_assume,
  DROP COLUMN IF EXISTS auto_cancel_unpaid,
  DROP COLUMN IF EXISTS club_hours,
  DROP COLUMN IF EXISTS default_payment_mode,
  DROP COLUMN IF EXISTS refund_fee_payer;

ALTER TABLE app_v3.padel_pairings
  DROP COLUMN IF EXISTS captain_consent_at,
  DROP COLUMN IF EXISTS captain_first_sale_id,
  DROP COLUMN IF EXISTS captain_second_sale_id,
  DROP COLUMN IF EXISTS partner_sale_id,
  DROP COLUMN IF EXISTS player2_identity_id,
  DROP COLUMN IF EXISTS setup_intent_id;

ALTER TABLE app_v3.entitlements
  DROP COLUMN IF EXISTS snapshot_version;
