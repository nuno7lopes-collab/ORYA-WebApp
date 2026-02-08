-- Add club/court references to agenda items for multi-club filtering
ALTER TABLE app_v3.agenda_items
  ADD COLUMN IF NOT EXISTS padel_club_id INTEGER,
  ADD COLUMN IF NOT EXISTS court_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agenda_items_padel_club_fk'
  ) THEN
    ALTER TABLE app_v3.agenda_items
      ADD CONSTRAINT agenda_items_padel_club_fk
      FOREIGN KEY (padel_club_id)
      REFERENCES app_v3.padel_clubs(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agenda_items_court_fk'
  ) THEN
    ALTER TABLE app_v3.agenda_items
      ADD CONSTRAINT agenda_items_court_fk
      FOREIGN KEY (court_id)
      REFERENCES app_v3.padel_club_courts(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS agenda_items_org_club_start_idx
  ON app_v3.agenda_items (organization_id, padel_club_id, starts_at);

CREATE INDEX IF NOT EXISTS agenda_items_org_court_start_idx
  ON app_v3.agenda_items (organization_id, court_id, starts_at);
