-- Remove legacy test flag from events
ALTER TABLE app_v3.events DROP COLUMN IF EXISTS is_test;
