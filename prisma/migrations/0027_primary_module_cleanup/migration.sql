ALTER TABLE app_v3.organizations
  ADD COLUMN primary_module app_v3."OrganizationModule";

UPDATE app_v3.organizations
SET primary_module = CASE organization_category
  WHEN 'RESERVAS' THEN 'RESERVAS'::app_v3."OrganizationModule"
  WHEN 'PADEL' THEN 'TORNEIOS'::app_v3."OrganizationModule"
  ELSE 'EVENTOS'::app_v3."OrganizationModule"
END;

ALTER TABLE app_v3.organizations
  ALTER COLUMN primary_module SET NOT NULL,
  ALTER COLUMN primary_module SET DEFAULT 'EVENTOS'::app_v3."OrganizationModule";

ALTER TABLE app_v3.organizations
  DROP COLUMN organization_category;

DROP TYPE app_v3."OrganizationCategory";
