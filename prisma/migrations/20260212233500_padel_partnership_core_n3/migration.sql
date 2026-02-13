-- N3 core: parcerias entre organizações + claims multi-recurso

-- 1) Enums novos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'PadelPartnershipStatus'
  ) THEN
    CREATE TYPE app_v3."PadelPartnershipStatus" AS ENUM (
      'PENDING',
      'APPROVED',
      'PAUSED',
      'REVOKED',
      'EXPIRED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'PadelPartnershipPriorityMode'
  ) THEN
    CREATE TYPE app_v3."PadelPartnershipPriorityMode" AS ENUM (
      'FIRST_CONFIRMED_WITH_OWNER_OVERRIDE',
      'OWNER_PRIORITY',
      'MANUAL_APPROVAL'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'AgendaResourceClaimType'
  ) THEN
    CREATE TYPE app_v3."AgendaResourceClaimType" AS ENUM (
      'CLUB',
      'COURT',
      'STAFF',
      'PROFESSIONAL',
      'TRAINER',
      'ROOM'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'AgendaResourceClaimStatus'
  ) THEN
    CREATE TYPE app_v3."AgendaResourceClaimStatus" AS ENUM (
      'CLAIMED',
      'RELEASED',
      'CANCELLED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'PadelTournamentRole'
  ) THEN
    CREATE TYPE app_v3."PadelTournamentRole" AS ENUM (
      'DIRETOR_PROVA',
      'REFEREE',
      'SCOREKEEPER',
      'STREAMER'
    );
  END IF;
END $$;

-- 2) Acordos de parceria
CREATE TABLE IF NOT EXISTS app_v3."padel_partnership_agreements" (
  "id" SERIAL PRIMARY KEY,
  "env" TEXT NOT NULL DEFAULT 'prod',
  "owner_organization_id" INTEGER NOT NULL,
  "partner_organization_id" INTEGER NOT NULL,
  "owner_club_id" INTEGER NOT NULL,
  "partner_club_id" INTEGER,
  "status" app_v3."PadelPartnershipStatus" NOT NULL DEFAULT 'PENDING',
  "starts_at" TIMESTAMPTZ(6),
  "ends_at" TIMESTAMPTZ(6),
  "requested_by_user_id" UUID,
  "approved_by_user_id" UUID,
  "approved_at" TIMESTAMPTZ(6),
  "revoked_by_user_id" UUID,
  "revoked_at" TIMESTAMPTZ(6),
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "padel_partnership_agreements_dates_chk" CHECK ("ends_at" IS NULL OR "starts_at" IS NULL OR "ends_at" > "starts_at")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_partnership_agreements_owner_org_fk'
  ) THEN
    ALTER TABLE app_v3."padel_partnership_agreements"
      ADD CONSTRAINT "padel_partnership_agreements_owner_org_fk"
      FOREIGN KEY ("owner_organization_id") REFERENCES app_v3."organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_partnership_agreements_partner_org_fk'
  ) THEN
    ALTER TABLE app_v3."padel_partnership_agreements"
      ADD CONSTRAINT "padel_partnership_agreements_partner_org_fk"
      FOREIGN KEY ("partner_organization_id") REFERENCES app_v3."organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_partnership_agreements_owner_club_fk'
  ) THEN
    ALTER TABLE app_v3."padel_partnership_agreements"
      ADD CONSTRAINT "padel_partnership_agreements_owner_club_fk"
      FOREIGN KEY ("owner_club_id") REFERENCES app_v3."padel_clubs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_partnership_agreements_partner_club_fk'
  ) THEN
    ALTER TABLE app_v3."padel_partnership_agreements"
      ADD CONSTRAINT "padel_partnership_agreements_partner_club_fk"
      FOREIGN KEY ("partner_club_id") REFERENCES app_v3."padel_clubs"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "padel_partnership_agreements_owner_org_idx"
  ON app_v3."padel_partnership_agreements"("owner_organization_id");
CREATE INDEX IF NOT EXISTS "padel_partnership_agreements_partner_org_idx"
  ON app_v3."padel_partnership_agreements"("partner_organization_id");
CREATE INDEX IF NOT EXISTS "padel_partnership_agreements_owner_club_idx"
  ON app_v3."padel_partnership_agreements"("owner_club_id");
CREATE INDEX IF NOT EXISTS "padel_partnership_agreements_status_idx"
  ON app_v3."padel_partnership_agreements"("status");

