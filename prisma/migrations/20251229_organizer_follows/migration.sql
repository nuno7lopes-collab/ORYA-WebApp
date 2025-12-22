CREATE TABLE IF NOT EXISTS "app_v3"."organizer_follows" (
  "id" SERIAL PRIMARY KEY,
  "follower_id" UUID NOT NULL,
  "organizer_id" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "organizer_follows_follower_fk" FOREIGN KEY ("follower_id") REFERENCES "app_v3"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "organizer_follows_organizer_fk" FOREIGN KEY ("organizer_id") REFERENCES "app_v3"."organizers"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS "organizer_follows_unique" ON "app_v3"."organizer_follows" ("follower_id", "organizer_id");
CREATE INDEX IF NOT EXISTS "idx_organizer_follows_follower" ON "app_v3"."organizer_follows" ("follower_id");
CREATE INDEX IF NOT EXISTS "idx_organizer_follows_organizer" ON "app_v3"."organizer_follows" ("organizer_id");
