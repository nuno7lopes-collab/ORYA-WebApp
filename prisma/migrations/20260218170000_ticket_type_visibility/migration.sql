BEGIN;

ALTER TABLE app_v3.ticket_types
  ADD COLUMN IF NOT EXISTS public_access boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS participant_access boolean NOT NULL DEFAULT false;

UPDATE app_v3.ticket_types
SET
  public_access = COALESCE(public_access, true),
  participant_access = COALESCE(participant_access, false)
WHERE public_access IS NULL OR participant_access IS NULL;

COMMIT;