-- 3) Janelas operacionais
CREATE TABLE IF NOT EXISTS app_v3."padel_partnership_windows" (
  "id" SERIAL PRIMARY KEY,
  "env" TEXT NOT NULL DEFAULT 'prod',
  "agreement_id" INTEGER NOT NULL,
  "owner_club_id" INTEGER NOT NULL,
  "owner_court_id" INTEGER,
  "weekday_mask" INTEGER NOT NULL DEFAULT 127,
  "start_minute" INTEGER NOT NULL,
  "end_minute" INTEGER NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Lisbon',
  "starts_at" TIMESTAMPTZ(6),
  "ends_at" TIMESTAMPTZ(6),
  "requires_approval" BOOLEAN NOT NULL DEFAULT FALSE,
  "capacity_parallel_slots" INTEGER NOT NULL DEFAULT 1,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "padel_partnership_windows_minute_chk" CHECK (
    "start_minute" >= 0 AND "start_minute" <= 1439 AND "end_minute" >= 1 AND "end_minute" <= 1440 AND "end_minute" > "start_minute"
  ),
  CONSTRAINT "padel_partnership_windows_dates_chk" CHECK (
    "ends_at" IS NULL OR "starts_at" IS NULL OR "ends_at" > "starts_at"
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_partnership_windows_agreement_fk'
  ) THEN
    ALTER TABLE app_v3."padel_partnership_windows"
      ADD CONSTRAINT "padel_partnership_windows_agreement_fk"
      FOREIGN KEY ("agreement_id") REFERENCES app_v3."padel_partnership_agreements"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_partnership_windows_owner_club_fk'
  ) THEN
    ALTER TABLE app_v3."padel_partnership_windows"
      ADD CONSTRAINT "padel_partnership_windows_owner_club_fk"
      FOREIGN KEY ("owner_club_id") REFERENCES app_v3."padel_clubs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_partnership_windows_owner_court_fk'
  ) THEN
    ALTER TABLE app_v3."padel_partnership_windows"
      ADD CONSTRAINT "padel_partnership_windows_owner_court_fk"
      FOREIGN KEY ("owner_court_id") REFERENCES app_v3."padel_club_courts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "padel_partnership_windows_agreement_idx"
  ON app_v3."padel_partnership_windows"("agreement_id");
CREATE INDEX IF NOT EXISTS "padel_partnership_windows_club_court_idx"
  ON app_v3."padel_partnership_windows"("owner_club_id", "owner_court_id");
CREATE INDEX IF NOT EXISTS "padel_partnership_windows_active_idx"
  ON app_v3."padel_partnership_windows"("is_active");

-- 4) Política operacional por parceria
CREATE TABLE IF NOT EXISTS app_v3."padel_partnership_booking_policies" (
  "id" SERIAL PRIMARY KEY,
  "env" TEXT NOT NULL DEFAULT 'prod',
  "agreement_id" INTEGER NOT NULL,
  "priority_mode" app_v3."PadelPartnershipPriorityMode" NOT NULL DEFAULT 'FIRST_CONFIRMED_WITH_OWNER_OVERRIDE',
  "owner_override_allowed" BOOLEAN NOT NULL DEFAULT TRUE,
  "owner_override_requires_audit" BOOLEAN NOT NULL DEFAULT TRUE,
  "auto_compensation_on_override" BOOLEAN NOT NULL DEFAULT TRUE,
  "protect_external_reservations" BOOLEAN NOT NULL DEFAULT TRUE,
  "hard_stop_minutes_before_booking" INTEGER NOT NULL DEFAULT 30,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "padel_partnership_booking_policies_hard_stop_chk" CHECK ("hard_stop_minutes_before_booking" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "padel_partnership_booking_policy_agreement_uq"
  ON app_v3."padel_partnership_booking_policies"("agreement_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_partnership_booking_policies_agreement_fk'
  ) THEN
    ALTER TABLE app_v3."padel_partnership_booking_policies"
      ADD CONSTRAINT "padel_partnership_booking_policies_agreement_fk"
      FOREIGN KEY ("agreement_id") REFERENCES app_v3."padel_partnership_agreements"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "padel_partnership_booking_policy_priority_idx"
  ON app_v3."padel_partnership_booking_policies"("priority_mode");

-- 5) Grants temporários para staff parceiro
CREATE TABLE IF NOT EXISTS app_v3."padel_partner_role_grants" (
  "id" SERIAL PRIMARY KEY,
  "env" TEXT NOT NULL DEFAULT 'prod',
  "agreement_id" INTEGER NOT NULL,
  "partner_organization_id" INTEGER NOT NULL,
  "event_id" INTEGER,
  "user_id" UUID NOT NULL,
  "role" app_v3."PadelTournamentRole" NOT NULL,
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "auto_revoke" BOOLEAN NOT NULL DEFAULT TRUE,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "granted_by_user_id" UUID,
  "revoked_by_user_id" UUID,
  "revoked_at" TIMESTAMPTZ(6),
  "scope" JSONB DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "padel_partner_role_grants_dates_chk" CHECK ("expires_at" > "starts_at")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_partner_role_grants_agreement_fk'
  ) THEN
    ALTER TABLE app_v3."padel_partner_role_grants"
      ADD CONSTRAINT "padel_partner_role_grants_agreement_fk"
      FOREIGN KEY ("agreement_id") REFERENCES app_v3."padel_partnership_agreements"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_partner_role_grants_partner_org_fk'
  ) THEN
    ALTER TABLE app_v3."padel_partner_role_grants"
      ADD CONSTRAINT "padel_partner_role_grants_partner_org_fk"
      FOREIGN KEY ("partner_organization_id") REFERENCES app_v3."organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_partner_role_grants_event_fk'
  ) THEN
    ALTER TABLE app_v3."padel_partner_role_grants"
      ADD CONSTRAINT "padel_partner_role_grants_event_fk"
      FOREIGN KEY ("event_id") REFERENCES app_v3."events"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "padel_partner_role_grants_agreement_idx"
  ON app_v3."padel_partner_role_grants"("agreement_id");
