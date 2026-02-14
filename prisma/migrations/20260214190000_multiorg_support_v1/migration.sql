BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'GroupMembershipRequestStatus'
  ) THEN
    CREATE TYPE app_v3."GroupMembershipRequestStatus" AS ENUM (
      'PENDING_CODES',
      'PENDING_EMAIL_CONFIRMATIONS',
      'COMPLETED',
      'CANCELLED',
      'EXPIRED',
      'LOCKED'
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'GroupMembershipRequestType'
  ) THEN
    CREATE TYPE app_v3."GroupMembershipRequestType" AS ENUM (
      'JOIN',
      'EXIT_KEEP_OWNER',
      'EXIT_TRANSFER_OWNER'
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'GroupOwnerTransferStatus'
  ) THEN
    CREATE TYPE app_v3."GroupOwnerTransferStatus" AS ENUM (
      'PENDING',
      'CONFIRMED',
      'CANCELLED',
      'EXPIRED'
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'SupportTicketStatus'
  ) THEN
    CREATE TYPE app_v3."SupportTicketStatus" AS ENUM (
      'OPEN',
      'IN_PROGRESS',
      'CLOSED'
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'SupportTicketCategory'
  ) THEN
    CREATE TYPE app_v3."SupportTicketCategory" AS ENUM (
      'ORGANIZACOES',
      'BILHETES',
      'PAGAMENTOS_REEMBOLSOS',
      'CONTA_ACESSO',
      'RESERVAS',
      'OUTRO'
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'SupportTicketActorType'
  ) THEN
    CREATE TYPE app_v3."SupportTicketActorType" AS ENUM (
      'REQUESTER',
      'ADMIN',
      'SYSTEM'
    );
  END IF;
END;
$$;

ALTER TABLE app_v3.organization_groups
  ADD COLUMN IF NOT EXISTS owner_user_id UUID;

WITH ranked AS (
  SELECT
    og.id AS group_id,
    ogm.user_id,
    ROW_NUMBER() OVER (
      PARTITION BY og.id
      ORDER BY
        CASE WHEN ogm.role::text = 'OWNER' THEN 0 ELSE 1 END,
        ogm.created_at ASC,
        ogm.id ASC
    ) AS rn
  FROM app_v3.organization_groups og
  JOIN app_v3.organization_group_members ogm ON ogm.group_id = og.id
)
UPDATE app_v3.organization_groups og
SET owner_user_id = ranked.user_id
FROM ranked
WHERE ranked.group_id = og.id
  AND ranked.rn = 1
  AND og.owner_user_id IS NULL;

WITH fallback AS (
  SELECT id
  FROM app_v3.profiles
  ORDER BY created_at ASC, id ASC
  LIMIT 1
)
UPDATE app_v3.organization_groups og
SET owner_user_id = fallback.id
FROM fallback
WHERE og.owner_user_id IS NULL;

ALTER TABLE app_v3.organization_groups
  ALTER COLUMN owner_user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organization_groups_owner_user_id_fkey'
      AND conrelid = 'app_v3.organization_groups'::regclass
  ) THEN
    ALTER TABLE app_v3.organization_groups
      ADD CONSTRAINT organization_groups_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES app_v3.profiles(id)
      ON DELETE RESTRICT ON UPDATE NO ACTION;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS organization_groups_owner_idx
  ON app_v3.organization_groups (owner_user_id);

