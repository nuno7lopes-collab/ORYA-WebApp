DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'OrganizationCategory'
  ) THEN
    ALTER TYPE "app_v3"."OrganizationCategory" RENAME TO "OrganizationCategory_old";
  END IF;
END $$;

ALTER TABLE "app_v3"."organizers"
  DROP COLUMN IF EXISTS "multi_focus_primary",
  DROP COLUMN IF EXISTS "multi_focus_secondary";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'OrganizationFocus'
  ) THEN
    DROP TYPE "app_v3"."OrganizationFocus";
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'OrganizationCategory'
  ) THEN
    CREATE TYPE "app_v3"."OrganizationCategory" AS ENUM ('EVENTOS', 'PADEL', 'VOLUNTARIADO');
  END IF;
END $$;

ALTER TABLE "app_v3"."organizers"
  ADD COLUMN IF NOT EXISTS "organization_category" "app_v3"."OrganizationCategory";

ALTER TABLE "app_v3"."organizers"
  ALTER COLUMN "organization_category" TYPE "app_v3"."OrganizationCategory"
  USING (
    CASE
      WHEN "organization_category"::text = 'PADEL' THEN 'PADEL'
      WHEN "organization_category"::text = 'VOLUNTARIADO' THEN 'VOLUNTARIADO'
      ELSE 'EVENTOS'
    END
  )::"app_v3"."OrganizationCategory";

ALTER TABLE "app_v3"."organizers"
  ALTER COLUMN "organization_category" SET DEFAULT 'EVENTOS';

UPDATE "app_v3"."organizers"
SET "organization_category" = 'EVENTOS';

UPDATE "app_v3"."organizers" AS o
SET "organization_category" = 'PADEL'
WHERE EXISTS (
  SELECT 1 FROM "app_v3"."padel_clubs" pc WHERE pc."organizer_id" = o."id"
)
OR EXISTS (
  SELECT 1 FROM "app_v3"."padel_tournament_configs" ptc WHERE ptc."organizer_id" = o."id"
)
OR EXISTS (
  SELECT 1 FROM "app_v3"."padel_player_profiles" ppp WHERE ppp."organizer_id" = o."id"
);

UPDATE "app_v3"."organizers" AS o
SET "organization_category" = 'VOLUNTARIADO'
WHERE o."organization_category" <> 'PADEL'
  AND EXISTS (
    SELECT 1 FROM "app_v3"."events" e
    WHERE e."organizer_id" = o."id"
      AND e."template_type" = 'VOLUNTEERING'
  );

ALTER TABLE "app_v3"."organizers"
  ALTER COLUMN "organization_category" SET NOT NULL;

DROP TYPE IF EXISTS "app_v3"."OrganizationCategory_old";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'OrganizationModule'
  ) THEN
    CREATE TYPE "app_v3"."OrganizationModule" AS ENUM ('INSCRICOES');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "app_v3"."organization_modules" (
  "organizer_id" INTEGER NOT NULL,
  "module_key" "app_v3"."OrganizationModule" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "organization_modules_pkey" PRIMARY KEY ("organizer_id", "module_key"),
  CONSTRAINT "organization_modules_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "app_v3"."organizers"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

INSERT INTO "app_v3"."organization_modules" ("organizer_id", "module_key", "enabled")
SELECT "id", 'INSCRICOES', true
FROM "app_v3"."organizers"
ON CONFLICT ("organizer_id", "module_key") DO NOTHING;
