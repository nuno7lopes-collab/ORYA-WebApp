-- Address maintenance and cleanup (Apple Maps primary)
-- Safe to run multiple times (idempotent behavior where possible).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Address lookup rebuild for APPLE_MAPS addresses with provider IDs.
INSERT INTO app_v3.address_lookups (env, address_id, source_provider, source_provider_place_id)
SELECT a.env, a.id, a.source_provider, a.source_provider_place_id
FROM app_v3.addresses a
WHERE a.source_provider = 'APPLE_MAPS'::app_v3.address_source_provider
  AND a.source_provider_place_id IS NOT NULL
ON CONFLICT (source_provider, source_provider_place_id)
DO UPDATE SET
  address_id = EXCLUDED.address_id,
  resolved_at = now();

-- 2) Cleanup orphan rows.
DELETE FROM app_v3.address_lookups al
WHERE NOT EXISTS (SELECT 1 FROM app_v3.addresses a WHERE a.id = al.address_id);

DELETE FROM app_v3.addresses a
WHERE NOT EXISTS (SELECT 1 FROM app_v3.events e WHERE e.address_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM app_v3.padel_clubs c WHERE c.address_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM app_v3.address_lookups al WHERE al.address_id = a.id);
