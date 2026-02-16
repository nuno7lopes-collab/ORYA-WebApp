BEGIN;

ALTER TABLE app_v3.organizations
  ADD COLUMN IF NOT EXISTS public_tiktok text,
  ADD COLUMN IF NOT EXISTS public_linkedin text;

ALTER TABLE app_v3.organizations
  DROP COLUMN IF EXISTS public_profile_layout,
  DROP COLUMN IF EXISTS info_faq;

COMMIT;
