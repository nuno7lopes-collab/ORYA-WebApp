DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'EventType_new'
  ) THEN
    CREATE TYPE "app_v3"."EventType_new" AS ENUM ('ORGANIZER_EVENT');
  END IF;
END$$;

ALTER TABLE "app_v3"."events"
  ALTER COLUMN "type" DROP DEFAULT;

ALTER TABLE "app_v3"."events"
  ALTER COLUMN "type" TYPE "app_v3"."EventType_new"
  USING ("type"::text::"app_v3"."EventType_new");

DROP TYPE "app_v3"."EventType";

ALTER TYPE "app_v3"."EventType_new" RENAME TO "EventType";

ALTER TABLE "app_v3"."events"
  ALTER COLUMN "type" SET DEFAULT 'ORGANIZER_EVENT';
