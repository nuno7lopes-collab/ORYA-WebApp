-- Torna organizers.user_id opcional e define FK ON DELETE SET NULL
ALTER TABLE "app_v3"."organizers"
  ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE "app_v3"."organizers"
  DROP CONSTRAINT IF EXISTS "organizers_user_id_fkey";

ALTER TABLE "app_v3"."organizers"
  ADD CONSTRAINT "organizers_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "app_v3"."profiles" ("id")
  ON DELETE SET NULL;
