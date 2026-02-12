DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM app_v3.organization_group_members
    WHERE role::text = 'VIEWER'
  ) THEN
    RAISE EXCEPTION 'Cannot remove VIEWER from OrganizationMemberRole: rows still exist in organization_group_members';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM app_v3.organization_member_invites
    WHERE role::text = 'VIEWER'
  ) THEN
    RAISE EXCEPTION 'Cannot remove VIEWER from OrganizationMemberRole: rows still exist in organization_member_invites';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM app_v3.organization_member_overrides
    WHERE role_override::text = 'VIEWER'
  ) THEN
    RAISE EXCEPTION 'Cannot remove VIEWER from OrganizationMemberRole: rows still exist in organization_member_overrides';
  END IF;
END $$;

ALTER TYPE app_v3."OrganizationMemberRole" RENAME TO "OrganizationMemberRole_old";

CREATE TYPE app_v3."OrganizationMemberRole" AS ENUM (
  'OWNER',
  'CO_OWNER',
  'ADMIN',
  'STAFF',
  'TRAINER',
  'PROMOTER'
);

ALTER TABLE app_v3.organization_group_members
  ALTER COLUMN role TYPE app_v3."OrganizationMemberRole"
  USING role::text::app_v3."OrganizationMemberRole";

ALTER TABLE app_v3.organization_member_overrides
  ALTER COLUMN role_override TYPE app_v3."OrganizationMemberRole"
  USING CASE
    WHEN role_override IS NULL THEN NULL
    ELSE role_override::text::app_v3."OrganizationMemberRole"
  END;

ALTER TABLE app_v3.organization_member_invites
  ALTER COLUMN role TYPE app_v3."OrganizationMemberRole"
  USING role::text::app_v3."OrganizationMemberRole";

DROP TYPE app_v3."OrganizationMemberRole_old";
