-- CRM Contacts + EventLog-only ingest groundwork

DO $$ BEGIN
  CREATE TYPE app_v3."CrmContactStatus" AS ENUM ('ACTIVE', 'SUPPRESSED', 'DELETED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE app_v3."CrmContactType" AS ENUM ('CUSTOMER', 'FOLLOWER', 'LEAD', 'GUEST', 'STAFF');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE app_v3."CrmContactLegalBasis" AS ENUM ('CONSENT', 'CONTRACT', 'LEGITIMATE_INTEREST');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TYPE app_v3."CrmInteractionType" ADD VALUE IF NOT EXISTS 'ORG_FOLLOWED';
ALTER TYPE app_v3."CrmInteractionType" ADD VALUE IF NOT EXISTS 'ORG_UNFOLLOWED';
ALTER TYPE app_v3."CrmInteractionType" ADD VALUE IF NOT EXISTS 'PROFILE_VIEWED';
ALTER TYPE app_v3."CrmInteractionType" ADD VALUE IF NOT EXISTS 'EVENT_VIEWED';
ALTER TYPE app_v3."CrmInteractionType" ADD VALUE IF NOT EXISTS 'EVENT_SAVED';
ALTER TYPE app_v3."CrmInteractionType" ADD VALUE IF NOT EXISTS 'FORM_SUBMITTED';

ALTER TYPE app_v3."CrmInteractionSource" ADD VALUE IF NOT EXISTS 'ORGANIZATION';
ALTER TYPE app_v3."CrmInteractionSource" ADD VALUE IF NOT EXISTS 'PROFILE';
ALTER TYPE app_v3."CrmInteractionSource" ADD VALUE IF NOT EXISTS 'FORM';
ALTER TYPE app_v3."CrmInteractionSource" ADD VALUE IF NOT EXISTS 'SOCIAL';

CREATE TABLE IF NOT EXISTS app_v3.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id int NOT NULL,
  user_id uuid NULL,
  email_identity_id uuid NULL,
  status app_v3."CrmContactStatus" NOT NULL DEFAULT 'ACTIVE',
  contact_type app_v3."CrmContactType" NOT NULL DEFAULT 'LEAD',
  display_name text,
  contact_email citext,
  contact_phone text,
  legal_basis app_v3."CrmContactLegalBasis",
  marketing_email_opt_in boolean NOT NULL DEFAULT false,
  marketing_push_opt_in boolean NOT NULL DEFAULT false,
  first_interaction_at timestamptz,
  last_activity_at timestamptz,
  last_purchase_at timestamptz,
  total_spent_cents int NOT NULL DEFAULT 0,
  total_orders int NOT NULL DEFAULT 0,
  total_bookings int NOT NULL DEFAULT 0,
  total_attendances int NOT NULL DEFAULT 0,
  total_tournaments int NOT NULL DEFAULT 0,
  total_store_orders int NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  notes_count int NOT NULL DEFAULT 0,
  source_type text,
  source_id text,
  external_id text,
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_contacts_org_user_unique UNIQUE (organization_id, user_id),
  CONSTRAINT crm_contacts_org_identity_unique UNIQUE (organization_id, email_identity_id),
  CONSTRAINT crm_contacts_organization_fk FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT crm_contacts_user_fk FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL,
  CONSTRAINT crm_contacts_identity_fk FOREIGN KEY (email_identity_id) REFERENCES app_v3.email_identities(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS crm_contacts_org_last_activity_idx ON app_v3.crm_contacts (organization_id, last_activity_at);
CREATE INDEX IF NOT EXISTS crm_contacts_org_spent_idx ON app_v3.crm_contacts (organization_id, total_spent_cents);
CREATE INDEX IF NOT EXISTS crm_contacts_org_type_idx ON app_v3.crm_contacts (organization_id, contact_type);

CREATE TABLE IF NOT EXISTS app_v3.crm_contact_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id int NOT NULL,
  contact_id uuid NOT NULL,
  type app_v3."ConsentType" NOT NULL,
  status app_v3."ConsentStatus" NOT NULL,
  source text,
  granted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_contact_consents_org_contact_type_unique UNIQUE (organization_id, contact_id, type),
  CONSTRAINT crm_contact_consents_org_fk FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT crm_contact_consents_contact_fk FOREIGN KEY (contact_id) REFERENCES app_v3.crm_contacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS crm_contact_consents_org_contact_idx ON app_v3.crm_contact_consents (organization_id, contact_id);

CREATE TABLE IF NOT EXISTS app_v3.crm_contact_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id int NOT NULL,
  contact_id uuid NOT NULL,
  author_user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_contact_notes_org_fk FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT crm_contact_notes_contact_fk FOREIGN KEY (contact_id) REFERENCES app_v3.crm_contacts(id) ON DELETE CASCADE,
  CONSTRAINT crm_contact_notes_author_fk FOREIGN KEY (author_user_id) REFERENCES app_v3.profiles(id) ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS crm_contact_notes_org_contact_idx ON app_v3.crm_contact_notes (organization_id, contact_id, created_at);

CREATE TABLE IF NOT EXISTS app_v3.crm_contact_padel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id int NOT NULL,
  contact_id uuid NOT NULL,
  player_profile_id int NULL,
  level text,
  preferred_side app_v3."PadelPreferredSide",
  club_name text,
  tournaments_count int NOT NULL DEFAULT 0,
  no_show_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_contact_padel_contact_unique UNIQUE (contact_id),
  CONSTRAINT crm_contact_padel_org_fk FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT crm_contact_padel_contact_fk FOREIGN KEY (contact_id) REFERENCES app_v3.crm_contacts(id) ON DELETE CASCADE,
  CONSTRAINT crm_contact_padel_profile_fk FOREIGN KEY (player_profile_id) REFERENCES app_v3.padel_player_profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS crm_contact_padel_org_contact_idx ON app_v3.crm_contact_padel (organization_id, contact_id);

ALTER TABLE app_v3.padel_player_profiles ADD COLUMN IF NOT EXISTS crm_contact_id uuid;

ALTER TABLE app_v3.crm_interactions ADD COLUMN IF NOT EXISTS contact_id uuid;
ALTER TABLE app_v3.crm_interactions ADD COLUMN IF NOT EXISTS event_id uuid;
ALTER TABLE app_v3.crm_interactions ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE app_v3.crm_interactions ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE app_v3.crm_campaign_deliveries ADD COLUMN IF NOT EXISTS contact_id uuid;
ALTER TABLE app_v3.crm_campaign_deliveries ALTER COLUMN user_id DROP NOT NULL;

-- Backfill contacts from crm_customers
INSERT INTO app_v3.crm_contacts (
  organization_id,
  user_id,
  status,
  contact_type,
  display_name,
  contact_email,
  contact_phone,
  legal_basis,
  marketing_email_opt_in,
  marketing_push_opt_in,
  first_interaction_at,
  last_activity_at,
  last_purchase_at,
  total_spent_cents,
  total_orders,
  total_bookings,
  total_attendances,
  total_tournaments,
  total_store_orders,
  tags,
  notes_count,
  created_at,
  updated_at
)
SELECT
  organization_id,
  user_id,
  CASE
    WHEN status = 'SUPPRESSED'::app_v3."CrmCustomerStatus" THEN 'SUPPRESSED'::app_v3."CrmContactStatus"
    WHEN status = 'DELETED'::app_v3."CrmCustomerStatus" THEN 'DELETED'::app_v3."CrmContactStatus"
    ELSE 'ACTIVE'::app_v3."CrmContactStatus"
  END,
  'CUSTOMER'::app_v3."CrmContactType",
  display_name,
  contact_email,
  contact_phone,
  'CONTRACT'::app_v3."CrmContactLegalBasis",
  marketing_opt_in,
  false,
  first_interaction_at,
  last_activity_at,
  last_purchase_at,
  total_spent_cents,
  total_orders,
  total_bookings,
  total_attendances,
  total_tournaments,
  total_store_orders,
  tags,
  notes_count,
  created_at,
  updated_at
FROM app_v3.crm_customers
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Ensure contacts exist for any interactions without crm_customer
INSERT INTO app_v3.crm_contacts (
  organization_id,
  user_id,
  status,
  contact_type,
  first_interaction_at,
  last_activity_at,
  created_at,
  updated_at
)
SELECT
  organization_id,
  user_id,
  'ACTIVE'::app_v3."CrmContactStatus",
  'CUSTOMER'::app_v3."CrmContactType",
  MIN(occurred_at),
  MAX(occurred_at),
  now(),
  now()
FROM app_v3.crm_interactions
WHERE user_id IS NOT NULL
GROUP BY organization_id, user_id
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Ensure contacts exist for campaign deliveries without crm_customers/interactions
INSERT INTO app_v3.crm_contacts (
  organization_id,
  user_id,
  status,
  contact_type,
  created_at,
  updated_at
)
SELECT
  organization_id,
  user_id,
  'ACTIVE'::app_v3."CrmContactStatus",
  'LEAD'::app_v3."CrmContactType",
  now(),
  now()
FROM app_v3.crm_campaign_deliveries
WHERE user_id IS NOT NULL
GROUP BY organization_id, user_id
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Backfill contact consents from user consents
INSERT INTO app_v3.crm_contact_consents (
  organization_id,
  contact_id,
  type,
  status,
  source,
  granted_at,
  revoked_at,
  expires_at,
  created_at,
  updated_at
)
SELECT
  uc.organization_id,
  c.id,
  uc.type,
  uc.status,
  uc.source,
  uc.granted_at,
  uc.revoked_at,
  uc.expires_at,
  uc.created_at,
  uc.updated_at
FROM app_v3.user_consents uc
JOIN app_v3.crm_contacts c
  ON c.organization_id = uc.organization_id AND c.user_id = uc.user_id
ON CONFLICT (organization_id, contact_id, type) DO UPDATE
SET
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  granted_at = EXCLUDED.granted_at,
  revoked_at = EXCLUDED.revoked_at,
  expires_at = EXCLUDED.expires_at,
  updated_at = EXCLUDED.updated_at;

-- Backfill contact notes from crm_customer_notes
INSERT INTO app_v3.crm_contact_notes (
  organization_id,
  contact_id,
  author_user_id,
  body,
  created_at,
  updated_at
)
SELECT
  n.organization_id,
  c.id,
  n.author_user_id,
  n.body,
  n.created_at,
  n.updated_at
FROM app_v3.crm_customer_notes n
JOIN app_v3.crm_customers cc ON cc.id = n.customer_id
JOIN app_v3.crm_contacts c ON c.organization_id = cc.organization_id AND c.user_id = cc.user_id;

UPDATE app_v3.crm_contacts c
SET notes_count = sub.notes_count
FROM (
  SELECT organization_id, contact_id, COUNT(*) AS notes_count
  FROM app_v3.crm_contact_notes
  GROUP BY organization_id, contact_id
) sub
WHERE c.organization_id = sub.organization_id AND c.id = sub.contact_id;

UPDATE app_v3.crm_contacts c
SET notes_count = 0
WHERE NOT EXISTS (
  SELECT 1 FROM app_v3.crm_contact_notes n WHERE n.contact_id = c.id
);

-- Backfill contact_id in interactions and campaign deliveries
UPDATE app_v3.crm_interactions i
SET contact_id = c.id
FROM app_v3.crm_contacts c
WHERE i.user_id IS NOT NULL
  AND c.organization_id = i.organization_id
  AND c.user_id = i.user_id;

UPDATE app_v3.crm_campaign_deliveries d
SET contact_id = c.id
FROM app_v3.crm_contacts c
WHERE d.user_id IS NOT NULL
  AND c.organization_id = d.organization_id
  AND c.user_id = d.user_id;

UPDATE app_v3.padel_player_profiles p
SET crm_contact_id = c.id
FROM app_v3.crm_contacts c
WHERE p.user_id IS NOT NULL
  AND p.organization_id = c.organization_id
  AND p.user_id = c.user_id;

ALTER TABLE app_v3.crm_interactions
  ALTER COLUMN contact_id SET NOT NULL;

ALTER TABLE app_v3.crm_campaign_deliveries
  ALTER COLUMN contact_id SET NOT NULL;

ALTER TABLE app_v3.crm_interactions
  DROP CONSTRAINT IF EXISTS crm_interactions_org_source_type_unique;

ALTER TABLE app_v3.crm_campaign_deliveries
  DROP CONSTRAINT IF EXISTS crm_campaign_deliveries_campaign_user_unique;

ALTER TABLE app_v3.crm_interactions
  ADD CONSTRAINT crm_interactions_event_unique UNIQUE (event_id);

ALTER TABLE app_v3.crm_interactions
  ADD CONSTRAINT crm_interactions_org_external_unique UNIQUE (organization_id, external_id);

ALTER TABLE app_v3.crm_interactions
  ADD CONSTRAINT crm_interactions_contact_fk FOREIGN KEY (contact_id) REFERENCES app_v3.crm_contacts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS crm_interactions_org_contact_time_idx
  ON app_v3.crm_interactions (organization_id, contact_id, occurred_at);

ALTER TABLE app_v3.crm_campaign_deliveries
  ADD CONSTRAINT crm_campaign_deliveries_campaign_contact_unique UNIQUE (campaign_id, contact_id);

ALTER TABLE app_v3.crm_campaign_deliveries
  ADD CONSTRAINT crm_campaign_deliveries_contact_fk FOREIGN KEY (contact_id) REFERENCES app_v3.crm_contacts(id) ON DELETE CASCADE;

ALTER TABLE app_v3.padel_player_profiles
  ADD CONSTRAINT padel_player_profiles_crm_contact_fk FOREIGN KEY (crm_contact_id) REFERENCES app_v3.crm_contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS padel_player_profiles_org_crm_contact_idx
  ON app_v3.padel_player_profiles (organization_id, crm_contact_id);
