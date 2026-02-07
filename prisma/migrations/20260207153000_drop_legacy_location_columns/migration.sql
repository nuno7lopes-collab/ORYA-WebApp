-- Drop legacy location/address columns now superseded by address_id + addressRef

ALTER TABLE app_v3.organizations
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS padel_default_city,
  DROP COLUMN IF EXISTS padel_default_address;

ALTER TABLE app_v3.events
  DROP COLUMN IF EXISTS location_name,
  DROP COLUMN IF EXISTS location_city,
  DROP COLUMN IF EXISTS location_address,
  DROP COLUMN IF EXISTS location_lat,
  DROP COLUMN IF EXISTS location_lng,
  DROP COLUMN IF EXISTS location_source,
  DROP COLUMN IF EXISTS location_provider_id,
  DROP COLUMN IF EXISTS location_formatted_address,
  DROP COLUMN IF EXISTS location_components,
  DROP COLUMN IF EXISTS location_overrides,
  DROP COLUMN IF EXISTS address;

ALTER TABLE app_v3.padel_clubs
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS location_source,
  DROP COLUMN IF EXISTS location_provider_id,
  DROP COLUMN IF EXISTS location_formatted_address,
  DROP COLUMN IF EXISTS location_components;

ALTER TABLE app_v3.search_index_items
  DROP COLUMN IF EXISTS location_city,
  DROP COLUMN IF EXISTS location_address,
  DROP COLUMN IF EXISTS location_lat,
  DROP COLUMN IF EXISTS location_lng,
  DROP COLUMN IF EXISTS location_name,
  DROP COLUMN IF EXISTS address;

ALTER TABLE app_v3.services
  DROP COLUMN IF EXISTS default_location_text;

ALTER TABLE app_v3.bookings
  DROP COLUMN IF EXISTS location_text;

ALTER TABLE app_v3.store_order_addresses
  DROP COLUMN IF EXISTS line1,
  DROP COLUMN IF EXISTS line2,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS region,
  DROP COLUMN IF EXISTS postal_code,
  DROP COLUMN IF EXISTS country;
