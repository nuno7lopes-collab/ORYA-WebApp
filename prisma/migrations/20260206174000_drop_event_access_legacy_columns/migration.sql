-- Drop legacy event access columns (replaced by EventAccessPolicy)
ALTER TABLE app_v3.events
  DROP COLUMN IF EXISTS is_free,
  DROP COLUMN IF EXISTS invite_only,
  DROP COLUMN IF EXISTS public_access_mode,
  DROP COLUMN IF EXISTS participant_access_mode,
  DROP COLUMN IF EXISTS public_ticket_type_ids,
  DROP COLUMN IF EXISTS participant_ticket_type_ids;
