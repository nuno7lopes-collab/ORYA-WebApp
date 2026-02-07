-- Drop legacy address columns and unused sale summary link

ALTER TABLE app_v3.events
  DROP COLUMN IF EXISTS address;

ALTER TABLE app_v3.padel_clubs
  DROP COLUMN IF EXISTS address;

ALTER TABLE app_v3.search_index_items
  DROP COLUMN IF EXISTS address;

ALTER TABLE app_v3.tournament_entries
  DROP COLUMN IF EXISTS sale_summary_id;
