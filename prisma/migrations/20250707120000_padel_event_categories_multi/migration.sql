-- Padel event categories (multi-categoria)
CREATE TABLE IF NOT EXISTS app_v3.padel_event_category_links (
  id serial PRIMARY KEY,
  event_id integer NOT NULL,
  padel_category_id integer NOT NULL,
  format app_v3.padel_format,
  capacity_teams integer,
  capacity_players integer,
  live_stream_url text,
  is_enabled boolean NOT NULL DEFAULT true,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_v3.padel_event_category_links
  ADD CONSTRAINT padel_event_category_links_event_fk FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE;
ALTER TABLE app_v3.padel_event_category_links
  ADD CONSTRAINT padel_event_category_links_category_fk FOREIGN KEY (padel_category_id) REFERENCES app_v3.padel_categories(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS padel_event_category_links_unique
  ON app_v3.padel_event_category_links(event_id, padel_category_id);
CREATE INDEX IF NOT EXISTS padel_event_category_links_event_idx
  ON app_v3.padel_event_category_links(event_id);
CREATE INDEX IF NOT EXISTS padel_event_category_links_category_idx
  ON app_v3.padel_event_category_links(padel_category_id);

INSERT INTO app_v3.padel_event_category_links (event_id, padel_category_id, is_enabled, is_hidden)
SELECT ptc.event_id, ptc.default_category_id, true, false
FROM app_v3.padel_tournament_configs ptc
WHERE ptc.default_category_id IS NOT NULL
ON CONFLICT (event_id, padel_category_id) DO NOTHING;

-- TicketType -> categoria do evento (Padel)
ALTER TABLE app_v3.ticket_types
  ADD COLUMN IF NOT EXISTS padel_event_category_link_id integer;

ALTER TABLE app_v3.ticket_types
  ADD CONSTRAINT ticket_types_padel_category_link_fk
  FOREIGN KEY (padel_event_category_link_id) REFERENCES app_v3.padel_event_category_links(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ticket_types_padel_category_link_idx
  ON app_v3.ticket_types(padel_event_category_link_id);

UPDATE app_v3.ticket_types tt
SET padel_event_category_link_id = link.id
FROM app_v3.padel_event_category_links link
WHERE tt.event_id = link.event_id
  AND tt.padel_event_category_link_id IS NULL
  AND link.padel_category_id IN (
    SELECT ptc.default_category_id
    FROM app_v3.padel_tournament_configs ptc
    WHERE ptc.event_id = link.event_id
  );

-- TournamentEntry categoria (Padel)
ALTER TABLE app_v3.tournament_entries
  ADD COLUMN IF NOT EXISTS category_id integer;

ALTER TABLE app_v3.tournament_entries
  ADD CONSTRAINT tournament_entries_category_fk
  FOREIGN KEY (category_id) REFERENCES app_v3.padel_categories(id) ON DELETE SET NULL;

UPDATE app_v3.tournament_entries te
SET category_id = pp.category_id
FROM app_v3.padel_pairings pp
WHERE te.pairing_id = pp.id AND te.category_id IS NULL;

UPDATE app_v3.tournament_entries te
SET category_id = ptc.default_category_id
FROM app_v3.padel_tournament_configs ptc
WHERE te.event_id = ptc.event_id AND te.category_id IS NULL AND ptc.default_category_id IS NOT NULL;

DROP INDEX IF EXISTS app_v3.tournament_entries_event_user_unique;
CREATE UNIQUE INDEX IF NOT EXISTS tournament_entries_event_category_user_unique
  ON app_v3.tournament_entries(event_id, category_id, user_id);
CREATE INDEX IF NOT EXISTS tournament_entries_category_idx
  ON app_v3.tournament_entries(category_id);
