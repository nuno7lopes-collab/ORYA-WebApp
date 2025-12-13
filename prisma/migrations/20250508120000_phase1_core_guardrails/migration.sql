-- Fase 1: bases para transferências seguras, email oficial e check-ins

-- official_email_verified_at nos organizers
ALTER TABLE app_v3.organizers
  ADD COLUMN IF NOT EXISTS official_email_verified_at timestamptz;

-- Feature flag global para transferências de owner
INSERT INTO app_v3.platform_settings (key, value, created_at, updated_at)
VALUES ('org_transfer_enabled', 'false', now(), now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Estados de transferência de owner
DO $$
BEGIN
  CREATE TYPE app_v3."OrganizerOwnerTransferStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- Estados de verificação de email oficial
DO $$
BEGIN
  CREATE TYPE app_v3."OrganizerEmailRequestStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

CREATE TABLE IF NOT EXISTS app_v3.organization_owner_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id integer NOT NULL,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  status app_v3."OrganizerOwnerTransferStatus" NOT NULL DEFAULT 'PENDING',
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  CONSTRAINT organization_owner_transfers_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES app_v3.organizers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS organization_owner_transfers_org_idx ON app_v3.organization_owner_transfers (organizer_id);
CREATE INDEX IF NOT EXISTS organization_owner_transfers_from_idx ON app_v3.organization_owner_transfers (from_user_id);
CREATE INDEX IF NOT EXISTS organization_owner_transfers_to_idx ON app_v3.organization_owner_transfers (to_user_id);

CREATE TABLE IF NOT EXISTS app_v3.organizer_official_email_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id integer NOT NULL,
  requested_by_user_id uuid NOT NULL,
  new_email citext NOT NULL,
  token text NOT NULL UNIQUE,
  status app_v3."OrganizerEmailRequestStatus" NOT NULL DEFAULT 'PENDING',
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  CONSTRAINT organizer_official_email_requests_org_fkey FOREIGN KEY (organizer_id) REFERENCES app_v3.organizers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS organizer_official_email_requests_org_idx ON app_v3.organizer_official_email_requests (organizer_id);
CREATE INDEX IF NOT EXISTS organizer_official_email_requests_requestor_idx ON app_v3.organizer_official_email_requests (requested_by_user_id);

CREATE TABLE IF NOT EXISTS app_v3.organization_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id integer NOT NULL,
  actor_user_id uuid,
  action text NOT NULL,
  from_user_id uuid,
  to_user_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT organization_audit_logs_organizer_fkey FOREIGN KEY (organizer_id) REFERENCES app_v3.organizers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS organization_audit_logs_org_idx ON app_v3.organization_audit_logs (organizer_id);
CREATE INDEX IF NOT EXISTS organization_audit_logs_actor_idx ON app_v3.organization_audit_logs (actor_user_id);

CREATE TABLE IF NOT EXISTS app_v3.ticket_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id text NOT NULL,
  event_id integer NOT NULL,
  staff_user_id uuid,
  device_id text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT ticket_checkins_ticket_fkey FOREIGN KEY (ticket_id) REFERENCES app_v3.tickets(id) ON DELETE CASCADE,
  CONSTRAINT ticket_checkins_event_fkey FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ticket_checkins_ticket_idx ON app_v3.ticket_checkins (ticket_id);
CREATE INDEX IF NOT EXISTS ticket_checkins_event_idx ON app_v3.ticket_checkins (event_id);
CREATE INDEX IF NOT EXISTS ticket_checkins_staff_idx ON app_v3.ticket_checkins (staff_user_id);
