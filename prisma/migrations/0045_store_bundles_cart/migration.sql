ALTER TABLE app_v3.store_cart_items
  ADD COLUMN bundle_id integer,
  ADD COLUMN bundle_key text;

ALTER TABLE app_v3.store_cart_items
  ADD CONSTRAINT store_cart_items_bundle_fk
  FOREIGN KEY (bundle_id) REFERENCES app_v3.store_bundles(id)
  ON DELETE SET NULL;

CREATE INDEX store_cart_items_bundle_idx
  ON app_v3.store_cart_items (bundle_id);

CREATE INDEX store_cart_items_bundle_key_idx
  ON app_v3.store_cart_items (bundle_key);

CREATE TABLE app_v3.store_order_bundles (
  id serial PRIMARY KEY,
  order_id integer NOT NULL,
  bundle_id integer,
  name_snapshot text NOT NULL,
  pricing_mode app_v3."StoreBundlePricingMode" NOT NULL,
  price_cents integer,
  percent_off integer,
  bundle_quantity integer NOT NULL DEFAULT 1,
  total_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_order_bundles_order_fk FOREIGN KEY (order_id) REFERENCES app_v3.store_orders(id) ON DELETE CASCADE,
  CONSTRAINT store_order_bundles_bundle_fk FOREIGN KEY (bundle_id) REFERENCES app_v3.store_bundles(id) ON DELETE SET NULL
);

CREATE INDEX store_order_bundles_order_idx
  ON app_v3.store_order_bundles (order_id);

CREATE INDEX store_order_bundles_bundle_idx
  ON app_v3.store_order_bundles (bundle_id);

CREATE TABLE app_v3.store_order_bundle_items (
  id serial PRIMARY KEY,
  order_bundle_id integer NOT NULL,
  product_id integer,
  variant_id integer,
  quantity integer NOT NULL,
  name_snapshot text NOT NULL,
  sku_snapshot text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_order_bundle_items_bundle_fk FOREIGN KEY (order_bundle_id) REFERENCES app_v3.store_order_bundles(id) ON DELETE CASCADE,
  CONSTRAINT store_order_bundle_items_product_fk FOREIGN KEY (product_id) REFERENCES app_v3.store_products(id) ON DELETE SET NULL,
  CONSTRAINT store_order_bundle_items_variant_fk FOREIGN KEY (variant_id) REFERENCES app_v3.store_product_variants(id) ON DELETE SET NULL
);

CREATE INDEX store_order_bundle_items_bundle_idx
  ON app_v3.store_order_bundle_items (order_bundle_id);

CREATE INDEX store_order_bundle_items_product_idx
  ON app_v3.store_order_bundle_items (product_id);

CREATE INDEX store_order_bundle_items_variant_idx
  ON app_v3.store_order_bundle_items (variant_id);

ALTER TABLE app_v3.store_order_lines
  ADD COLUMN order_bundle_id integer;

ALTER TABLE app_v3.store_order_lines
  ADD CONSTRAINT store_order_lines_order_bundle_fk
  FOREIGN KEY (order_bundle_id) REFERENCES app_v3.store_order_bundles(id)
  ON DELETE SET NULL;

CREATE INDEX store_order_lines_bundle_idx
  ON app_v3.store_order_lines (order_bundle_id);
