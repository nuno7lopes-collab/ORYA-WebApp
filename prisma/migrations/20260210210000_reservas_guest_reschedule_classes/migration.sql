-- Guest bookings + reschedule requests + class sessions

-- Add new enum values to existing enums
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'SourceType' AND n.nspname = 'app_v3'
  ) THEN
    BEGIN
      ALTER TYPE app_v3."SourceType" ADD VALUE IF NOT EXISTS 'CLASS_SESSION';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'NotificationType' AND n.nspname = 'app_v3'
  ) THEN
    BEGIN
      ALTER TYPE app_v3."NotificationType" ADD VALUE IF NOT EXISTS 'BOOKING_CHANGE_REQUEST';
      ALTER TYPE app_v3."NotificationType" ADD VALUE IF NOT EXISTS 'BOOKING_CHANGE_RESPONSE';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'BookingChangeRequestStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."BookingChangeRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'BookingChangeRequestedBy' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."BookingChangeRequestedBy" AS ENUM ('ORG', 'USER');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ClassSessionStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."ClassSessionStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'COMPLETED');
  END IF;
END $$;

-- Booking guest fields
ALTER TABLE app_v3.bookings
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE app_v3.bookings
  ADD COLUMN IF NOT EXISTS guest_email CITEXT,
  ADD COLUMN IF NOT EXISTS guest_name TEXT,
  ADD COLUMN IF NOT EXISTS guest_phone TEXT;

CREATE INDEX IF NOT EXISTS bookings_guest_email_idx ON app_v3.bookings(guest_email);

-- Remove pay-at-venue / deposit from policies
ALTER TABLE app_v3.organization_policies
  DROP COLUMN IF EXISTS allow_pay_at_venue,
  DROP COLUMN IF EXISTS deposit_required,
  DROP COLUMN IF EXISTS deposit_amount_cents;

-- Booking change requests
CREATE TABLE IF NOT EXISTS app_v3.booking_change_requests (
  env TEXT NOT NULL DEFAULT 'prod',
  id SERIAL PRIMARY KEY,
  booking_id INT NOT NULL,
  organization_id INT NOT NULL,
  requested_by app_v3."BookingChangeRequestedBy" NOT NULL,
  requested_by_user_id UUID,
  status app_v3."BookingChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  proposed_starts_at TIMESTAMPTZ NOT NULL,
  proposed_court_id INT,
  proposed_professional_id INT,
  proposed_resource_id INT,
  price_delta_cents INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  responded_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT booking_change_requests_booking_fkey FOREIGN KEY (booking_id) REFERENCES app_v3.bookings(id) ON DELETE CASCADE,
  CONSTRAINT booking_change_requests_org_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT booking_change_requests_court_fkey FOREIGN KEY (proposed_court_id) REFERENCES app_v3.padel_club_courts(id) ON DELETE SET NULL,
  CONSTRAINT booking_change_requests_prof_fkey FOREIGN KEY (proposed_professional_id) REFERENCES app_v3.reservation_professionals(id) ON DELETE SET NULL,
  CONSTRAINT booking_change_requests_resource_fkey FOREIGN KEY (proposed_resource_id) REFERENCES app_v3.reservation_resources(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS booking_change_requests_booking_idx ON app_v3.booking_change_requests(booking_id);
CREATE INDEX IF NOT EXISTS booking_change_requests_org_status_idx ON app_v3.booking_change_requests(organization_id, status);
CREATE INDEX IF NOT EXISTS booking_change_requests_expires_idx ON app_v3.booking_change_requests(expires_at);

-- Class series
CREATE TABLE IF NOT EXISTS app_v3.class_series (
  env TEXT NOT NULL DEFAULT 'prod',
  id SERIAL PRIMARY KEY,
  organization_id INT NOT NULL,
  service_id INT NOT NULL,
  court_id INT,
  professional_id INT,
  day_of_week INT NOT NULL,
  start_minute INT NOT NULL,
  duration_minutes INT NOT NULL,
  capacity INT NOT NULL DEFAULT 1,
  valid_from DATE NOT NULL,
  valid_until DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT class_series_org_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT class_series_service_fkey FOREIGN KEY (service_id) REFERENCES app_v3.services(id) ON DELETE CASCADE,
  CONSTRAINT class_series_court_fkey FOREIGN KEY (court_id) REFERENCES app_v3.padel_club_courts(id) ON DELETE SET NULL,
  CONSTRAINT class_series_prof_fkey FOREIGN KEY (professional_id) REFERENCES app_v3.reservation_professionals(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS class_series_org_idx ON app_v3.class_series(organization_id);
CREATE INDEX IF NOT EXISTS class_series_service_idx ON app_v3.class_series(service_id);
CREATE INDEX IF NOT EXISTS class_series_court_idx ON app_v3.class_series(court_id);
CREATE INDEX IF NOT EXISTS class_series_active_idx ON app_v3.class_series(is_active);

-- Class sessions
CREATE TABLE IF NOT EXISTS app_v3.class_sessions (
  env TEXT NOT NULL DEFAULT 'prod',
  id SERIAL PRIMARY KEY,
  series_id INT NOT NULL,
  organization_id INT NOT NULL,
  service_id INT NOT NULL,
  court_id INT,
  professional_id INT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  capacity INT NOT NULL DEFAULT 1,
  status app_v3."ClassSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT class_sessions_series_fkey FOREIGN KEY (series_id) REFERENCES app_v3.class_series(id) ON DELETE CASCADE,
  CONSTRAINT class_sessions_org_fkey FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT class_sessions_service_fkey FOREIGN KEY (service_id) REFERENCES app_v3.services(id) ON DELETE CASCADE,
  CONSTRAINT class_sessions_court_fkey FOREIGN KEY (court_id) REFERENCES app_v3.padel_club_courts(id) ON DELETE SET NULL,
  CONSTRAINT class_sessions_prof_fkey FOREIGN KEY (professional_id) REFERENCES app_v3.reservation_professionals(id) ON DELETE SET NULL,
  CONSTRAINT class_sessions_series_start_unique UNIQUE (series_id, starts_at)
);

CREATE INDEX IF NOT EXISTS class_sessions_org_start_idx ON app_v3.class_sessions(organization_id, starts_at);
CREATE INDEX IF NOT EXISTS class_sessions_court_start_idx ON app_v3.class_sessions(court_id, starts_at);
CREATE INDEX IF NOT EXISTS class_sessions_status_idx ON app_v3.class_sessions(status);
