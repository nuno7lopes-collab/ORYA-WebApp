CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agenda_resource_claims_claimed_no_overlap_excl'
  ) THEN
    ALTER TABLE app_v3."agenda_resource_claims"
      ADD CONSTRAINT "agenda_resource_claims_claimed_no_overlap_excl"
      EXCLUDE USING gist (
        "organization_id" WITH =,
        "resource_type" WITH =,
        "resource_id" WITH =,
        tstzrange("starts_at", "ends_at", '[)') WITH &&
      )
      WHERE ("status" = 'CLAIMED'::app_v3."AgendaResourceClaimStatus");
  END IF;
END;
$$;
