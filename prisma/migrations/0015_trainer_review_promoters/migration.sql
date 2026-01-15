DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'TrainerProfileReviewStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."TrainerProfileReviewStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

ALTER TABLE app_v3.trainer_profiles
  ADD COLUMN IF NOT EXISTS review_status app_v3."TrainerProfileReviewStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS review_note TEXT,
  ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id UUID;

CREATE INDEX IF NOT EXISTS trainer_profiles_org_review_idx
  ON app_v3.trainer_profiles (organization_id, review_status);

ALTER TABLE app_v3.promo_codes
  ADD COLUMN IF NOT EXISTS promoter_user_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'promo_codes_promoter_user_id_fk'
  ) THEN
    ALTER TABLE app_v3.promo_codes
      ADD CONSTRAINT promo_codes_promoter_user_id_fk
      FOREIGN KEY (promoter_user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS promo_codes_promoter_idx
  ON app_v3.promo_codes (promoter_user_id);
