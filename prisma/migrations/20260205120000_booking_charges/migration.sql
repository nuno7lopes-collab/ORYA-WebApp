CREATE TYPE app_v3."BookingChargeStatus" AS ENUM ('OPEN', 'PAID', 'CANCELLED');
CREATE TYPE app_v3."BookingChargeKind" AS ENUM ('BASE', 'DEPOSIT', 'EXTRA', 'SPLIT_PART');
CREATE TYPE app_v3."BookingChargePayerKind" AS ENUM ('ORGANIZER', 'INVITEE');

CREATE TABLE IF NOT EXISTS app_v3.booking_charges (
  id SERIAL PRIMARY KEY,
  env text NOT NULL DEFAULT 'prod',
  booking_id integer NOT NULL,
  organization_id integer NOT NULL,
  created_by_user_id uuid NULL,
  token text NOT NULL,
  kind app_v3."BookingChargeKind" NOT NULL DEFAULT 'EXTRA',
  payer_kind app_v3."BookingChargePayerKind" NOT NULL DEFAULT 'ORGANIZER',
  status app_v3."BookingChargeStatus" NOT NULL DEFAULT 'OPEN',
  label text NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  payment_intent_id text NULL,
  payment_id text NULL,
  paid_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_charges_booking_fk FOREIGN KEY (booking_id) REFERENCES app_v3.bookings(id) ON DELETE CASCADE,
  CONSTRAINT booking_charges_org_fk FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT booking_charges_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS booking_charges_token_unique ON app_v3.booking_charges(token);
CREATE INDEX IF NOT EXISTS booking_charges_booking_idx ON app_v3.booking_charges(booking_id);
CREATE INDEX IF NOT EXISTS booking_charges_org_idx ON app_v3.booking_charges(organization_id);
CREATE INDEX IF NOT EXISTS booking_charges_status_idx ON app_v3.booking_charges(status);
CREATE INDEX IF NOT EXISTS booking_charges_payment_intent_idx ON app_v3.booking_charges(payment_intent_id);
