-- Padel ranking filters and tier context metadata

BEGIN;

ALTER TABLE app_v3.padel_rating_events
  ADD COLUMN IF NOT EXISTS tier TEXT,
  ADD COLUMN IF NOT EXISTS club_id INT,
  ADD COLUMN IF NOT EXISTS city TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.conname = 'padel_rating_events_club_fk'
      AND n.nspname = 'app_v3'
  ) THEN
    ALTER TABLE app_v3.padel_rating_events
      ADD CONSTRAINT padel_rating_events_club_fk
      FOREIGN KEY (club_id) REFERENCES app_v3.padel_clubs(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS padel_rating_events_org_tier_idx
  ON app_v3.padel_rating_events (organization_id, tier);
CREATE INDEX IF NOT EXISTS padel_rating_events_org_club_idx
  ON app_v3.padel_rating_events (organization_id, club_id);
CREATE INDEX IF NOT EXISTS padel_rating_events_org_city_idx
  ON app_v3.padel_rating_events (organization_id, city);

UPDATE app_v3.padel_rating_events AS rating_event
SET tier = UPPER(
      NULLIF(
        TRIM(
          COALESCE(
            cfg.advanced_settings->>'tournamentTier',
            rating_event.tier,
            ''
          )
        ),
        ''
      )
    ),
    club_id = COALESCE(cfg.padel_club_id, rating_event.club_id),
    city = LOWER(
      NULLIF(
        TRIM(
          COALESCE(
            addr.canonical->>'city',
            addr.canonical->>'locality',
            addr.canonical->>'addressLine2',
            addr.canonical->>'region',
            addr.canonical->>'state',
            rating_event.city,
            ''
          )
        ),
        ''
      )
    )
FROM app_v3.events AS ev
LEFT JOIN app_v3.padel_tournament_configs AS cfg ON cfg.event_id = ev.id
LEFT JOIN app_v3.addresses AS addr ON addr.id = ev.address_id
WHERE rating_event.event_id = ev.id;

COMMIT;
