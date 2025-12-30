-- Add DATE_CHANGED to EventStatus enum if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = '\"EventStatus\"' AND e.enumlabel = 'DATE_CHANGED') THEN
    ALTER TYPE app_v3."EventStatus" ADD VALUE 'DATE_CHANGED';
  END IF;
END$$;
