ALTER TABLE app_v3.services
  ADD COLUMN party_size_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN party_size_min INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN party_size_max INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN party_size_step INTEGER NOT NULL DEFAULT 1;

UPDATE app_v3.services s
SET
  party_size_required = CASE
    WHEN s.assignment_mode IN ('RESOURCE_ONLY', 'PROFESSIONAL_AND_RESOURCE') THEN TRUE
    ELSE FALSE
  END,
  party_size_min = CASE
    WHEN s.assignment_mode = 'RESOURCE_ONLY' AND s.kind = 'COURT' THEN 2
    WHEN s.assignment_mode IN ('RESOURCE_ONLY', 'PROFESSIONAL_AND_RESOURCE') THEN 1
    ELSE 1
  END,
  party_size_max = GREATEST(
    CASE
      WHEN s.assignment_mode = 'RESOURCE_ONLY' AND s.kind = 'COURT' THEN 4
      WHEN s.assignment_mode IN ('RESOURCE_ONLY', 'PROFESSIONAL_AND_RESOURCE') THEN 2
      ELSE 1
    END,
    COALESCE((
      SELECT MAX(rr.capacity)
      FROM app_v3.service_resources sr
      JOIN app_v3.reservation_resources rr
        ON rr.id = sr.resource_id
      WHERE sr.service_id = s.id
    ), 1)
  ),
  party_size_step = 1;

ALTER TABLE app_v3.services
  ADD CONSTRAINT services_party_size_min_positive_ck CHECK (party_size_min > 0),
  ADD CONSTRAINT services_party_size_max_positive_ck CHECK (party_size_max > 0),
  ADD CONSTRAINT services_party_size_step_positive_ck CHECK (party_size_step > 0),
  ADD CONSTRAINT services_party_size_range_ck CHECK (party_size_max >= party_size_min);
