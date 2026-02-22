CREATE TABLE IF NOT EXISTS app_v3.service_duration_prices (
  id serial PRIMARY KEY,
  env text NOT NULL DEFAULT 'prod',
  service_id integer NOT NULL,
  duration_minutes integer NOT NULL,
  price_cents integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_v3.service_duration_prices
  ADD CONSTRAINT service_duration_prices_service_fk
  FOREIGN KEY (service_id)
  REFERENCES app_v3.services(id)
  ON DELETE CASCADE;

ALTER TABLE app_v3.service_duration_prices
  ADD CONSTRAINT service_duration_prices_service_duration_unique
  UNIQUE (service_id, duration_minutes);

ALTER TABLE app_v3.service_duration_prices
  ADD CONSTRAINT service_duration_prices_duration_catalog_check
  CHECK (duration_minutes IN (30, 60, 90, 120));

ALTER TABLE app_v3.service_duration_prices
  ADD CONSTRAINT service_duration_prices_price_nonnegative_check
  CHECK (price_cents >= 0);

CREATE INDEX IF NOT EXISTS service_duration_prices_service_idx
  ON app_v3.service_duration_prices(service_id);

CREATE INDEX IF NOT EXISTS service_duration_prices_service_active_idx
  ON app_v3.service_duration_prices(service_id, is_active);
