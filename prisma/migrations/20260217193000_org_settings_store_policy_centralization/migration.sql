DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'app_v3'
      AND table_name = 'organization_settings'
  ) THEN
    ALTER TABLE app_v3.organization_settings
      ADD COLUMN IF NOT EXISTS support_email text,
      ADD COLUMN IF NOT EXISTS support_phone text,
      ADD COLUMN IF NOT EXISTS store_terms_url text,
      ADD COLUMN IF NOT EXISTS store_privacy_policy text,
      ADD COLUMN IF NOT EXISTS store_return_policy_mode text,
      ADD COLUMN IF NOT EXISTS store_return_window_days integer,
      ADD COLUMN IF NOT EXISTS store_return_policy_notes text;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'organization_settings_store_return_policy_mode_chk'
    ) THEN
      ALTER TABLE app_v3.organization_settings
        ADD CONSTRAINT organization_settings_store_return_policy_mode_chk
        CHECK (
          store_return_policy_mode IS NULL
          OR store_return_policy_mode IN ('NO_RETURNS', 'WINDOW_DAYS')
        );
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'organization_settings_store_return_window_days_chk'
    ) THEN
      ALTER TABLE app_v3.organization_settings
        ADD CONSTRAINT organization_settings_store_return_window_days_chk
        CHECK (
          store_return_window_days IS NULL
          OR (store_return_window_days >= 0 AND store_return_window_days <= 730)
        );
    END IF;

    UPDATE app_v3.organization_settings os
    SET
      support_email = COALESCE(os.support_email, s.support_email),
      support_phone = COALESCE(os.support_phone, s.support_phone),
      store_terms_url = COALESCE(os.store_terms_url, s.terms_url),
      store_privacy_policy = COALESCE(os.store_privacy_policy, s.privacy_policy),
      store_return_policy_notes = COALESCE(os.store_return_policy_notes, s.return_policy),
      store_return_policy_mode = COALESCE(
        os.store_return_policy_mode,
        CASE
          WHEN s.return_policy IS NULL OR btrim(s.return_policy) = '' THEN NULL
          WHEN lower(s.return_policy) ~ 'sem\\s+devol' THEN 'NO_RETURNS'
          ELSE 'WINDOW_DAYS'
        END
      ),
      store_return_window_days = COALESCE(
        os.store_return_window_days,
        CASE
          WHEN s.return_policy IS NULL OR btrim(s.return_policy) = '' THEN NULL
          WHEN lower(s.return_policy) ~ 'sem\\s+devol' THEN NULL
          WHEN regexp_match(s.return_policy, '(\\d{1,4})') IS NOT NULL
            THEN LEAST(730, GREATEST(0, ((regexp_match(s.return_policy, '(\\d{1,4})'))[1])::integer))
          ELSE 14
        END
      ),
      updated_at = now()
    FROM app_v3.stores s
    WHERE s.owner_organization_id = os.organization_id;

    INSERT INTO app_v3.organization_settings (
      organization_id,
      support_email,
      support_phone,
      store_terms_url,
      store_privacy_policy,
      store_return_policy_mode,
      store_return_window_days,
      store_return_policy_notes,
      created_at,
      updated_at
    )
    SELECT
      s.owner_organization_id,
      s.support_email,
      s.support_phone,
      s.terms_url,
      s.privacy_policy,
      CASE
        WHEN s.return_policy IS NULL OR btrim(s.return_policy) = '' THEN NULL
        WHEN lower(s.return_policy) ~ 'sem\\s+devol' THEN 'NO_RETURNS'
        ELSE 'WINDOW_DAYS'
      END,
      CASE
        WHEN s.return_policy IS NULL OR btrim(s.return_policy) = '' THEN NULL
        WHEN lower(s.return_policy) ~ 'sem\\s+devol' THEN NULL
        WHEN regexp_match(s.return_policy, '(\\d{1,4})') IS NOT NULL
          THEN LEAST(730, GREATEST(0, ((regexp_match(s.return_policy, '(\\d{1,4})'))[1])::integer))
        ELSE 14
      END,
      s.return_policy,
      now(),
      now()
    FROM app_v3.stores s
    LEFT JOIN app_v3.organization_settings os
      ON os.organization_id = s.owner_organization_id
    WHERE os.organization_id IS NULL;
  END IF;
END
$$;