CREATE TABLE IF NOT EXISTS app_v3.group_membership_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  env TEXT NOT NULL DEFAULT 'prod',
  type app_v3."GroupMembershipRequestType" NOT NULL,
  status app_v3."GroupMembershipRequestStatus" NOT NULL DEFAULT 'PENDING_CODES',
  group_id INT NOT NULL,
  organization_id INT NOT NULL,
  initiator_user_id UUID NOT NULL,
  current_org_owner_user_id UUID NOT NULL,
  target_owner_user_id UUID,
  group_owner_code_hash TEXT,
  org_owner_code_hash TEXT,
  target_owner_code_hash TEXT,
  group_owner_code_verified_at TIMESTAMPTZ(6),
  org_owner_code_verified_at TIMESTAMPTZ(6),
  target_owner_code_verified_at TIMESTAMPTZ(6),
  code_expires_at TIMESTAMPTZ(6),
  lockout_until TIMESTAMPTZ(6),
  attempt_count INT NOT NULL DEFAULT 0,
  group_owner_email_token_hash TEXT,
  org_owner_email_token_hash TEXT,
  target_owner_email_token_hash TEXT,
  group_owner_email_confirmed_at TIMESTAMPTZ(6),
  org_owner_email_confirmed_at TIMESTAMPTZ(6),
  target_owner_email_confirmed_at TIMESTAMPTZ(6),
  email_token_expires_at TIMESTAMPTZ(6),
  resend_count INT NOT NULL DEFAULT 0,
  correlation_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ(6),
  completed_at TIMESTAMPTZ(6),
  cancelled_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT group_membership_requests_group_fk
    FOREIGN KEY (group_id) REFERENCES app_v3.organization_groups(id) ON DELETE CASCADE,
  CONSTRAINT group_membership_requests_org_fk
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT group_membership_requests_initiator_fk
    FOREIGN KEY (initiator_user_id) REFERENCES app_v3.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT group_membership_requests_current_owner_fk
    FOREIGN KEY (current_org_owner_user_id) REFERENCES app_v3.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT group_membership_requests_target_owner_fk
    FOREIGN KEY (target_owner_user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS group_membership_requests_group_status_idx
  ON app_v3.group_membership_requests (group_id, status);
CREATE INDEX IF NOT EXISTS group_membership_requests_org_status_idx
  ON app_v3.group_membership_requests (organization_id, status);
CREATE INDEX IF NOT EXISTS group_membership_requests_initiator_idx
  ON app_v3.group_membership_requests (initiator_user_id);
CREATE INDEX IF NOT EXISTS group_membership_requests_expires_idx
  ON app_v3.group_membership_requests (expires_at);

CREATE TABLE IF NOT EXISTS app_v3.organization_group_owner_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  env TEXT NOT NULL DEFAULT 'prod',
  group_id INT NOT NULL,
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  status app_v3."GroupOwnerTransferStatus" NOT NULL DEFAULT 'PENDING',
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ(6) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ(6),
  cancelled_at TIMESTAMPTZ(6),
  CONSTRAINT organization_group_owner_transfers_group_fk
    FOREIGN KEY (group_id) REFERENCES app_v3.organization_groups(id) ON DELETE CASCADE,
  CONSTRAINT organization_group_owner_transfers_from_fk
    FOREIGN KEY (from_user_id) REFERENCES app_v3.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT organization_group_owner_transfers_to_fk
    FOREIGN KEY (to_user_id) REFERENCES app_v3.profiles(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS organization_group_owner_transfers_group_idx
  ON app_v3.organization_group_owner_transfers (group_id);
CREATE INDEX IF NOT EXISTS organization_group_owner_transfers_from_idx
  ON app_v3.organization_group_owner_transfers (from_user_id);
CREATE INDEX IF NOT EXISTS organization_group_owner_transfers_to_idx
  ON app_v3.organization_group_owner_transfers (to_user_id);

CREATE TABLE IF NOT EXISTS app_v3.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  env TEXT NOT NULL DEFAULT 'prod',
  ticket_number BIGINT GENERATED BY DEFAULT AS IDENTITY,
  requester_email CITEXT NOT NULL,
  requester_user_id UUID,
  category app_v3."SupportTicketCategory" NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status app_v3."SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  closed_at TIMESTAMPTZ(6),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT support_tickets_requester_user_fk
    FOREIGN KEY (requester_user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL,
  CONSTRAINT support_tickets_ticket_number_uniq UNIQUE (ticket_number)
);

CREATE INDEX IF NOT EXISTS support_tickets_status_created_idx
  ON app_v3.support_tickets (status, created_at);
CREATE INDEX IF NOT EXISTS support_tickets_category_created_idx
  ON app_v3.support_tickets (category, created_at);
CREATE INDEX IF NOT EXISTS support_tickets_requester_email_idx
  ON app_v3.support_tickets (requester_email);

CREATE TABLE IF NOT EXISTS app_v3.support_ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  env TEXT NOT NULL DEFAULT 'prod',
  ticket_id UUID NOT NULL,
  actor_type app_v3."SupportTicketActorType" NOT NULL,
  actor_user_id UUID,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT support_ticket_events_ticket_fk
    FOREIGN KEY (ticket_id) REFERENCES app_v3.support_tickets(id) ON DELETE CASCADE,
  CONSTRAINT support_ticket_events_actor_fk
    FOREIGN KEY (actor_user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS support_ticket_events_ticket_created_idx
  ON app_v3.support_ticket_events (ticket_id, created_at);
CREATE INDEX IF NOT EXISTS support_ticket_events_actor_idx
  ON app_v3.support_ticket_events (actor_user_id);

COMMIT;
