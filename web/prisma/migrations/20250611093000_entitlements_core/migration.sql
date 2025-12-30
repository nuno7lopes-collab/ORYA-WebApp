-- Entitlements materializados + QR/Check-in core (Bloco 3)

-- Enums
CREATE TYPE app_v3.entitlement_status AS ENUM ('ACTIVE', 'USED', 'REFUNDED', 'REVOKED', 'SUSPENDED');
CREATE TYPE app_v3.entitlement_type AS ENUM ('EVENT_TICKET', 'PADEL_ENTRY', 'PASS', 'SUBSCRIPTION_ACCESS', 'FUTURE_TYPE');
CREATE TYPE app_v3.checkin_result_code AS ENUM ('OK', 'ALREADY_USED', 'INVALID', 'REFUNDED', 'REVOKED', 'SUSPENDED', 'NOT_ALLOWED', 'OUTSIDE_WINDOW');

-- Entitlements table (materializada; escrita apenas pelo worker)
CREATE TABLE app_v3.entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type app_v3.entitlement_type NOT NULL,
  status app_v3.entitlement_status NOT NULL DEFAULT 'ACTIVE',
  owner_user_id uuid,
  owner_identity_id uuid,
  owner_key text NOT NULL,
  purchase_id text NOT NULL,
  sale_line_id integer NOT NULL,
  event_id integer,
  tournament_id integer,
  season_id integer,
  snapshot_title text NOT NULL,
  snapshot_cover_url text,
  snapshot_venue_name text,
  snapshot_start_at timestamptz NOT NULL,
  snapshot_timezone text NOT NULL,
  snapshot_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_v3.entitlements
  ADD CONSTRAINT entitlements_owner_xor CHECK (((owner_user_id IS NOT NULL)::int + (owner_identity_id IS NOT NULL)::int) = 1);

ALTER TABLE app_v3.entitlements
  ADD CONSTRAINT entitlements_owner_key_not_empty CHECK (char_length(owner_key) > 0);

ALTER TABLE app_v3.entitlements
  ADD CONSTRAINT entitlements_purchase_sale_owner_type_key UNIQUE (purchase_id, sale_line_id, owner_key, type);

CREATE INDEX entitlements_owner_start_idx ON app_v3.entitlements (owner_key, snapshot_start_at DESC);
CREATE INDEX entitlements_event_idx ON app_v3.entitlements (event_id);
CREATE INDEX entitlements_tournament_idx ON app_v3.entitlements (tournament_id);
CREATE INDEX entitlements_season_idx ON app_v3.entitlements (season_id);
CREATE INDEX entitlements_status_idx ON app_v3.entitlements (status);

-- FK helpers (opcionais, não bloqueiam legado)
ALTER TABLE app_v3.entitlements
  ADD CONSTRAINT entitlements_sale_line_fkey FOREIGN KEY (sale_line_id) REFERENCES app_v3.sale_lines(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE app_v3.entitlements
  ADD CONSTRAINT entitlements_event_fkey FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE SET NULL ON UPDATE NO ACTION;

-- QR token lookup
CREATE TABLE app_v3.entitlement_qr_tokens (
  id bigserial PRIMARY KEY,
  token_hash text NOT NULL,
  entitlement_id uuid NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entitlement_qr_tokens_token_unique UNIQUE (token_hash)
);

ALTER TABLE app_v3.entitlement_qr_tokens
  ADD CONSTRAINT entitlement_qr_tokens_entitlement_fkey FOREIGN KEY (entitlement_id) REFERENCES app_v3.entitlements(id) ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE INDEX entitlement_qr_tokens_entitlement_idx ON app_v3.entitlement_qr_tokens (entitlement_id);

-- Check-in audit/idempotência
CREATE TABLE app_v3.entitlement_checkins (
  id bigserial PRIMARY KEY,
  entitlement_id uuid NOT NULL,
  event_id integer NOT NULL,
  device_id text NOT NULL,
  result_code app_v3.checkin_result_code NOT NULL,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  checked_in_by uuid,
  purchase_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_v3.entitlement_checkins
  ADD CONSTRAINT entitlement_checkins_entitlement_fkey FOREIGN KEY (entitlement_id) REFERENCES app_v3.entitlements(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE app_v3.entitlement_checkins
  ADD CONSTRAINT entitlement_checkins_event_fkey FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE app_v3.entitlement_checkins
  ADD CONSTRAINT entitlement_checkins_event_entitlement_key UNIQUE (event_id, entitlement_id);

CREATE INDEX entitlement_checkins_event_idx ON app_v3.entitlement_checkins (event_id);
CREATE INDEX entitlement_checkins_purchase_idx ON app_v3.entitlement_checkins (purchase_id);
