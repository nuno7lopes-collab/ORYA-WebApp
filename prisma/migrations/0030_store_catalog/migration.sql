DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'StoreProductStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."StoreProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'StoreStockPolicy' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."StoreStockPolicy" AS ENUM ('NONE', 'TRACKED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'StoreProductOptionType' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."StoreProductOptionType" AS ENUM ('TEXT', 'SELECT', 'NUMBER', 'CHECKBOX');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'StoreBundlePricingMode' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."StoreBundlePricingMode" AS ENUM ('FIXED', 'PERCENT_DISCOUNT');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'StoreBundleStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."StoreBundleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'StoreCartStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."StoreCartStatus" AS ENUM ('ACTIVE', 'CHECKOUT_LOCKED', 'ABANDONED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'StoreOrderStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."StoreOrderStatus" AS ENUM ('PENDING', 'PAID', 'FULFILLED', 'CANCELLED', 'REFUNDED', 'PARTIAL_REFUND');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'StoreAddressType' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."StoreAddressType" AS ENUM ('SHIPPING', 'BILLING');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'StoreShipmentStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."StoreShipmentStatus" AS ENUM ('PENDING', 'SHIPPED', 'DELIVERED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'StoreInventoryMovementType' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."StoreInventoryMovementType" AS ENUM ('ADJUST', 'SALE', 'REFUND', 'RETURN');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_v3.store_categories (
  id serial PRIMARY KEY,
  store_id integer NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  cover_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_categories_store_fk FOREIGN KEY (store_id) REFERENCES app_v3.stores(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS store_categories_store_slug_unique
  ON app_v3.store_categories (store_id, slug);
CREATE INDEX IF NOT EXISTS store_categories_store_idx
  ON app_v3.store_categories (store_id);

CREATE TABLE IF NOT EXISTS app_v3.store_products (
  id serial PRIMARY KEY,
  store_id integer NOT NULL,
  category_id integer,
  name text NOT NULL,
  slug text NOT NULL,
  short_description text,
  description text,
  status app_v3."StoreProductStatus" NOT NULL DEFAULT 'DRAFT',
  is_visible boolean NOT NULL DEFAULT false,
  price_cents integer NOT NULL,
  compare_at_price_cents integer,
  currency text NOT NULL DEFAULT 'EUR',
  sku text,
  stock_policy app_v3."StoreStockPolicy" NOT NULL DEFAULT 'NONE',
  stock_qty integer,
  requires_shipping boolean NOT NULL DEFAULT true,
  weight_grams integer,
  length_mm integer,
  width_mm integer,
  height_mm integer,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_products_store_fk FOREIGN KEY (store_id) REFERENCES app_v3.stores(id) ON DELETE CASCADE,
  CONSTRAINT store_products_category_fk FOREIGN KEY (category_id) REFERENCES app_v3.store_categories(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS store_products_store_slug_unique
  ON app_v3.store_products (store_id, slug);
CREATE INDEX IF NOT EXISTS store_products_store_idx
  ON app_v3.store_products (store_id);
CREATE INDEX IF NOT EXISTS store_products_category_idx
  ON app_v3.store_products (category_id);
CREATE INDEX IF NOT EXISTS store_products_status_idx
  ON app_v3.store_products (status);

CREATE TABLE IF NOT EXISTS app_v3.store_product_variants (
  id serial PRIMARY KEY,
  product_id integer NOT NULL,
  label text NOT NULL,
  sku text,
  price_cents integer,
  stock_qty integer,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_product_variants_product_fk FOREIGN KEY (product_id) REFERENCES app_v3.store_products(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS store_product_variants_product_label_unique
  ON app_v3.store_product_variants (product_id, label);
CREATE INDEX IF NOT EXISTS store_product_variants_product_idx
  ON app_v3.store_product_variants (product_id);

CREATE TABLE IF NOT EXISTS app_v3.store_product_images (
  id serial PRIMARY KEY,
  product_id integer NOT NULL,
  url text NOT NULL,
  alt_text text,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_product_images_product_fk FOREIGN KEY (product_id) REFERENCES app_v3.store_products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS store_product_images_product_idx
  ON app_v3.store_product_images (product_id);

CREATE TABLE IF NOT EXISTS app_v3.store_product_options (
  id serial PRIMARY KEY,
  product_id integer NOT NULL,
  option_type app_v3."StoreProductOptionType" NOT NULL,
  label text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  max_length integer,
  min_value integer,
  max_value integer,
  price_delta_cents integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_product_options_product_fk FOREIGN KEY (product_id) REFERENCES app_v3.store_products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS store_product_options_product_idx
  ON app_v3.store_product_options (product_id);

CREATE TABLE IF NOT EXISTS app_v3.store_product_option_values (
  id serial PRIMARY KEY,
  option_id integer NOT NULL,
  value text NOT NULL,
  label text,
  price_delta_cents integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_product_option_values_option_fk FOREIGN KEY (option_id) REFERENCES app_v3.store_product_options(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS store_product_option_values_option_value_unique
  ON app_v3.store_product_option_values (option_id, value);
CREATE INDEX IF NOT EXISTS store_product_option_values_option_idx
  ON app_v3.store_product_option_values (option_id);

CREATE TABLE IF NOT EXISTS app_v3.store_digital_assets (
  id serial PRIMARY KEY,
  product_id integer NOT NULL,
  storage_path text NOT NULL,
  filename text NOT NULL,
  size_bytes integer NOT NULL,
  mime_type text NOT NULL,
  max_downloads integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_digital_assets_product_fk FOREIGN KEY (product_id) REFERENCES app_v3.store_products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS store_digital_assets_product_idx
  ON app_v3.store_digital_assets (product_id);

CREATE TABLE IF NOT EXISTS app_v3.store_orders (
  id serial PRIMARY KEY,
  store_id integer NOT NULL,
  user_id uuid,
  order_number text,
  status app_v3."StoreOrderStatus" NOT NULL DEFAULT 'PENDING',
  payment_intent_id text,
  purchase_id text,
  subtotal_cents integer NOT NULL,
  discount_cents integer NOT NULL DEFAULT 0,
  shipping_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  customer_email citext,
  customer_name text,
  customer_phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_orders_store_fk FOREIGN KEY (store_id) REFERENCES app_v3.stores(id) ON DELETE CASCADE,
  CONSTRAINT store_orders_user_fk FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS store_orders_order_number_unique
  ON app_v3.store_orders (order_number);
CREATE INDEX IF NOT EXISTS store_orders_store_idx
  ON app_v3.store_orders (store_id);
CREATE INDEX IF NOT EXISTS store_orders_user_idx
  ON app_v3.store_orders (user_id);
CREATE INDEX IF NOT EXISTS store_orders_status_idx
  ON app_v3.store_orders (status);
CREATE INDEX IF NOT EXISTS store_orders_payment_intent_idx
  ON app_v3.store_orders (payment_intent_id);
CREATE INDEX IF NOT EXISTS store_orders_purchase_idx
  ON app_v3.store_orders (purchase_id);

CREATE TABLE IF NOT EXISTS app_v3.store_order_lines (
  id serial PRIMARY KEY,
  order_id integer NOT NULL,
  product_id integer,
  variant_id integer,
  name_snapshot text NOT NULL,
  sku_snapshot text,
  quantity integer NOT NULL,
  unit_price_cents integer NOT NULL,
  discount_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL,
  requires_shipping boolean NOT NULL DEFAULT true,
  personalization jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_order_lines_order_fk FOREIGN KEY (order_id) REFERENCES app_v3.store_orders(id) ON DELETE CASCADE,
  CONSTRAINT store_order_lines_product_fk FOREIGN KEY (product_id) REFERENCES app_v3.store_products(id) ON DELETE SET NULL,
  CONSTRAINT store_order_lines_variant_fk FOREIGN KEY (variant_id) REFERENCES app_v3.store_product_variants(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS store_order_lines_order_idx
  ON app_v3.store_order_lines (order_id);
CREATE INDEX IF NOT EXISTS store_order_lines_product_idx
  ON app_v3.store_order_lines (product_id);
CREATE INDEX IF NOT EXISTS store_order_lines_variant_idx
  ON app_v3.store_order_lines (variant_id);

CREATE TABLE IF NOT EXISTS app_v3.store_digital_grants (
  id serial PRIMARY KEY,
  order_line_id integer NOT NULL,
  user_id uuid,
  download_token text NOT NULL,
  expires_at timestamptz,
  downloads_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_digital_grants_line_fk FOREIGN KEY (order_line_id) REFERENCES app_v3.store_order_lines(id) ON DELETE CASCADE,
  CONSTRAINT store_digital_grants_user_fk FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS store_digital_grants_token_unique
  ON app_v3.store_digital_grants (download_token);
CREATE INDEX IF NOT EXISTS store_digital_grants_line_idx
  ON app_v3.store_digital_grants (order_line_id);
CREATE INDEX IF NOT EXISTS store_digital_grants_user_idx
  ON app_v3.store_digital_grants (user_id);

CREATE TABLE IF NOT EXISTS app_v3.store_order_addresses (
  id serial PRIMARY KEY,
  order_id integer NOT NULL,
  address_type app_v3."StoreAddressType" NOT NULL,
  full_name text NOT NULL,
  line1 text NOT NULL,
  line2 text,
  city text NOT NULL,
  region text,
  postal_code text NOT NULL,
  country text NOT NULL,
  nif text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_order_addresses_order_fk FOREIGN KEY (order_id) REFERENCES app_v3.store_orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS store_order_addresses_order_idx
  ON app_v3.store_order_addresses (order_id);

CREATE TABLE IF NOT EXISTS app_v3.store_shipments (
  id serial PRIMARY KEY,
  order_id integer NOT NULL,
  carrier text,
  tracking_number text,
  tracking_url text,
  status app_v3."StoreShipmentStatus" NOT NULL DEFAULT 'PENDING',
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_shipments_order_fk FOREIGN KEY (order_id) REFERENCES app_v3.store_orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS store_shipments_order_idx
  ON app_v3.store_shipments (order_id);

CREATE TABLE IF NOT EXISTS app_v3.store_shipping_zones (
  id serial PRIMARY KEY,
  store_id integer NOT NULL,
  name text NOT NULL,
  countries text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_shipping_zones_store_fk FOREIGN KEY (store_id) REFERENCES app_v3.stores(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS store_shipping_zones_store_idx
  ON app_v3.store_shipping_zones (store_id);

CREATE TABLE IF NOT EXISTS app_v3.store_shipping_methods (
  id serial PRIMARY KEY,
  zone_id integer NOT NULL,
  name text NOT NULL,
  description text,
  base_rate_cents integer NOT NULL,
  mode app_v3."StoreShippingMode" NOT NULL DEFAULT 'FLAT',
  free_over_cents integer,
  is_default boolean NOT NULL DEFAULT false,
  eta_min_days integer,
  eta_max_days integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_shipping_methods_zone_fk FOREIGN KEY (zone_id) REFERENCES app_v3.store_shipping_zones(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS store_shipping_methods_zone_idx
  ON app_v3.store_shipping_methods (zone_id);

CREATE TABLE IF NOT EXISTS app_v3.store_shipping_tiers (
  id serial PRIMARY KEY,
  method_id integer NOT NULL,
  min_subtotal_cents integer NOT NULL,
  max_subtotal_cents integer,
  rate_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_shipping_tiers_method_fk FOREIGN KEY (method_id) REFERENCES app_v3.store_shipping_methods(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS store_shipping_tiers_method_idx
  ON app_v3.store_shipping_tiers (method_id);

CREATE TABLE IF NOT EXISTS app_v3.store_bundles (
  id serial PRIMARY KEY,
  store_id integer NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  pricing_mode app_v3."StoreBundlePricingMode" NOT NULL,
  price_cents integer,
  percent_off integer,
  status app_v3."StoreBundleStatus" NOT NULL DEFAULT 'DRAFT',
  is_visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_bundles_store_fk FOREIGN KEY (store_id) REFERENCES app_v3.stores(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS store_bundles_store_slug_unique
  ON app_v3.store_bundles (store_id, slug);
CREATE INDEX IF NOT EXISTS store_bundles_store_idx
  ON app_v3.store_bundles (store_id);

CREATE TABLE IF NOT EXISTS app_v3.store_bundle_items (
  id serial PRIMARY KEY,
  bundle_id integer NOT NULL,
  product_id integer NOT NULL,
  variant_id integer,
  quantity integer NOT NULL DEFAULT 1,
  CONSTRAINT store_bundle_items_bundle_fk FOREIGN KEY (bundle_id) REFERENCES app_v3.store_bundles(id) ON DELETE CASCADE,
  CONSTRAINT store_bundle_items_product_fk FOREIGN KEY (product_id) REFERENCES app_v3.store_products(id) ON DELETE CASCADE,
  CONSTRAINT store_bundle_items_variant_fk FOREIGN KEY (variant_id) REFERENCES app_v3.store_product_variants(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS store_bundle_items_bundle_idx
  ON app_v3.store_bundle_items (bundle_id);
CREATE INDEX IF NOT EXISTS store_bundle_items_product_idx
  ON app_v3.store_bundle_items (product_id);
CREATE INDEX IF NOT EXISTS store_bundle_items_variant_idx
  ON app_v3.store_bundle_items (variant_id);

CREATE TABLE IF NOT EXISTS app_v3.store_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id integer NOT NULL,
  user_id uuid,
  session_id text,
  status app_v3."StoreCartStatus" NOT NULL DEFAULT 'ACTIVE',
  currency text NOT NULL DEFAULT 'EUR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_carts_store_fk FOREIGN KEY (store_id) REFERENCES app_v3.stores(id) ON DELETE CASCADE,
  CONSTRAINT store_carts_user_fk FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS store_carts_store_idx
  ON app_v3.store_carts (store_id);
CREATE INDEX IF NOT EXISTS store_carts_user_idx
  ON app_v3.store_carts (user_id);
CREATE INDEX IF NOT EXISTS store_carts_session_idx
  ON app_v3.store_carts (session_id);

CREATE TABLE IF NOT EXISTS app_v3.store_cart_items (
  id serial PRIMARY KEY,
  cart_id uuid NOT NULL,
  product_id integer NOT NULL,
  variant_id integer,
  quantity integer NOT NULL,
  unit_price_cents integer NOT NULL,
  personalization jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_cart_items_cart_fk FOREIGN KEY (cart_id) REFERENCES app_v3.store_carts(id) ON DELETE CASCADE,
  CONSTRAINT store_cart_items_product_fk FOREIGN KEY (product_id) REFERENCES app_v3.store_products(id) ON DELETE CASCADE,
  CONSTRAINT store_cart_items_variant_fk FOREIGN KEY (variant_id) REFERENCES app_v3.store_product_variants(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS store_cart_items_cart_idx
  ON app_v3.store_cart_items (cart_id);
CREATE INDEX IF NOT EXISTS store_cart_items_product_idx
  ON app_v3.store_cart_items (product_id);
CREATE INDEX IF NOT EXISTS store_cart_items_variant_idx
  ON app_v3.store_cart_items (variant_id);

CREATE TABLE IF NOT EXISTS app_v3.store_inventory_movements (
  id serial PRIMARY KEY,
  product_id integer NOT NULL,
  variant_id integer,
  movement_type app_v3."StoreInventoryMovementType" NOT NULL,
  quantity integer NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_inventory_movements_product_fk FOREIGN KEY (product_id) REFERENCES app_v3.store_products(id) ON DELETE CASCADE,
  CONSTRAINT store_inventory_movements_variant_fk FOREIGN KEY (variant_id) REFERENCES app_v3.store_product_variants(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS store_inventory_movements_product_idx
  ON app_v3.store_inventory_movements (product_id);
CREATE INDEX IF NOT EXISTS store_inventory_movements_variant_idx
  ON app_v3.store_inventory_movements (variant_id);
