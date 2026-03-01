-- Remocao definitiva de promotores: promo_codes e enum OrganizationMemberRole.

DO $$
DECLARE
  fk_name text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'app_v3'
      AND table_name = 'promo_codes'
      AND column_name = 'promoter_user_id'
  ) THEN
    FOR fk_name IN
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_schema = kcu.constraint_schema
       AND tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'app_v3'
        AND tc.table_name = 'promo_codes'
        AND kcu.column_name = 'promoter_user_id'
    LOOP
      EXECUTE format('ALTER TABLE app_v3.promo_codes DROP CONSTRAINT IF EXISTS %I', fk_name);
    END LOOP;

    EXECUTE 'DROP INDEX IF EXISTS app_v3.promo_codes_promoter_idx';
    EXECUTE 'ALTER TABLE app_v3.promo_codes DROP COLUMN IF EXISTS promoter_user_id';
  END IF;
END $$;

DO $$
DECLARE
  has_promoter boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'OrganizationMemberRole'
      AND e.enumlabel = 'PROMOTER'
  )
  INTO has_promoter;

  IF has_promoter THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'app_v3'
        AND t.typname = 'OrganizationMemberRole_new'
    ) THEN
      EXECUTE 'CREATE TYPE app_v3."OrganizationMemberRole_new" AS ENUM (''OWNER'', ''CO_OWNER'', ''ADMIN'', ''STAFF'')';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'app_v3'
        AND table_name = 'organization_group_members'
        AND column_name = 'role'
    ) THEN
      EXECUTE $sql$
        UPDATE app_v3.organization_group_members
        SET role = 'STAFF'
        WHERE role::text = 'PROMOTER'
      $sql$;

      EXECUTE $sql$
        ALTER TABLE app_v3.organization_group_members
        ALTER COLUMN role TYPE app_v3."OrganizationMemberRole_new"
        USING role::text::app_v3."OrganizationMemberRole_new"
      $sql$;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'app_v3'
        AND table_name = 'organization_member_invites'
        AND column_name = 'role'
    ) THEN
      EXECUTE $sql$
        UPDATE app_v3.organization_member_invites
        SET role = 'STAFF'
        WHERE role::text = 'PROMOTER'
      $sql$;

      EXECUTE $sql$
        ALTER TABLE app_v3.organization_member_invites
        ALTER COLUMN role TYPE app_v3."OrganizationMemberRole_new"
        USING role::text::app_v3."OrganizationMemberRole_new"
      $sql$;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'app_v3'
        AND table_name = 'organization_member_overrides'
        AND column_name = 'role_override'
    ) THEN
      EXECUTE $sql$
        UPDATE app_v3.organization_member_overrides
        SET role_override = 'STAFF'
        WHERE role_override::text = 'PROMOTER'
      $sql$;

      EXECUTE $sql$
        ALTER TABLE app_v3.organization_member_overrides
        ALTER COLUMN role_override TYPE app_v3."OrganizationMemberRole_new"
        USING role_override::text::app_v3."OrganizationMemberRole_new"
      $sql$;
    END IF;

    EXECUTE 'ALTER TYPE app_v3."OrganizationMemberRole" RENAME TO "OrganizationMemberRole_old"';
    EXECUTE 'ALTER TYPE app_v3."OrganizationMemberRole_new" RENAME TO "OrganizationMemberRole"';
    EXECUTE 'DROP TYPE app_v3."OrganizationMemberRole_old"';
  END IF;
END $$;
