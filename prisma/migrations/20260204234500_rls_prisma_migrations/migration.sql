-- Supabase linter: enable RLS on internal prisma migrations table.
ALTER TABLE IF EXISTS public._prisma_migrations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public._prisma_migrations FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public._prisma_migrations FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON TABLE public._prisma_migrations TO service_role;
  END IF;
END $$;

REVOKE ALL ON TABLE public._prisma_migrations FROM PUBLIC;
