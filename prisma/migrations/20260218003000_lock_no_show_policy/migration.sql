DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'app_v3' AND table_name = 'organization_policies'
  ) THEN
    UPDATE app_v3.organization_policies
    SET no_show_fee_cents = 0
    WHERE no_show_fee_cents <> 0;
  END IF;
END
$$;
