DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'app_v3' AND table_name = 'store_orders'
  ) THEN
    ALTER TABLE app_v3.store_orders
      ADD COLUMN IF NOT EXISTS store_policy_snapshot_json jsonb,
      ADD COLUMN IF NOT EXISTS store_policy_version text,
      ADD COLUMN IF NOT EXISTS store_policy_captured_at timestamptz;

    WITH policy_source AS (
      SELECT
        so.id AS order_id,
        so.created_at,
        o.username,
        COALESCE(NULLIF(os.support_email, ''), NULLIF(o.official_email, '')) AS support_email,
        NULLIF(os.support_phone, '') AS support_phone,
        CASE
          WHEN os.store_return_policy_mode IN ('NO_RETURNS', 'WINDOW_DAYS') THEN os.store_return_policy_mode
          ELSE 'WINDOW_DAYS'
        END AS return_mode_raw,
        CASE
          WHEN os.store_return_window_days IS NULL THEN 14
          ELSE LEAST(730, GREATEST(0, os.store_return_window_days))
        END AS return_days_raw
      FROM app_v3.store_orders so
      JOIN app_v3.stores s ON s.id = so.store_id
      JOIN app_v3.organizations o ON o.id = s.owner_organization_id
      LEFT JOIN app_v3.organization_settings os ON os.organization_id = o.id
    ),
    normalized AS (
      SELECT
        order_id,
        created_at,
        support_email,
        support_phone,
        CASE WHEN username IS NULL OR btrim(username) = '' THEN NULL ELSE '/' || username || '/legal' END AS legal_url,
        return_mode_raw AS return_mode,
        CASE WHEN return_mode_raw = 'NO_RETURNS' THEN NULL ELSE return_days_raw END AS return_days
      FROM policy_source
    )
    UPDATE app_v3.store_orders so
    SET
      store_policy_snapshot_json = COALESCE(
        so.store_policy_snapshot_json,
        jsonb_build_object(
          'version', 1,
          'capturedAt', to_char(COALESCE(so.created_at, now()) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'supportEmail', n.support_email,
          'supportPhone', n.support_phone,
          'legalUrl', n.legal_url,
          'termsUrl', CASE WHEN n.legal_url IS NULL THEN NULL ELSE n.legal_url || '#termos' END,
          'privacyPolicy', CASE
            WHEN n.legal_url IS NULL THEN 'A privacidade desta organizacao segue o template legal da ORYA.'
            ELSE 'A privacidade desta organizacao segue o template legal da ORYA. Consulta ' || n.legal_url || '#privacidade para detalhes completos.'
          END,
          'returnPolicyMode', n.return_mode,
          'returnWindowDays', n.return_days,
          'returnPolicy', CASE
            WHEN n.return_mode = 'NO_RETURNS' THEN 'Sem devolucoes. Em caso de defeito, contactar o suporte.'
            WHEN COALESCE(n.return_days, 14) = 0 THEN 'Devolucoes permitidas no proprio dia da compra, para produtos sem sinais de uso.'
            ELSE 'Devolucoes permitidas durante ' || COALESCE(n.return_days, 14)::text || ' dia(s) apos a compra, para produtos sem sinais de uso.'
          END
        )
      ),
      store_policy_version = COALESCE(
        so.store_policy_version,
        'v1:' || COALESCE(n.return_mode, 'WINDOW_DAYS') || ':' || COALESCE(n.return_days::text, 'null')
      ),
      store_policy_captured_at = COALESCE(so.store_policy_captured_at, so.created_at)
    FROM normalized n
    WHERE n.order_id = so.id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'app_v3' AND table_name = 'organization_policies'
  ) THEN
    UPDATE app_v3.organization_policies
    SET cancellation_penalty_bps = 0
    WHERE cancellation_penalty_bps <> 0;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'app_v3' AND table_name = 'organization_settings'
  ) THEN
    ALTER TABLE app_v3.organization_settings
      DROP COLUMN IF EXISTS store_terms_url,
      DROP COLUMN IF EXISTS store_privacy_policy,
      DROP COLUMN IF EXISTS store_return_policy_notes;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'app_v3' AND table_name = 'stores'
  ) THEN
    ALTER TABLE app_v3.stores
      DROP COLUMN IF EXISTS support_email,
      DROP COLUMN IF EXISTS support_phone,
      DROP COLUMN IF EXISTS return_policy,
      DROP COLUMN IF EXISTS privacy_policy,
      DROP COLUMN IF EXISTS terms_url;
  END IF;
END
$$;
