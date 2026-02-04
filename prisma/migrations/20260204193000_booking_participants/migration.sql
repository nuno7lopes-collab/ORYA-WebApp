-- CreateEnum
DO $$ BEGIN
  CREATE TYPE app_v3."BookingParticipantStatus" AS ENUM ('CONFIRMED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS app_v3.booking_participants (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  booking_id INTEGER NOT NULL,
  invite_id INTEGER UNIQUE,
  user_id UUID,
  name TEXT,
  contact CITEXT,
  status app_v3."BookingParticipantStatus" NOT NULL DEFAULT 'CONFIRMED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS booking_participants_booking_id_idx ON app_v3.booking_participants (booking_id);
CREATE INDEX IF NOT EXISTS booking_participants_invite_id_idx ON app_v3.booking_participants (invite_id);
CREATE INDEX IF NOT EXISTS booking_participants_user_id_idx ON app_v3.booking_participants (user_id);
CREATE INDEX IF NOT EXISTS booking_participants_status_idx ON app_v3.booking_participants (status);

-- Foreign Keys
ALTER TABLE app_v3.booking_participants
  ADD CONSTRAINT booking_participants_booking_id_fkey
  FOREIGN KEY (booking_id)
  REFERENCES app_v3.bookings(id)
  ON DELETE CASCADE;

ALTER TABLE app_v3.booking_participants
  ADD CONSTRAINT booking_participants_invite_id_fkey
  FOREIGN KEY (invite_id)
  REFERENCES app_v3.booking_invites(id)
  ON DELETE SET NULL;

ALTER TABLE app_v3.booking_participants
  ADD CONSTRAINT booking_participants_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES app_v3.profiles(id)
  ON DELETE SET NULL;
