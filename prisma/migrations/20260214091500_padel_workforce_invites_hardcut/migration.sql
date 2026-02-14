BEGIN;

-- Extend notification enum for explicit workforce invite channels.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'NotificationType'
  ) THEN
    ALTER TYPE app_v3."NotificationType" ADD VALUE IF NOT EXISTS 'CLUB_STAFF_INVITE';
    ALTER TYPE app_v3."NotificationType" ADD VALUE IF NOT EXISTS 'TEAM_MEMBER_INVITE';
  END IF;
END;
$$;

-- Hard-delete legacy club staff rows with no user identity.
DELETE FROM app_v3.padel_club_staff
WHERE user_id IS NULL;

-- Hard dedupe by (club,user), keeping the most recent row.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY padel_club_id, user_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM app_v3.padel_club_staff
)
DELETE FROM app_v3.padel_club_staff staff
USING ranked
WHERE ranked.id = staff.id
  AND ranked.rn > 1;

ALTER TABLE app_v3.padel_club_staff
  DROP COLUMN IF EXISTS email;

ALTER TABLE app_v3.padel_club_staff
  ALTER COLUMN user_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS padel_club_staff_active_club_user_uq
  ON app_v3.padel_club_staff (padel_club_id, user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS padel_club_staff_user_idx
  ON app_v3.padel_club_staff (user_id);

CREATE TABLE IF NOT EXISTS app_v3.padel_club_staff_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INT NOT NULL,
  padel_club_id INT NOT NULL,
  invited_by_user_id UUID NOT NULL,
  target_identifier CITEXT NOT NULL,
  target_user_id UUID,
  role app_v3."PadelClubStaffRole" NOT NULL,
  inherit_to_events BOOLEAN NOT NULL DEFAULT TRUE,
  token UUID NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ(6) NOT NULL,
  accepted_at TIMESTAMPTZ(6),
  declined_at TIMESTAMPTZ(6),
  cancelled_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT padel_club_staff_invites_org_fk
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT padel_club_staff_invites_club_fk
    FOREIGN KEY (padel_club_id) REFERENCES app_v3.padel_clubs(id) ON DELETE CASCADE,
  CONSTRAINT padel_club_staff_invites_inviter_fk
    FOREIGN KEY (invited_by_user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE,
  CONSTRAINT padel_club_staff_invites_target_fk
    FOREIGN KEY (target_user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS padel_club_staff_invites_org_idx
  ON app_v3.padel_club_staff_invites (organization_id);
CREATE INDEX IF NOT EXISTS padel_club_staff_invites_club_idx
  ON app_v3.padel_club_staff_invites (padel_club_id);
CREATE INDEX IF NOT EXISTS padel_club_staff_invites_identifier_idx
  ON app_v3.padel_club_staff_invites (target_identifier);
CREATE INDEX IF NOT EXISTS padel_club_staff_invites_target_idx
  ON app_v3.padel_club_staff_invites (target_user_id);
CREATE INDEX IF NOT EXISTS padel_club_staff_invites_expires_idx
  ON app_v3.padel_club_staff_invites (expires_at);

CREATE TABLE IF NOT EXISTS app_v3.padel_team_member_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INT NOT NULL,
  team_id INT NOT NULL,
  invited_by_user_id UUID NOT NULL,
  target_identifier CITEXT NOT NULL,
  target_user_id UUID,
  role app_v3."PadelTeamRole" NOT NULL DEFAULT 'PLAYER',
  token UUID NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ(6) NOT NULL,
  accepted_at TIMESTAMPTZ(6),
  declined_at TIMESTAMPTZ(6),
  cancelled_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT padel_team_member_invites_org_fk
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT padel_team_member_invites_team_fk
    FOREIGN KEY (team_id) REFERENCES app_v3.padel_teams(id) ON DELETE CASCADE,
  CONSTRAINT padel_team_member_invites_inviter_fk
    FOREIGN KEY (invited_by_user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE,
  CONSTRAINT padel_team_member_invites_target_fk
    FOREIGN KEY (target_user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS padel_team_member_invites_org_idx
  ON app_v3.padel_team_member_invites (organization_id);
CREATE INDEX IF NOT EXISTS padel_team_member_invites_team_idx
  ON app_v3.padel_team_member_invites (team_id);
CREATE INDEX IF NOT EXISTS padel_team_member_invites_identifier_idx
  ON app_v3.padel_team_member_invites (target_identifier);
CREATE INDEX IF NOT EXISTS padel_team_member_invites_target_idx
  ON app_v3.padel_team_member_invites (target_user_id);
CREATE INDEX IF NOT EXISTS padel_team_member_invites_expires_idx
  ON app_v3.padel_team_member_invites (expires_at);

COMMIT;
