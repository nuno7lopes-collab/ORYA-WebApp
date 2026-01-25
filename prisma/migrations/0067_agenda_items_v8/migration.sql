DO $$ BEGIN
  CREATE TYPE app_v3."AgendaSourceType" AS ENUM ('EVENT','TOURNAMENT','RESERVATION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS app_v3.agenda_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id integer NOT NULL,
  source_type app_v3."AgendaSourceType" NOT NULL,
  source_id text NOT NULL,
  title text NOT NULL,
  starts_at timestamptz(6) NOT NULL,
  ends_at timestamptz(6) NOT NULL,
  status text NOT NULL,
  last_event_id uuid NOT NULL,
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT agenda_items_org_fk FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS agenda_items_unique
  ON app_v3.agenda_items (organization_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS agenda_items_org_start_idx
  ON app_v3.agenda_items (organization_id, starts_at);
