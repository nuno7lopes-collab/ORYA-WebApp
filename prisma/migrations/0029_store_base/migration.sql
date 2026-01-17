DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'OrganizationModule' AND n.nspname = 'app_v3' AND e.enumlabel = 'LOJA'
  ) THEN
    ALTER TYPE app_v3."OrganizationModule" ADD VALUE 'LOJA';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'StoreOwnerType' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."StoreOwnerType" AS ENUM ('ORG', 'PROFILE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'StoreStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."StoreStatus" AS ENUM ('DRAFT', 'CLOSED', 'OPEN');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'StoreShippingMode' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."StoreShippingMode" AS ENUM ('FLAT', 'VALUE_TIERS');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_v3.stores (
  id serial PRIMARY KEY,
  owner_type app_v3."StoreOwnerType" NOT NULL,
  owner_organization_id integer,
  owner_user_id uuid,
  status app_v3."StoreStatus" NOT NULL DEFAULT 'CLOSED',
  show_on_profile boolean NOT NULL DEFAULT false,
  catalog_locked boolean NOT NULL DEFAULT true,
  checkout_enabled boolean NOT NULL DEFAULT false,
  currency text NOT NULL DEFAULT 'EUR',
  support_email text,
  support_phone text,
  return_policy text,
  privacy_policy text,
  terms_url text,
  free_shipping_threshold_cents integer,
  shipping_mode app_v3."StoreShippingMode" NOT NULL DEFAULT 'FLAT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stores_owner_org_fk FOREIGN KEY (owner_organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT stores_owner_user_fk FOREIGN KEY (owner_user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS stores_owner_org_unique
  ON app_v3.stores (owner_organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS stores_owner_user_unique
  ON app_v3.stores (owner_user_id);

CREATE INDEX IF NOT EXISTS stores_owner_type_idx
  ON app_v3.stores (owner_type);