CREATE INDEX IF NOT EXISTS "padel_partner_role_grants_partner_org_idx"
  ON app_v3."padel_partner_role_grants"("partner_organization_id");
CREATE INDEX IF NOT EXISTS "padel_partner_role_grants_event_idx"
  ON app_v3."padel_partner_role_grants"("event_id");
CREATE INDEX IF NOT EXISTS "padel_partner_role_grants_user_idx"
  ON app_v3."padel_partner_role_grants"("user_id");
CREATE INDEX IF NOT EXISTS "padel_partner_role_grants_active_expiry_idx"
  ON app_v3."padel_partner_role_grants"("is_active", "expires_at");

-- 6) Snapshot de courts parceiro
CREATE TABLE IF NOT EXISTS app_v3."padel_partner_court_snapshots" (
  "id" SERIAL PRIMARY KEY,
  "env" TEXT NOT NULL DEFAULT 'prod',
  "partner_organization_id" INTEGER NOT NULL,
  "partner_club_id" INTEGER NOT NULL,
  "source_club_id" INTEGER NOT NULL,
  "source_court_id" INTEGER NOT NULL,
  "local_court_id" INTEGER,
  "name" TEXT NOT NULL,
  "surface" TEXT,
  "indoor" BOOLEAN NOT NULL DEFAULT FALSE,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "source_updated_at" TIMESTAMPTZ(6),
  "synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "ttl_at" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS "padel_partner_court_snapshots_partner_source_uq"
  ON app_v3."padel_partner_court_snapshots"("partner_club_id", "source_court_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_partner_court_snapshots_partner_org_fk'
  ) THEN
    ALTER TABLE app_v3."padel_partner_court_snapshots"
      ADD CONSTRAINT "padel_partner_court_snapshots_partner_org_fk"
      FOREIGN KEY ("partner_organization_id") REFERENCES app_v3."organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_partner_court_snapshots_partner_club_fk'
  ) THEN
    ALTER TABLE app_v3."padel_partner_court_snapshots"
      ADD CONSTRAINT "padel_partner_court_snapshots_partner_club_fk"
      FOREIGN KEY ("partner_club_id") REFERENCES app_v3."padel_clubs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_partner_court_snapshots_source_club_fk'
  ) THEN
    ALTER TABLE app_v3."padel_partner_court_snapshots"
      ADD CONSTRAINT "padel_partner_court_snapshots_source_club_fk"
      FOREIGN KEY ("source_club_id") REFERENCES app_v3."padel_clubs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_partner_court_snapshots_local_court_fk'
  ) THEN
    ALTER TABLE app_v3."padel_partner_court_snapshots"
      ADD CONSTRAINT "padel_partner_court_snapshots_local_court_fk"
      FOREIGN KEY ("local_court_id") REFERENCES app_v3."padel_club_courts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "padel_partner_court_snapshots_partner_org_idx"
  ON app_v3."padel_partner_court_snapshots"("partner_organization_id");
CREATE INDEX IF NOT EXISTS "padel_partner_court_snapshots_source_club_idx"
  ON app_v3."padel_partner_court_snapshots"("source_club_id");
CREATE INDEX IF NOT EXISTS "padel_partner_court_snapshots_local_court_idx"
  ON app_v3."padel_partner_court_snapshots"("local_court_id");
CREATE INDEX IF NOT EXISTS "padel_partner_court_snapshots_active_ttl_idx"
  ON app_v3."padel_partner_court_snapshots"("is_active", "ttl_at");

