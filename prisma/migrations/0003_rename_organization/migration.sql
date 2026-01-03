-- Rename enum types (Organizer -> Organization)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'OrganizerMemberRole'
  ) THEN
    EXECUTE 'ALTER TYPE app_v3."OrganizerMemberRole" RENAME TO "OrganizationMemberRole"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'OrganizerOwnerTransferStatus'
  ) THEN
    EXECUTE 'ALTER TYPE app_v3."OrganizerOwnerTransferStatus" RENAME TO "OrganizationOwnerTransferStatus"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'OrganizerStatus'
  ) THEN
    EXECUTE 'ALTER TYPE app_v3."OrganizerStatus" RENAME TO "OrganizationStatus"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'OrganizerEmailRequestStatus'
  ) THEN
    EXECUTE 'ALTER TYPE app_v3."OrganizerEmailRequestStatus" RENAME TO "OrganizationEmailRequestStatus"';
  END IF;
END $$;

-- Rename enum values
DO $$
BEGIN
  BEGIN
    ALTER TYPE app_v3."EventType" RENAME VALUE 'ORGANIZER_EVENT' TO 'ORGANIZATION_EVENT';
  EXCEPTION WHEN others THEN
    -- ignore if already renamed
  END;

  BEGIN
    ALTER TYPE app_v3."NotificationType" RENAME VALUE 'ORGANIZER_INVITE' TO 'ORGANIZATION_INVITE';
  EXCEPTION WHEN others THEN
  END;

  BEGIN
    ALTER TYPE app_v3."NotificationType" RENAME VALUE 'ORGANIZER_TRANSFER' TO 'ORGANIZATION_TRANSFER';
  EXCEPTION WHEN others THEN
  END;

  BEGIN
    ALTER TYPE app_v3."NotificationType" RENAME VALUE 'NEW_EVENT_FROM_FOLLOWED_ORGANIZER' TO 'NEW_EVENT_FROM_FOLLOWED_ORGANIZATION';
  EXCEPTION WHEN others THEN
  END;

  BEGIN
    ALTER TYPE app_v3."PayoutMode" RENAME VALUE 'ORGANIZER' TO 'ORGANIZATION';
  EXCEPTION WHEN others THEN
  END;
END $$;

-- Rename tables (organizer_* -> organization_*)
DO $$
DECLARE r record;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'app_v3' AND c.relkind = 'r' AND c.relname = 'organizers'
  ) THEN
    EXECUTE 'ALTER TABLE app_v3.organizers RENAME TO organizations';
  END IF;

  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'app_v3' AND tablename ~ '^organizer_'
  LOOP
    EXECUTE format('ALTER TABLE app_v3.%I RENAME TO %I', r.tablename, replace(r.tablename, 'organizer_', 'organization_'));
  END LOOP;
END $$;

-- Rename sequences with organizer prefix
DO $$
DECLARE r record;
DECLARE new_name text;
BEGIN
  FOR r IN
    SELECT c.relname AS seq_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'app_v3' AND c.relkind = 'S' AND c.relname LIKE 'organizer%'
  LOOP
    new_name := replace(r.seq_name, 'organizer', 'organization');
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c2
      JOIN pg_namespace n2 ON n2.oid = c2.relnamespace
      WHERE n2.nspname = 'app_v3' AND c2.relname = new_name
    ) THEN
      EXECUTE format('ALTER SEQUENCE app_v3.%I RENAME TO %I', r.seq_name, new_name);
    END IF;
  END LOOP;
END $$;

-- Rename organizer_id columns to organization_id
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'app_v3' AND column_name = 'organizer_id'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I RENAME COLUMN organizer_id TO organization_id', r.table_schema, r.table_name);
  END LOOP;
END $$;

-- Rename indexes containing organizer
DO $$
DECLARE r record;
DECLARE new_name text;
BEGIN
  FOR r IN
    SELECT c.relname AS idx_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'app_v3' AND c.relkind = 'i' AND c.relname LIKE '%organizer%'
  LOOP
    new_name := replace(r.idx_name, 'organizer', 'organization');
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c2
      JOIN pg_namespace n2 ON n2.oid = c2.relnamespace
      WHERE n2.nspname = 'app_v3' AND c2.relname = new_name
    ) THEN
      BEGIN
        EXECUTE format('ALTER INDEX app_v3.%I RENAME TO %I', r.idx_name, new_name);
      EXCEPTION WHEN others THEN
        -- ignore conflicts
      END;
    END IF;
  END LOOP;
END $$;

-- Rename constraints containing organizer
DO $$
DECLARE r record;
DECLARE new_name text;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass::text AS table_name
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'app_v3' AND c.conname LIKE '%organizer%'
  LOOP
    new_name := replace(r.conname, 'organizer', 'organization');
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c2
      JOIN pg_namespace n2 ON n2.oid = c2.connamespace
      WHERE n2.nspname = 'app_v3' AND c2.conname = new_name
    ) THEN
      BEGIN
        EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I', r.table_name, r.conname, new_name);
      EXCEPTION WHEN others THEN
        -- ignore conflicts
      END;
    END IF;
  END LOOP;
END $$;

-- Data normalization for global uniqueness
UPDATE app_v3.global_usernames
SET owner_type = 'organization'
WHERE owner_type = 'organizer';

UPDATE app_v3.profiles
SET roles = array_replace(roles, 'organizer', 'organization')
WHERE roles @> ARRAY['organizer'];

-- Unique constraint for organization usernames
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'app_v3' AND table_name = 'organizations' AND column_name = 'username'
  ) THEN
    BEGIN
      ALTER TABLE app_v3.organizations
        ADD CONSTRAINT organizations_username_key UNIQUE (username);
    EXCEPTION WHEN others THEN
      -- ignore if already exists or conflicts
    END;
  END IF;
END $$;
