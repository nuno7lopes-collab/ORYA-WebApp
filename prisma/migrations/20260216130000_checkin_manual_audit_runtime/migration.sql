BEGIN;

ALTER TABLE app_v3.entitlement_checkins
  ADD COLUMN IF NOT EXISTS method app_v3.checkin_method,
  ADD COLUMN IF NOT EXISTS manual_reason text;

COMMIT;
