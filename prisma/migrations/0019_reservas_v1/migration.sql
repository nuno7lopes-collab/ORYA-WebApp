DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ServiceLocationMode' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."ServiceLocationMode" AS ENUM ('FIXED', 'CHOOSE_AT_BOOKING');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ServiceCreditBalanceStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."ServiceCreditBalanceStatus" AS ENUM ('ACTIVE', 'DEPLETED', 'EXPIRED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ServiceCreditLedgerType' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."ServiceCreditLedgerType" AS ENUM ('PURCHASE', 'CONSUME', 'REFUND_CREDIT', 'EXPIRE', 'ADMIN_ADJUST');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'AvailabilityOverrideKind' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."AvailabilityOverrideKind" AS ENUM ('CLOSED', 'OPEN', 'BLOCK');
  END IF;
END $$;

ALTER TYPE app_v3."BookingStatus" ADD VALUE IF NOT EXISTS 'PENDING_CONFIRMATION';
ALTER TYPE app_v3."BookingStatus" ADD VALUE IF NOT EXISTS 'CANCELLED_BY_CLIENT';
ALTER TYPE app_v3."BookingStatus" ADD VALUE IF NOT EXISTS 'CANCELLED_BY_ORG';
ALTER TYPE app_v3."BookingStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE app_v3."BookingStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW';
ALTER TYPE app_v3."BookingStatus" ADD VALUE IF NOT EXISTS 'DISPUTED';

ALTER TABLE app_v3.organizations
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Europe/Lisbon';

ALTER TABLE app_v3.services
  ADD COLUMN IF NOT EXISTS category_tag TEXT,
  ADD COLUMN IF NOT EXISTS location_mode app_v3."ServiceLocationMode" NOT NULL DEFAULT 'FIXED',
  ADD COLUMN IF NOT EXISTS default_location_text TEXT;

ALTER TABLE app_v3.bookings
  ADD COLUMN IF NOT EXISTS pending_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS snapshot_timezone TEXT NOT NULL DEFAULT 'Europe/Lisbon',
  ADD COLUMN IF NOT EXISTS location_mode app_v3."ServiceLocationMode" NOT NULL DEFAULT 'FIXED',
  ADD COLUMN IF NOT EXISTS location_text TEXT;

CREATE TABLE IF NOT EXISTS app_v3.service_packs (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  pack_price_cents INTEGER NOT NULL,
  label TEXT,
  recommended BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_packs_service_fk
    FOREIGN KEY (service_id) REFERENCES app_v3.services(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS service_packs_service_idx
  ON app_v3.service_packs (service_id);
CREATE INDEX IF NOT EXISTS service_packs_active_idx
  ON app_v3.service_packs (is_active);

CREATE TABLE IF NOT EXISTS app_v3.service_credit_balances (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  service_id INTEGER NOT NULL,
  remaining_units INTEGER NOT NULL,
  expires_at TIMESTAMPTZ,
  status app_v3."ServiceCreditBalanceStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_credit_balances_user_fk
    FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT service_credit_balances_service_fk
    FOREIGN KEY (service_id) REFERENCES app_v3.services(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT service_credit_balances_user_service_unique UNIQUE (user_id, service_id)
);

CREATE INDEX IF NOT EXISTS service_credit_balances_service_idx
  ON app_v3.service_credit_balances (service_id);
CREATE INDEX IF NOT EXISTS service_credit_balances_expires_idx
  ON app_v3.service_credit_balances (expires_at);

CREATE TABLE IF NOT EXISTS app_v3.service_credit_ledger (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  service_id INTEGER NOT NULL,
  booking_id INTEGER,
  payment_intent_id TEXT,
  change_units INTEGER NOT NULL,
  type app_v3."ServiceCreditLedgerType" NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_credit_ledger_user_fk
    FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT service_credit_ledger_service_fk
    FOREIGN KEY (service_id) REFERENCES app_v3.services(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT service_credit_ledger_booking_fk
    FOREIGN KEY (booking_id) REFERENCES app_v3.bookings(id) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT service_credit_ledger_balance_fk
    FOREIGN KEY (user_id, service_id)
    REFERENCES app_v3.service_credit_balances(user_id, service_id)
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS service_credit_ledger_user_service_idx
  ON app_v3.service_credit_ledger (user_id, service_id);
CREATE INDEX IF NOT EXISTS service_credit_ledger_booking_idx
  ON app_v3.service_credit_ledger (booking_id);
CREATE INDEX IF NOT EXISTS service_credit_ledger_pi_idx
  ON app_v3.service_credit_ledger (payment_intent_id);

CREATE TABLE IF NOT EXISTS app_v3.weekly_availability_templates (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  intervals JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT weekly_availability_templates_org_fk
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT weekly_availability_org_day_unique UNIQUE (organization_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS weekly_availability_templates_org_idx
  ON app_v3.weekly_availability_templates (organization_id);

CREATE TABLE IF NOT EXISTS app_v3.availability_overrides (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  date DATE NOT NULL,
  kind app_v3."AvailabilityOverrideKind" NOT NULL,
  intervals JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT availability_overrides_org_fk
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS availability_overrides_org_date_idx
  ON app_v3.availability_overrides (organization_id, date);

CREATE TABLE IF NOT EXISTS app_v3.service_reviews (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL UNIQUE,
  service_id INTEGER NOT NULL,
  organization_id INTEGER NOT NULL,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_reviews_booking_fk
    FOREIGN KEY (booking_id) REFERENCES app_v3.bookings(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT service_reviews_service_fk
    FOREIGN KEY (service_id) REFERENCES app_v3.services(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT service_reviews_org_fk
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT service_reviews_user_fk
    FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS service_reviews_service_idx
  ON app_v3.service_reviews (service_id);
CREATE INDEX IF NOT EXISTS service_reviews_org_idx
  ON app_v3.service_reviews (organization_id);
CREATE INDEX IF NOT EXISTS service_reviews_user_idx
  ON app_v3.service_reviews (user_id);

CREATE INDEX IF NOT EXISTS bookings_pending_expires_idx
  ON app_v3.bookings (pending_expires_at);

CREATE INDEX IF NOT EXISTS services_category_tag_idx
  ON app_v3.services (category_tag);
