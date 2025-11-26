DO $$ BEGIN
  CREATE TYPE "app_v3"."ResaleMode" AS ENUM ('ALWAYS','AFTER_SOLD_OUT','DISABLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "app_v3"."events"
  ADD COLUMN IF NOT EXISTS "resale_mode" "app_v3"."ResaleMode" NOT NULL DEFAULT 'ALWAYS';
