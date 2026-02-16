ALTER TABLE app_v3.reservation_resources
  ADD COLUMN IF NOT EXISTS court_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservation_resources_court_id_fkey'
  ) THEN
    ALTER TABLE app_v3.reservation_resources
      ADD CONSTRAINT reservation_resources_court_id_fkey
      FOREIGN KEY (court_id)
      REFERENCES app_v3.padel_club_courts(id)
      ON DELETE SET NULL
      ON UPDATE NO ACTION;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS reservation_resources_court_id_key
  ON app_v3.reservation_resources (court_id)
  WHERE court_id IS NOT NULL;

INSERT INTO app_v3.reservation_resources (
  organization_id,
  label,
  capacity,
  is_active,
  priority,
  court_id
)
SELECT
  club.organization_id,
  court.name,
  4,
  court.is_active,
  COALESCE(court.display_order, 0),
  court.id
FROM app_v3.padel_club_courts court
JOIN app_v3.padel_clubs club
  ON club.id = court.padel_club_id
LEFT JOIN app_v3.reservation_resources linked
  ON linked.court_id = court.id
WHERE
  court.deleted_at IS NULL
  AND club.deleted_at IS NULL
  AND linked.id IS NULL;

UPDATE app_v3.reservation_resources resource
SET
  label = court.name,
  is_active = court.is_active,
  priority = COALESCE(court.display_order, resource.priority)
FROM app_v3.padel_club_courts court
JOIN app_v3.padel_clubs club
  ON club.id = court.padel_club_id
WHERE
  resource.court_id = court.id
  AND club.organization_id = resource.organization_id;

UPDATE app_v3.bookings booking
SET resource_id = resource.id
FROM app_v3.reservation_resources resource
WHERE
  booking.court_id IS NOT NULL
  AND resource.court_id = booking.court_id
  AND (booking.resource_id IS NULL OR booking.resource_id <> resource.id);

UPDATE app_v3.booking_change_requests request
SET proposed_resource_id = resource.id
FROM app_v3.reservation_resources resource
WHERE
  request.proposed_court_id IS NOT NULL
  AND resource.court_id = request.proposed_court_id
  AND (request.proposed_resource_id IS NULL OR request.proposed_resource_id <> resource.id);
