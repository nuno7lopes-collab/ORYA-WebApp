-- Drop legacy coarse location columns from profiles (superseded by Address SSOT)

ALTER TABLE app_v3.profiles
  DROP COLUMN IF EXISTS location_city,
  DROP COLUMN IF EXISTS location_region;
