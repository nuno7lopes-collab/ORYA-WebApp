ALTER TABLE app_v3.padel_pairing_slots
  ADD COLUMN IF NOT EXISTS invited_user_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'padel_pairing_slots_invited_user_fk'
  ) THEN
    ALTER TABLE app_v3.padel_pairing_slots
      ADD CONSTRAINT padel_pairing_slots_invited_user_fk
      FOREIGN KEY (invited_user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS padel_pairing_slots_invited_user_idx
  ON app_v3.padel_pairing_slots (invited_user_id);
