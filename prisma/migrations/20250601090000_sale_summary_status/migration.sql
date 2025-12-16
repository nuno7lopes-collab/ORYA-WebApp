DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SaleSummaryStatus' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname='app_v3')) THEN
    CREATE TYPE app_v3."SaleSummaryStatus" AS ENUM ('PAID','REFUNDED','DISPUTED','FAILED');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='app_v3' AND table_name='sale_summaries' AND column_name='status'
  ) THEN
    ALTER TABLE app_v3.sale_summaries ADD COLUMN status app_v3."SaleSummaryStatus" DEFAULT 'PAID';
  END IF;
END $$;
