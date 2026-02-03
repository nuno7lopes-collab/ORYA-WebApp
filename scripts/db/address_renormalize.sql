-- Address re-normalization and cleanup (Apple Maps primary)
-- Safe to run multiple times (idempotent behavior where possible).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Normalize legacy location_source values to APPLE_MAPS where applicable.
UPDATE app_v3.events
SET location_source = 'APPLE_MAPS'::app_v3.location_source
WHERE location_source = 'OSM'::app_v3.location_source;

UPDATE app_v3.padel_clubs
SET location_source = 'APPLE_MAPS'::app_v3.location_source
WHERE location_source = 'OSM'::app_v3.location_source;

-- 2) Backfill missing event.address_id from existing event location payload.
WITH payload AS (
  SELECT
    e.id AS event_id,
    e.env AS env,
    COALESCE(NULLIF(e.location_formatted_address, ''), NULLIF(e.address, ''), NULLIF(e.location_name, '')) AS formatted,
    jsonb_strip_nulls(
      jsonb_build_object(
        'label', COALESCE(NULLIF(e.location_formatted_address, ''), NULLIF(e.address, ''), NULLIF(e.location_name, '')),
        'addressLine1', NULLIF(e.address, ''),
        'city', NULLIF(e.location_city, ''),
        'provider', CASE WHEN e.location_source = 'APPLE_MAPS'::app_v3.location_source THEN 'APPLE_MAPS' ELSE 'MANUAL' END
      )
    ) AS canonical,
    e.lat AS lat,
    e.lng AS lng,
    CASE
      WHEN e.location_source = 'APPLE_MAPS'::app_v3.location_source THEN 'APPLE_MAPS'::app_v3.address_source_provider
      ELSE 'MANUAL'::app_v3.address_source_provider
    END AS source_provider,
    NULLIF(e.location_provider_id, '') AS source_provider_place_id,
    CASE WHEN e.location_source = 'APPLE_MAPS'::app_v3.location_source THEN 85 ELSE 25 END AS confidence_score,
    CASE WHEN e.location_source = 'APPLE_MAPS'::app_v3.location_source THEN 'NORMALIZED'::app_v3.address_validation_status ELSE 'RAW'::app_v3.address_validation_status END AS validation_status
  FROM app_v3.events e
  WHERE
    e.address_id IS NULL
    AND e.lat IS NOT NULL
    AND e.lng IS NOT NULL
    AND COALESCE(NULLIF(e.location_formatted_address, ''), NULLIF(e.address, ''), NULLIF(e.location_name, '')) IS NOT NULL
), payload_h AS (
  SELECT
    p.*,
    encode(digest((p.canonical::text || ':' || p.lat::text || ':' || p.lng::text), 'sha256'), 'hex') AS address_hash
  FROM payload p
), ins AS (
  INSERT INTO app_v3.addresses (
    env,
    formatted_address,
    canonical,
    lat,
    lng,
    source_provider,
    source_provider_place_id,
    confidence_score,
    validation_status,
    address_hash
  )
  SELECT
    env,
    formatted,
    canonical,
    lat,
    lng,
    source_provider,
    source_provider_place_id,
    confidence_score,
    validation_status,
    address_hash
  FROM payload_h
  ON CONFLICT (address_hash)
  DO UPDATE SET
    updated_at = now(),
    source_provider = EXCLUDED.source_provider,
    source_provider_place_id = COALESCE(EXCLUDED.source_provider_place_id, app_v3.addresses.source_provider_place_id)
  RETURNING id, address_hash
)
UPDATE app_v3.events e
SET address_id = ins.id
FROM payload_h p
JOIN ins ON ins.address_hash = p.address_hash
WHERE e.id = p.event_id
  AND e.address_id IS NULL;

