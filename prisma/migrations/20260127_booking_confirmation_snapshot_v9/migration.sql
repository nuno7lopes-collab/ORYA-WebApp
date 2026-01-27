ALTER TABLE app_v3.organization_policies
  ADD COLUMN IF NOT EXISTS guest_booking_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_pay_at_venue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_amount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_show_fee_cents integer NOT NULL DEFAULT 0;

ALTER TABLE app_v3.bookings
  ADD COLUMN IF NOT EXISTS confirmation_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS confirmation_snapshot_version integer,
  ADD COLUMN IF NOT EXISTS confirmation_snapshot_created_at timestamptz;
