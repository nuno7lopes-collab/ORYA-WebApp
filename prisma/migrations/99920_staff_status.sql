DO $$ BEGIN
  CREATE TYPE "app_v3"."StaffStatus" AS ENUM ('PENDING','ACCEPTED','REVOKED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "app_v3"."staff_assignments"
  ADD COLUMN IF NOT EXISTS "accepted_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "status" "app_v3"."StaffStatus" NOT NULL DEFAULT 'PENDING';
