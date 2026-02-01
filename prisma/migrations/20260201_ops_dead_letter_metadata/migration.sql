-- Add DLQ metadata fields to operations
ALTER TABLE app_v3.operations
  ADD COLUMN IF NOT EXISTS reason_code text,
  ADD COLUMN IF NOT EXISTS error_class text,
  ADD COLUMN IF NOT EXISTS error_stack text,
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
