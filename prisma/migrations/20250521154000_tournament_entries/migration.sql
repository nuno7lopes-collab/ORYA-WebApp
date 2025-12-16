-- Enum para torneios
DO $$
BEGIN
  CREATE TYPE app_v3."TournamentEntryRole" AS ENUM ('CAPTAIN','PARTNER');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

DO $$
BEGIN
  CREATE TYPE app_v3."TournamentEntryStatus" AS ENUM ('PENDING','CONFIRMED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- Tabela tournament_entries
CREATE TABLE IF NOT EXISTS app_v3.tournament_entries (
  id serial PRIMARY KEY,
  event_id integer NOT NULL,
  user_id uuid NOT NULL,
  pairing_id integer,
  role app_v3."TournamentEntryRole" NOT NULL DEFAULT 'PARTNER',
  status app_v3."TournamentEntryStatus" NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- FKs
ALTER TABLE app_v3.tournament_entries
  ADD CONSTRAINT tournament_entries_event_fk FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE;
ALTER TABLE app_v3.tournament_entries
  ADD CONSTRAINT tournament_entries_user_fk FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE;
ALTER TABLE app_v3.tournament_entries
  ADD CONSTRAINT tournament_entries_pairing_fk FOREIGN KEY (pairing_id) REFERENCES app_v3.padel_pairings(id) ON DELETE CASCADE;

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS tournament_entries_event_user_unique ON app_v3.tournament_entries(event_id, user_id);
CREATE INDEX IF NOT EXISTS tournament_entries_pairing_idx ON app_v3.tournament_entries(pairing_id);
