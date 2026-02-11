-- Store big-bang contract finalization
-- ORG-only ownership, ACTIVE status, unified visibility, remove global shipping mode.

-- 1) Store status OPEN -> ACTIVE (enum value rename)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'StoreStatus'
  ) THEN
    BEGIN
      ALTER TYPE app_v3."StoreStatus" RENAME VALUE 'OPEN' TO 'ACTIVE';
    EXCEPTION
      WHEN duplicate_object THEN
        -- already renamed in a previous environment
        NULL;
      WHEN invalid_parameter_value THEN
        -- OPEN no longer exists
        NULL;
    END;
  END IF;
END
$$;

-- 2) Add visibility enum + columns (products/bundles)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'StoreVisibility'
  ) THEN
    CREATE TYPE app_v3."StoreVisibility" AS ENUM ('PUBLIC', 'HIDDEN', 'ARCHIVED');
  END IF;
END
$$;

ALTER TABLE app_v3.store_products
  ADD COLUMN IF NOT EXISTS visibility app_v3."StoreVisibility";

ALTER TABLE app_v3.store_bundles
  ADD COLUMN IF NOT EXISTS visibility app_v3."StoreVisibility";

UPDATE app_v3.store_products
SET visibility = CASE
  WHEN status::text = 'ARCHIVED' THEN 'ARCHIVED'::app_v3."StoreVisibility"
  WHEN status::text = 'ACTIVE' AND COALESCE(is_visible, FALSE) THEN 'PUBLIC'::app_v3."StoreVisibility"
  ELSE 'HIDDEN'::app_v3."StoreVisibility"
END
WHERE visibility IS NULL;

UPDATE app_v3.store_bundles
SET visibility = CASE
  WHEN status::text = 'ARCHIVED' THEN 'ARCHIVED'::app_v3."StoreVisibility"
  WHEN status::text = 'ACTIVE' AND COALESCE(is_visible, FALSE) THEN 'PUBLIC'::app_v3."StoreVisibility"
  ELSE 'HIDDEN'::app_v3."StoreVisibility"
END
WHERE visibility IS NULL;

ALTER TABLE app_v3.store_products
  ALTER COLUMN visibility SET NOT NULL,
  ALTER COLUMN visibility SET DEFAULT 'HIDDEN';

ALTER TABLE app_v3.store_bundles
  ALTER COLUMN visibility SET NOT NULL,
  ALTER COLUMN visibility SET DEFAULT 'HIDDEN';

DROP INDEX IF EXISTS app_v3.store_products_status_idx;
CREATE INDEX IF NOT EXISTS store_products_visibility_idx ON app_v3.store_products (visibility);

-- 3) Store ORG-only + remove global shipping mode
ALTER TABLE app_v3.stores
  DROP COLUMN IF EXISTS owner_type,
  DROP COLUMN IF EXISTS owner_user_id,
  DROP COLUMN IF EXISTS shipping_mode;

ALTER TABLE app_v3.stores
  ALTER COLUMN owner_organization_id SET NOT NULL;

DROP INDEX IF EXISTS app_v3.stores_owner_user_unique;
DROP INDEX IF EXISTS app_v3.stores_owner_type_idx;

-- 4) Remove legacy product/bundle columns
ALTER TABLE app_v3.store_products
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS is_visible;

ALTER TABLE app_v3.store_bundles
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS is_visible;

-- 5) Drop now-unused legacy enums
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'StoreOwnerType'
  ) THEN
    DROP TYPE app_v3."StoreOwnerType";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'StoreProductStatus'
  ) THEN
    DROP TYPE app_v3."StoreProductStatus";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'StoreBundleStatus'
  ) THEN
    DROP TYPE app_v3."StoreBundleStatus";
  END IF;
END
$$;
