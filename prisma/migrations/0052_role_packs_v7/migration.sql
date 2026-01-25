DO $$
BEGIN
  CREATE TYPE app_v3."OrganizationRolePack" AS ENUM (
    'CLUB_MANAGER',
    'TOURNAMENT_DIRECTOR',
    'FRONT_DESK',
    'COACH',
    'REFEREE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE IF EXISTS app_v3.organization_members
  ADD COLUMN IF NOT EXISTS role_pack app_v3."OrganizationRolePack";

ALTER TABLE IF EXISTS app_v3.organization_member_invites
  ADD COLUMN IF NOT EXISTS role_pack app_v3."OrganizationRolePack";
