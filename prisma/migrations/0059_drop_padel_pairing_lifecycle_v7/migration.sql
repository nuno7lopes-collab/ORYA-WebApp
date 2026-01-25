-- D12.5: remover lifecycle_status legacy (SSOT = PadelRegistration.status)
ALTER TABLE app_v3.padel_pairings
  DROP COLUMN IF EXISTS lifecycle_status;

DROP TYPE IF EXISTS app_v3."PadelPairingLifecycleStatus";
DROP TYPE IF EXISTS "PadelPairingLifecycleStatus";
