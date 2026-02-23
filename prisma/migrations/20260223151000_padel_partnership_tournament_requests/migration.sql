DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PadelPartnershipTournamentRequestStatus'
      AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."PadelPartnershipTournamentRequestStatus"
      AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_v3.padel_partnership_tournament_requests (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  agreement_id INTEGER NOT NULL,
  owner_organization_id INTEGER NOT NULL,
  partner_organization_id INTEGER NOT NULL,
  owner_club_id INTEGER NOT NULL,
  partner_club_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ(6) NOT NULL,
  ends_at TIMESTAMPTZ(6) NOT NULL,
  requested_payload JSONB DEFAULT '{}'::jsonb,
  requested_by_user_id UUID,
  reviewed_by_user_id UUID,
  reviewed_at TIMESTAMPTZ(6),
  status app_v3."PadelPartnershipTournamentRequestStatus" NOT NULL DEFAULT 'PENDING',
  event_id INTEGER,
  expires_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS padel_partnership_tournament_requests_agreement_idx
  ON app_v3.padel_partnership_tournament_requests(agreement_id);
CREATE INDEX IF NOT EXISTS padel_partnership_tournament_requests_owner_org_idx
  ON app_v3.padel_partnership_tournament_requests(owner_organization_id);
CREATE INDEX IF NOT EXISTS padel_partnership_tournament_requests_partner_org_idx
  ON app_v3.padel_partnership_tournament_requests(partner_organization_id);
CREATE INDEX IF NOT EXISTS padel_partnership_tournament_requests_owner_club_idx
  ON app_v3.padel_partnership_tournament_requests(owner_club_id);
CREATE INDEX IF NOT EXISTS padel_partnership_tournament_requests_partner_club_idx
  ON app_v3.padel_partnership_tournament_requests(partner_club_id);
CREATE INDEX IF NOT EXISTS padel_partnership_tournament_requests_status_idx
  ON app_v3.padel_partnership_tournament_requests(status);
CREATE INDEX IF NOT EXISTS padel_partnership_tournament_requests_event_idx
  ON app_v3.padel_partnership_tournament_requests(event_id);