-- 7) Overrides auditáveis
CREATE TABLE IF NOT EXISTS app_v3."padel_partnership_overrides" (
  "id" SERIAL PRIMARY KEY,
  "env" TEXT NOT NULL DEFAULT 'prod',
  "agreement_id" INTEGER NOT NULL,
  "owner_organization_id" INTEGER NOT NULL,
  "partner_organization_id" INTEGER NOT NULL,
  "event_id" INTEGER,
  "target_type" TEXT NOT NULL,
  "target_source_id" TEXT,
  "court_id" INTEGER,
  "starts_at" TIMESTAMPTZ(6),
  "ends_at" TIMESTAMPTZ(6),
  "reason" TEXT NOT NULL,
  "impact" JSONB DEFAULT '{}',
  "created_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "padel_partnership_overrides_dates_chk" CHECK ("ends_at" IS NULL OR "starts_at" IS NULL OR "ends_at" > "starts_at")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_partnership_overrides_agreement_fk'
  ) THEN
    ALTER TABLE app_v3."padel_partnership_overrides"
      ADD CONSTRAINT "padel_partnership_overrides_agreement_fk"
      FOREIGN KEY ("agreement_id") REFERENCES app_v3."padel_partnership_agreements"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_partnership_overrides_owner_org_fk'
  ) THEN
    ALTER TABLE app_v3."padel_partnership_overrides"
      ADD CONSTRAINT "padel_partnership_overrides_owner_org_fk"
      FOREIGN KEY ("owner_organization_id") REFERENCES app_v3."organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_partnership_overrides_partner_org_fk'
  ) THEN
    ALTER TABLE app_v3."padel_partnership_overrides"
      ADD CONSTRAINT "padel_partnership_overrides_partner_org_fk"
      FOREIGN KEY ("partner_organization_id") REFERENCES app_v3."organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_partnership_overrides_event_fk'
  ) THEN
    ALTER TABLE app_v3."padel_partnership_overrides"
      ADD CONSTRAINT "padel_partnership_overrides_event_fk"
      FOREIGN KEY ("event_id") REFERENCES app_v3."events"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_partnership_overrides_court_fk'
  ) THEN
    ALTER TABLE app_v3."padel_partnership_overrides"
      ADD CONSTRAINT "padel_partnership_overrides_court_fk"
      FOREIGN KEY ("court_id") REFERENCES app_v3."padel_club_courts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "padel_partnership_overrides_agreement_idx"
  ON app_v3."padel_partnership_overrides"("agreement_id");
CREATE INDEX IF NOT EXISTS "padel_partnership_overrides_owner_org_idx"
  ON app_v3."padel_partnership_overrides"("owner_organization_id");
CREATE INDEX IF NOT EXISTS "padel_partnership_overrides_partner_org_idx"
  ON app_v3."padel_partnership_overrides"("partner_organization_id");
CREATE INDEX IF NOT EXISTS "padel_partnership_overrides_event_idx"
  ON app_v3."padel_partnership_overrides"("event_id");

-- 8) Claims multi-recurso para agenda canónica
CREATE TABLE IF NOT EXISTS app_v3."agenda_resource_claims" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "env" TEXT NOT NULL DEFAULT 'prod',
  "organization_id" INTEGER NOT NULL,
  "event_id" INTEGER,
  "source_type" app_v3."SourceType" NOT NULL,
  "source_id" TEXT NOT NULL,
  "resource_type" app_v3."AgendaResourceClaimType" NOT NULL,
  "resource_id" TEXT NOT NULL,
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "ends_at" TIMESTAMPTZ(6) NOT NULL,
  "status" app_v3."AgendaResourceClaimStatus" NOT NULL DEFAULT 'CLAIMED',
  "metadata" JSONB DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "agenda_resource_claims_dates_chk" CHECK ("ends_at" > "starts_at")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agenda_resource_claims_org_fk'
  ) THEN
    ALTER TABLE app_v3."agenda_resource_claims"
      ADD CONSTRAINT "agenda_resource_claims_org_fk"
      FOREIGN KEY ("organization_id") REFERENCES app_v3."organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agenda_resource_claims_event_fk'
  ) THEN
    ALTER TABLE app_v3."agenda_resource_claims"
      ADD CONSTRAINT "agenda_resource_claims_event_fk"
      FOREIGN KEY ("event_id") REFERENCES app_v3."events"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "agenda_resource_claims_org_idx"
  ON app_v3."agenda_resource_claims"("organization_id");
CREATE INDEX IF NOT EXISTS "agenda_resource_claims_event_idx"
  ON app_v3."agenda_resource_claims"("event_id");
CREATE INDEX IF NOT EXISTS "agenda_resource_claims_resource_time_idx"
  ON app_v3."agenda_resource_claims"("resource_type", "resource_id", "starts_at");
CREATE INDEX IF NOT EXISTS "agenda_resource_claims_source_idx"
  ON app_v3."agenda_resource_claims"("source_type", "source_id");
CREATE INDEX IF NOT EXISTS "agenda_resource_claims_status_idx"
  ON app_v3."agenda_resource_claims"("status");
