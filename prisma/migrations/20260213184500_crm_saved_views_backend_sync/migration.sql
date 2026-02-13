-- CRM saved views (backend-synced) for Clientes/Segmentos

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'CrmSavedViewScope'
  ) THEN
    CREATE TYPE app_v3."CrmSavedViewScope" AS ENUM ('CUSTOMERS', 'SEGMENTS');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_v3."crm_saved_views" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "env" TEXT NOT NULL DEFAULT 'prod',
  "organization_id" INTEGER NOT NULL,
  "user_id" UUID NOT NULL,
  "scope" app_v3."CrmSavedViewScope" NOT NULL,
  "name" CITEXT NOT NULL,
  "definition" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_saved_views_org_fk') THEN
    ALTER TABLE app_v3."crm_saved_views"
      ADD CONSTRAINT "crm_saved_views_org_fk"
      FOREIGN KEY ("organization_id") REFERENCES app_v3."organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_saved_views_user_fk') THEN
    ALTER TABLE app_v3."crm_saved_views"
      ADD CONSTRAINT "crm_saved_views_user_fk"
      FOREIGN KEY ("user_id") REFERENCES app_v3."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "crm_saved_views_org_user_scope_name_uq"
  ON app_v3."crm_saved_views"("organization_id", "user_id", "scope", "name");

CREATE INDEX IF NOT EXISTS "crm_saved_views_org_user_scope_updated_idx"
  ON app_v3."crm_saved_views"("organization_id", "user_id", "scope", "updated_at");
