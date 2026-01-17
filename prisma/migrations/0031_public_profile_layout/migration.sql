ALTER TABLE IF EXISTS app_v3.organizations
  ADD COLUMN IF NOT EXISTS public_profile_layout jsonb;
