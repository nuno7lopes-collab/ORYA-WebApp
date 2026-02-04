DO $$ BEGIN
  CREATE TYPE app_v3."BookingSplitStatus" AS ENUM ('OPEN', 'COMPLETED', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE app_v3."BookingSplitPricingMode" AS ENUM ('FIXED', 'DYNAMIC');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE app_v3."BookingSplitParticipantStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS app_v3.booking_splits (
  env text NOT NULL DEFAULT 'prod',
  id serial PRIMARY KEY,
  booking_id integer NOT NULL UNIQUE,
  organization_id integer NOT NULL,
  created_by_user_id uuid,
  pricing_mode app_v3."BookingSplitPricingMode" NOT NULL DEFAULT 'FIXED',
  status app_v3."BookingSplitStatus" NOT NULL DEFAULT 'OPEN',
  currency text NOT NULL DEFAULT 'EUR',
  total_cents integer NOT NULL,
  share_cents integer,
  deadline_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_splits_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES app_v3.bookings(id) ON DELETE CASCADE,
  CONSTRAINT booking_splits_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT booking_splits_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS booking_splits_org_idx ON app_v3.booking_splits (organization_id);
CREATE INDEX IF NOT EXISTS booking_splits_status_idx ON app_v3.booking_splits (status);

CREATE TABLE IF NOT EXISTS app_v3.booking_split_participants (
  env text NOT NULL DEFAULT 'prod',
  id serial PRIMARY KEY,
  split_id integer NOT NULL,
  invite_id integer UNIQUE,
  user_id uuid,
  name text,
  contact citext,
  base_share_cents integer NOT NULL,
  share_cents integer NOT NULL,
  platform_fee_cents integer NOT NULL DEFAULT 0,
  status app_v3."BookingSplitParticipantStatus" NOT NULL DEFAULT 'PENDING',
  payment_intent_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_split_participants_split_id_fkey FOREIGN KEY (split_id) REFERENCES app_v3.booking_splits(id) ON DELETE CASCADE,
  CONSTRAINT booking_split_participants_invite_id_fkey FOREIGN KEY (invite_id) REFERENCES app_v3.booking_invites(id) ON DELETE SET NULL,
  CONSTRAINT booking_split_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS booking_split_participants_split_idx ON app_v3.booking_split_participants (split_id);
CREATE INDEX IF NOT EXISTS booking_split_participants_invite_idx ON app_v3.booking_split_participants (invite_id);
CREATE INDEX IF NOT EXISTS booking_split_participants_user_idx ON app_v3.booking_split_participants (user_id);
CREATE INDEX IF NOT EXISTS booking_split_participants_status_idx ON app_v3.booking_split_participants (status);
CREATE INDEX IF NOT EXISTS booking_split_participants_payment_intent_idx ON app_v3.booking_split_participants (payment_intent_id);
