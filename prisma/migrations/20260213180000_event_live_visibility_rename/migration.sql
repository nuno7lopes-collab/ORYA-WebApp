DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'app_v3'
      AND table_name = 'events'
      AND column_name = 'live_hub_visibility'
  ) THEN
    ALTER TABLE app_v3.events RENAME COLUMN live_hub_visibility TO live_visibility;
  END IF;
END;
$$;
