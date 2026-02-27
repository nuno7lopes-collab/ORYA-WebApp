CREATE TABLE IF NOT EXISTS app_v3.inventory_holds (
  id serial PRIMARY KEY,
  hold_id uuid NOT NULL UNIQUE,
  organization_id int NOT NULL REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  store_id int REFERENCES app_v3.stores(id) ON DELETE SET NULL,
  event_id int REFERENCES app_v3.events(id) ON DELETE SET NULL,
  product_id int REFERENCES app_v3.store_products(id) ON DELETE SET NULL,
  variant_id int REFERENCES app_v3.store_product_variants(id) ON DELETE SET NULL,
  ticket_type_id int REFERENCES app_v3.ticket_types(id) ON DELETE SET NULL,
  subject_type text NOT NULL,
  subject_fingerprint text NOT NULL,
  quantity int NOT NULL,
  max_stock int NOT NULL,
  client_session_hash text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  released_at timestamptz,
  consumed_at timestamptz,
  consumed_by_payment_intent text,
  dedupe_hash text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT inventory_holds_positive_qty CHECK (quantity > 0),
  CONSTRAINT inventory_holds_positive_stock CHECK (max_stock > 0)
);

CREATE INDEX IF NOT EXISTS inventory_holds_org_idx
  ON app_v3.inventory_holds (organization_id);

CREATE INDEX IF NOT EXISTS inventory_holds_subject_idx
  ON app_v3.inventory_holds (subject_fingerprint);

CREATE INDEX IF NOT EXISTS inventory_holds_status_expires_idx
  ON app_v3.inventory_holds (status, expires_at);

