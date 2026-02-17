DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM app_v3.padel_player_profiles
    WHERE user_id IS NOT NULL
    GROUP BY organization_id, user_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'PADEL_PLAYER_PROFILE_DUPLICATE_ORG_USER: run scripts/padel_dedupe_org_user_profiles.ts --apply before migration';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'padel_player_profiles_org_user_uq'
      AND connamespace = 'app_v3'::regnamespace
  ) THEN
    ALTER TABLE app_v3.padel_player_profiles
      ADD CONSTRAINT padel_player_profiles_org_user_uq UNIQUE (organization_id, user_id);
  END IF;
END
$$;
