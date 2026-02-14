BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE app_v3.agenda_resource_claims
  ADD COLUMN IF NOT EXISTS authority_org_id INT,
  ADD COLUMN IF NOT EXISTS resource_key TEXT;

UPDATE app_v3.agenda_resource_claims acr
SET authority_org_id = acr.organization_id
WHERE acr.authority_org_id IS NULL;

-- COURT claims: authority comes from the owner organization of the source club.
UPDATE app_v3.agenda_resource_claims acr
SET authority_org_id = pc.organization_id
FROM app_v3.padel_club_courts pcc
JOIN app_v3.padel_clubs pc ON pc.id = pcc.padel_club_id
WHERE acr.resource_type = 'COURT'::app_v3."AgendaResourceClaimType"
  AND acr.resource_id ~ '^[0-9]+$'
  AND pcc.id = acr.resource_id::INT
  AND acr.authority_org_id IS DISTINCT FROM pc.organization_id;

-- CLUB claims: authority comes from the owner organization of the club.
UPDATE app_v3.agenda_resource_claims acr
SET authority_org_id = pc.organization_id
FROM app_v3.padel_clubs pc
WHERE acr.resource_type = 'CLUB'::app_v3."AgendaResourceClaimType"
  AND acr.resource_id ~ '^[0-9]+$'
  AND pc.id = acr.resource_id::INT
  AND acr.authority_org_id IS DISTINCT FROM pc.organization_id;

UPDATE app_v3.agenda_resource_claims acr
SET resource_key = concat(acr.resource_type::TEXT, ':', acr.authority_org_id::TEXT, ':', acr.resource_id)
WHERE acr.resource_key IS NULL;

ALTER TABLE app_v3.agenda_resource_claims
  ALTER COLUMN authority_org_id SET NOT NULL,
  ALTER COLUMN resource_key SET NOT NULL;

CREATE INDEX IF NOT EXISTS agenda_resource_claims_authority_org_idx
  ON app_v3.agenda_resource_claims (authority_org_id);

CREATE INDEX IF NOT EXISTS agenda_resource_claims_resource_key_time_idx
  ON app_v3.agenda_resource_claims (resource_key, starts_at);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agenda_resource_claims_claimed_no_overlap_excl'
      AND conrelid = 'app_v3.agenda_resource_claims'::regclass
  ) THEN
    ALTER TABLE app_v3.agenda_resource_claims
      DROP CONSTRAINT agenda_resource_claims_claimed_no_overlap_excl;
  END IF;

  ALTER TABLE app_v3.agenda_resource_claims
    ADD CONSTRAINT agenda_resource_claims_claimed_no_overlap_excl
    EXCLUDE USING gist (
      resource_key WITH =,
      tstzrange(starts_at, ends_at, '[)') WITH &&
    )
    WHERE (status = 'CLAIMED'::app_v3."AgendaResourceClaimStatus");
END;
$$;

COMMIT;
