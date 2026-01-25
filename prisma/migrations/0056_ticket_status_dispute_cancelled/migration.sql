DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'TicketStatus'
  ) THEN
    ALTER TYPE app_v3."TicketStatus" ADD VALUE IF NOT EXISTS 'DISPUTED';
    ALTER TYPE app_v3."TicketStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
  END IF;
END $$;
