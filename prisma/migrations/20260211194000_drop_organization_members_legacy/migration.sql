-- Legacy cleanup: organization membership SSOT moved to organization_group_members + overrides.
-- Safe because runtime no longer reads/writes app_v3.organization_members.
DROP TABLE IF EXISTS app_v3.organization_members CASCADE;
