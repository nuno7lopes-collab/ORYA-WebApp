-- Drop and recreate TicketOrder + TicketOrderLine with correct FK types
DROP TABLE IF EXISTS app_v3.ticket_order_lines CASCADE;
DROP TABLE IF EXISTS app_v3.ticket_orders CASCADE;

CREATE TABLE IF NOT EXISTS app_v3.ticket_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id int NOT NULL REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  event_id int NOT NULL REFERENCES app_v3.events(id) ON DELETE CASCADE,
  buyer_identity_id uuid,
  currency text NOT NULL DEFAULT 'EUR',
  status app_v3."TicketOrderStatus" NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ticket_orders_org_idx ON app_v3.ticket_orders(organization_id);
CREATE INDEX IF NOT EXISTS ticket_orders_event_idx ON app_v3.ticket_orders(event_id);

CREATE TABLE IF NOT EXISTS app_v3.ticket_order_lines (
  id serial PRIMARY KEY,
  ticket_order_id uuid NOT NULL REFERENCES app_v3.ticket_orders(id) ON DELETE CASCADE,
  ticket_type_id int NOT NULL REFERENCES app_v3.ticket_types(id) ON DELETE CASCADE,
  qty int NOT NULL,
  unit_amount int NOT NULL,
  total_amount int NOT NULL
);
CREATE INDEX IF NOT EXISTS ticket_order_lines_order_idx ON app_v3.ticket_order_lines(ticket_order_id);
CREATE INDEX IF NOT EXISTS ticket_order_lines_ticket_type_idx ON app_v3.ticket_order_lines(ticket_type_id);

-- Drop and recreate PadelRegistration + lines with correct FK types
DROP TABLE IF EXISTS app_v3.padel_registration_lines CASCADE;
DROP TABLE IF EXISTS app_v3.padel_registrations CASCADE;

CREATE TABLE IF NOT EXISTS app_v3.padel_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id int NOT NULL REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  event_id int NOT NULL REFERENCES app_v3.events(id) ON DELETE CASCADE,
  buyer_identity_id uuid,
  currency text NOT NULL DEFAULT 'EUR',
  status app_v3."PadelRegistrationStatus" NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS padel_registrations_org_idx ON app_v3.padel_registrations(organization_id);
CREATE INDEX IF NOT EXISTS padel_registrations_event_idx ON app_v3.padel_registrations(event_id);

CREATE TABLE IF NOT EXISTS app_v3.padel_registration_lines (
  id serial PRIMARY KEY,
  padel_registration_id uuid NOT NULL REFERENCES app_v3.padel_registrations(id) ON DELETE CASCADE,
  label text NOT NULL,
  qty int NOT NULL,
  unit_amount int NOT NULL,
  total_amount int NOT NULL
);
CREATE INDEX IF NOT EXISTS padel_registration_lines_reg_idx ON app_v3.padel_registration_lines(padel_registration_id);

-- Invite tokens (one-time)
CREATE TABLE IF NOT EXISTS app_v3.invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  event_id int NOT NULL REFERENCES app_v3.events(id) ON DELETE CASCADE,
  ticket_type_id int REFERENCES app_v3.ticket_types(id) ON DELETE SET NULL,
  email_normalized citext NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by_identity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invite_tokens_event_idx ON app_v3.invite_tokens(event_id);
CREATE INDEX IF NOT EXISTS invite_tokens_ticket_type_idx ON app_v3.invite_tokens(ticket_type_id);
CREATE INDEX IF NOT EXISTS invite_tokens_expires_idx ON app_v3.invite_tokens(expires_at);
CREATE INDEX IF NOT EXISTS invite_tokens_used_idx ON app_v3.invite_tokens(used_at);
