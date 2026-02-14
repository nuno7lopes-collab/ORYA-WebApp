-- Address provider hard-cut: APPLE_MAPS only.
-- 1) Normalize legacy rows to APPLE_MAPS.
UPDATE app_v3.addresses
SET source_provider = 'APPLE_MAPS'
WHERE source_provider = 'MANUAL';

UPDATE app_v3.address_lookups
SET source_provider = 'APPLE_MAPS'
WHERE source_provider = 'MANUAL';

-- 2) Recreate enum without MANUAL.
ALTER TYPE app_v3."AddressSourceProvider" RENAME TO "AddressSourceProvider_old";

CREATE TYPE app_v3."AddressSourceProvider" AS ENUM ('APPLE_MAPS');

ALTER TABLE app_v3.addresses
  ALTER COLUMN source_provider TYPE app_v3."AddressSourceProvider"
  USING source_provider::text::app_v3."AddressSourceProvider";

ALTER TABLE app_v3.address_lookups
  ALTER COLUMN source_provider TYPE app_v3."AddressSourceProvider"
  USING source_provider::text::app_v3."AddressSourceProvider";

DROP TYPE app_v3."AddressSourceProvider_old";
