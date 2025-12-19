-- Padel calendar: court blocks and player availabilities

CREATE TABLE IF NOT EXISTS "app_v3"."padel_court_blocks" (
    "id" SERIAL PRIMARY KEY,
    "organizer_id" INTEGER NOT NULL,
    "event_id" INTEGER NOT NULL,
    "padel_club_id" INTEGER,
    "court_id" INTEGER,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "label" TEXT,
    "kind" TEXT DEFAULT 'BLOCK',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ(6) DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "app_v3"."padel_availabilities" (
    "id" SERIAL PRIMARY KEY,
    "organizer_id" INTEGER NOT NULL,
    "event_id" INTEGER NOT NULL,
    "player_profile_id" INTEGER,
    "player_name" TEXT,
    "player_email" CITEXT,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ(6) DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "padel_court_blocks_org_idx" ON "app_v3"."padel_court_blocks" ("organizer_id");
CREATE INDEX IF NOT EXISTS "padel_court_blocks_event_idx" ON "app_v3"."padel_court_blocks" ("event_id");
CREATE INDEX IF NOT EXISTS "padel_court_blocks_club_idx" ON "app_v3"."padel_court_blocks" ("padel_club_id");
CREATE INDEX IF NOT EXISTS "padel_court_blocks_court_idx" ON "app_v3"."padel_court_blocks" ("court_id");

CREATE INDEX IF NOT EXISTS "padel_availabilities_org_idx" ON "app_v3"."padel_availabilities" ("organizer_id");
CREATE INDEX IF NOT EXISTS "padel_availabilities_event_idx" ON "app_v3"."padel_availabilities" ("event_id");
CREATE INDEX IF NOT EXISTS "padel_availabilities_profile_idx" ON "app_v3"."padel_availabilities" ("player_profile_id");

-- FKs
ALTER TABLE "app_v3"."padel_court_blocks"
  ADD CONSTRAINT "padel_court_blocks_organizer_fk" FOREIGN KEY ("organizer_id") REFERENCES "app_v3"."organizers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "app_v3"."padel_court_blocks"
  ADD CONSTRAINT "padel_court_blocks_event_fk" FOREIGN KEY ("event_id") REFERENCES "app_v3"."events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "app_v3"."padel_court_blocks"
  ADD CONSTRAINT "padel_court_blocks_club_fk" FOREIGN KEY ("padel_club_id") REFERENCES "app_v3"."padel_clubs"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "app_v3"."padel_court_blocks"
  ADD CONSTRAINT "padel_court_blocks_court_fk" FOREIGN KEY ("court_id") REFERENCES "app_v3"."padel_club_courts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "app_v3"."padel_availabilities"
  ADD CONSTRAINT "padel_availabilities_organizer_fk" FOREIGN KEY ("organizer_id") REFERENCES "app_v3"."organizers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "app_v3"."padel_availabilities"
  ADD CONSTRAINT "padel_availabilities_event_fk" FOREIGN KEY ("event_id") REFERENCES "app_v3"."events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "app_v3"."padel_availabilities"
  ADD CONSTRAINT "padel_availabilities_profile_fk" FOREIGN KEY ("player_profile_id") REFERENCES "app_v3"."padel_player_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Update updated_at triggers if needed (left to database triggers if present)

