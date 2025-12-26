DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'EventPublicAccessMode'
  ) THEN
    CREATE TYPE "app_v3"."EventPublicAccessMode" AS ENUM ('OPEN', 'TICKET', 'INVITE');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'EventParticipantAccessMode'
  ) THEN
    CREATE TYPE "app_v3"."EventParticipantAccessMode" AS ENUM ('NONE', 'TICKET', 'INSCRIPTION', 'INVITE');
  END IF;
END$$;

ALTER TABLE "app_v3"."events"
  ADD COLUMN IF NOT EXISTS "public_access_mode" "app_v3"."EventPublicAccessMode" NOT NULL DEFAULT 'OPEN';

ALTER TABLE "app_v3"."events"
  ADD COLUMN IF NOT EXISTS "participant_access_mode" "app_v3"."EventParticipantAccessMode" NOT NULL DEFAULT 'NONE';

ALTER TABLE "app_v3"."events"
  ADD COLUMN IF NOT EXISTS "public_ticket_type_ids" integer[] NOT NULL DEFAULT '{}';

ALTER TABLE "app_v3"."events"
  ADD COLUMN IF NOT EXISTS "participant_ticket_type_ids" integer[] NOT NULL DEFAULT '{}';

UPDATE "app_v3"."events"
  SET "public_access_mode" = CASE
    WHEN "invite_only" IS TRUE THEN 'INVITE'::"app_v3"."EventPublicAccessMode"
    ELSE 'OPEN'::"app_v3"."EventPublicAccessMode"
  END
  WHERE "public_access_mode" IS NULL;

UPDATE "app_v3"."events"
  SET "participant_access_mode" = 'NONE'::"app_v3"."EventParticipantAccessMode"
  WHERE "participant_access_mode" IS NULL;
