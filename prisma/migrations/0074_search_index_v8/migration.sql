DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname='app_v3' AND t.typname='SearchIndexVisibility'
  ) THEN
    CREATE TYPE app_v3."SearchIndexVisibility" AS ENUM ('PUBLIC','HIDDEN');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_v3.search_index_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id integer NOT NULL REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  source_type app_v3."SourceType" NOT NULL,
  source_id text NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  template_type app_v3."EventTemplateType",
  pricing_mode app_v3."EventPricingMode",
  is_gratis boolean NOT NULL DEFAULT false,
  price_from_cents integer,
  cover_image_url text,
  host_name text,
  host_username text,
  location_name text,
  location_city text,
  address text,
  location_formatted_address text,
  lat double precision,
  lng double precision,
  location_source app_v3."LocationSource",
  status app_v3."EventStatus" NOT NULL,
  visibility app_v3."SearchIndexVisibility" NOT NULL,
  last_event_id uuid NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS search_index_items_unique
  ON app_v3.search_index_items (organization_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS search_index_items_visibility_start_idx
  ON app_v3.search_index_items (visibility, starts_at, id);

CREATE INDEX IF NOT EXISTS search_index_items_city_start_idx
  ON app_v3.search_index_items (location_city, starts_at, id);

CREATE INDEX IF NOT EXISTS search_index_items_org_start_idx
  ON app_v3.search_index_items (organization_id, starts_at, id);
