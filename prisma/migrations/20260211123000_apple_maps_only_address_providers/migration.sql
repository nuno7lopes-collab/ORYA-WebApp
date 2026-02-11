-- Apple Maps is now the single external provider for address normalization.
-- Convert legacy OSM rows before constraining enum values.
UPDATE app_v3.addresses
SET source_provider = 'APPLE_MAPS'
WHERE source_provider IN ('OSM_PHOTON', 'OSM_NOMINATIM');

UPDATE app_v3.address_lookups
SET source_provider = 'APPLE_MAPS'
WHERE source_provider IN ('OSM_PHOTON', 'OSM_NOMINATIM');

ALTER TYPE app_v3."AddressSourceProvider" RENAME TO "AddressSourceProvider_old";

CREATE TYPE app_v3."AddressSourceProvider" AS ENUM ('APPLE_MAPS', 'MANUAL');

ALTER TABLE app_v3.addresses
  ALTER COLUMN source_provider TYPE app_v3."AddressSourceProvider"
  USING source_provider::text::app_v3."AddressSourceProvider";

ALTER TABLE app_v3.address_lookups
  ALTER COLUMN source_provider TYPE app_v3."AddressSourceProvider"
  USING source_provider::text::app_v3."AddressSourceProvider";

DROP TYPE app_v3."AddressSourceProvider_old";