-- 3) Backfill missing/invalid club.address_id.
WITH payload AS (
  SELECT
    c.id AS club_id,
    c.env AS env,
    COALESCE(NULLIF(c.location_formatted_address, ''), NULLIF(c.address, ''), NULLIF(c.city, ''), c.name) AS formatted,
    jsonb_strip_nulls(
      jsonb_build_object(
        'label', COALESCE(NULLIF(c.location_formatted_address, ''), NULLIF(c.address, ''), NULLIF(c.city, ''), c.name),
        'addressLine1', NULLIF(c.address, ''),
        'city', NULLIF(c.city, ''),
        'provider', CASE WHEN c.location_source = 'APPLE_MAPS'::app_v3.location_source THEN 'APPLE_MAPS' ELSE 'MANUAL' END
      )
    ) AS canonical,
    COALESCE(c.lat, 0) AS lat,
    COALESCE(c.lng, 0) AS lng,
    CASE
      WHEN c.location_source = 'APPLE_MAPS'::app_v3.location_source THEN 'APPLE_MAPS'::app_v3.address_source_provider
      ELSE 'MANUAL'::app_v3.address_source_provider
    END AS source_provider,
    NULLIF(c.location_provider_id, '') AS source_provider_place_id,
    CASE WHEN c.location_source = 'APPLE_MAPS'::app_v3.location_source THEN 85 ELSE 25 END AS confidence_score,
    CASE WHEN c.location_source = 'APPLE_MAPS'::app_v3.location_source THEN 'NORMALIZED'::app_v3.address_validation_status ELSE 'RAW'::app_v3.address_validation_status END AS validation_status
  FROM app_v3.padel_clubs c
  LEFT JOIN app_v3.addresses a ON a.id = c.address_id
  WHERE c.address_id IS NULL OR a.id IS NULL
), payload_h AS (
  SELECT
    p.*,
    encode(digest((p.canonical::text || ':' || p.lat::text || ':' || p.lng::text), 'sha256'), 'hex') AS address_hash
  FROM payload p
), ins AS (
  INSERT INTO app_v3.addresses (
    env,
    formatted_address,
    canonical,
    lat,
    lng,
    source_provider,
    source_provider_place_id,
    confidence_score,
    validation_status,
    address_hash
  )
  SELECT
    env,
    formatted,
    canonical,
    lat,
    lng,
    source_provider,
    source_provider_place_id,
    confidence_score,
    validation_status,
    address_hash
  FROM payload_h
  ON CONFLICT (address_hash)
  DO UPDATE SET
    updated_at = now(),
    source_provider = EXCLUDED.source_provider,
    source_provider_place_id = COALESCE(EXCLUDED.source_provider_place_id, app_v3.addresses.source_provider_place_id)
  RETURNING id, address_hash
)
UPDATE app_v3.padel_clubs c
SET address_id = ins.id
FROM payload_h p
JOIN ins ON ins.address_hash = p.address_hash
WHERE c.id = p.club_id
  AND (c.address_id IS NULL OR c.address_id <> ins.id);

-- 4) Keep event/club location fields consistent with canonical address record.
UPDATE app_v3.events e
SET
  location_source = CASE
    WHEN a.source_provider = 'APPLE_MAPS'::app_v3.address_source_provider THEN 'APPLE_MAPS'::app_v3.location_source
    ELSE 'MANUAL'::app_v3.location_source
  END,
  location_provider_id = a.source_provider_place_id,
  location_formatted_address = a.formatted_address,
  location_components = a.canonical,
  lat = a.lat,
  lng = a.lng,
  address = COALESCE(a.formatted_address, e.address),
  location_city = COALESCE(NULLIF(a.canonical ->> 'city', ''), e.location_city)
FROM app_v3.addresses a
WHERE e.address_id = a.id;

UPDATE app_v3.padel_clubs c
SET
  location_source = CASE
    WHEN a.source_provider = 'APPLE_MAPS'::app_v3.address_source_provider THEN 'APPLE_MAPS'::app_v3.location_source
    ELSE 'MANUAL'::app_v3.location_source
  END,
  location_provider_id = a.source_provider_place_id,
  location_formatted_address = a.formatted_address,
  location_components = a.canonical,
  lat = a.lat,
  lng = a.lng,
  address = COALESCE(a.formatted_address, c.address),
  city = COALESCE(NULLIF(a.canonical ->> 'city', ''), c.city)
FROM app_v3.addresses a
WHERE c.address_id = a.id;

-- 5) Address lookup rebuild for APPLE_MAPS addresses with provider IDs.
INSERT INTO app_v3.address_lookups (env, address_id, source_provider, source_provider_place_id)
SELECT a.env, a.id, a.source_provider, a.source_provider_place_id
FROM app_v3.addresses a
WHERE a.source_provider = 'APPLE_MAPS'::app_v3.address_source_provider
  AND a.source_provider_place_id IS NOT NULL
ON CONFLICT (source_provider, source_provider_place_id)
DO UPDATE SET
  address_id = EXCLUDED.address_id,
  resolved_at = now();

-- 6) Cleanup orphan rows.
DELETE FROM app_v3.address_lookups al
WHERE NOT EXISTS (SELECT 1 FROM app_v3.addresses a WHERE a.id = al.address_id);

DELETE FROM app_v3.addresses a
WHERE NOT EXISTS (SELECT 1 FROM app_v3.events e WHERE e.address_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM app_v3.padel_clubs c WHERE c.address_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM app_v3.address_lookups al WHERE al.address_id = a.id);
