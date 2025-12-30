-- Holds para pairings (anti-oversell)
DO $$
BEGIN
  CREATE TYPE app_v3."PadelPairingHoldStatus" AS ENUM ('ACTIVE','CANCELLED','EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

CREATE TABLE IF NOT EXISTS app_v3.padel_pairing_holds (
  id serial PRIMARY KEY,
  pairing_id integer NOT NULL,
  event_id integer NOT NULL,
  holds integer NOT NULL DEFAULT 2,
  status app_v3."PadelPairingHoldStatus" NOT NULL DEFAULT 'ACTIVE',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT padel_pairing_holds_pairing_fk FOREIGN KEY (pairing_id) REFERENCES app_v3.padel_pairings(id) ON DELETE CASCADE
);

-- índice para lookup
CREATE INDEX IF NOT EXISTS padel_pairing_holds_pairing_idx ON app_v3.padel_pairing_holds(pairing_id);
CREATE INDEX IF NOT EXISTS padel_pairing_holds_event_idx ON app_v3.padel_pairing_holds(event_id);

-- Apenas um hold ACTIVE por pairing (permite múltiplos expirados/cancelados)
DO $$
BEGIN
  CREATE UNIQUE INDEX padel_pairing_holds_active_unique ON app_v3.padel_pairing_holds(pairing_id) WHERE status = 'ACTIVE';
EXCEPTION WHEN duplicate_table THEN NULL;
END$$;
