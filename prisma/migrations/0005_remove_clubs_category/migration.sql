-- Remove CLUBS category from organization enums and normalize data.
UPDATE app_v3.organizations
SET organization_category = 'EVENTOS'
WHERE organization_category = 'CLUBS';

ALTER TABLE app_v3.organizations
  ALTER COLUMN organization_category DROP DEFAULT;

ALTER TYPE app_v3."OrganizationCategory" RENAME TO "OrganizationCategory_old";

CREATE TYPE app_v3."OrganizationCategory" AS ENUM ('EVENTOS', 'PADEL', 'RESERVAS');

ALTER TABLE app_v3.organizations
  ALTER COLUMN organization_category TYPE app_v3."OrganizationCategory"
  USING organization_category::text::app_v3."OrganizationCategory";

ALTER TABLE app_v3.organizations
  ALTER COLUMN organization_category SET DEFAULT 'EVENTOS';

DROP TYPE app_v3."OrganizationCategory_old";
