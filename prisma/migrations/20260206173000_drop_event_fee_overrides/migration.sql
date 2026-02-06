-- Drop legacy per-event fee override columns
ALTER TABLE app_v3.events
  DROP COLUMN IF EXISTS fee_mode_override,
  DROP COLUMN IF EXISTS platform_fee_bps_override,
  DROP COLUMN IF EXISTS platform_fee_fixed_cents_override;
