ALTER TABLE app_v3.organization_settings
  ADD COLUMN IF NOT EXISTS booking_grid_minutes integer,
  ADD COLUMN IF NOT EXISTS booking_allowed_durations integer[],
  ADD COLUMN IF NOT EXISTS booking_allow_custom_duration boolean;

UPDATE app_v3.organization_settings
SET
  booking_grid_minutes = COALESCE(booking_grid_minutes, 30),
  booking_allowed_durations = COALESCE(booking_allowed_durations, ARRAY[60, 90]),
  booking_allow_custom_duration = COALESCE(booking_allow_custom_duration, false),
  updated_at = now();

INSERT INTO app_v3.organization_settings (
  organization_id,
  booking_grid_minutes,
  booking_allowed_durations,
  booking_allow_custom_duration,
  created_at,
  updated_at
)
SELECT
  o.id,
  30,
  ARRAY[60, 90],
  false,
  now(),
  now()
FROM app_v3.organizations o
LEFT JOIN app_v3.organization_settings os
  ON os.organization_id = o.id
WHERE os.organization_id IS NULL;

ALTER TABLE app_v3.organization_settings
  ALTER COLUMN booking_grid_minutes SET DEFAULT 30,
  ALTER COLUMN booking_grid_minutes SET NOT NULL,
  ALTER COLUMN booking_allowed_durations SET DEFAULT ARRAY[60, 90],
  ALTER COLUMN booking_allowed_durations SET NOT NULL,
  ALTER COLUMN booking_allow_custom_duration SET DEFAULT false,
  ALTER COLUMN booking_allow_custom_duration SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organization_settings_booking_grid_minutes_chk'
  ) THEN
    ALTER TABLE app_v3.organization_settings
      ADD CONSTRAINT organization_settings_booking_grid_minutes_chk
      CHECK (
        booking_grid_minutes > 0
        AND booking_grid_minutes <= 60
        AND booking_grid_minutes % 5 = 0
        AND 60 % booking_grid_minutes = 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organization_settings_booking_allowed_durations_nonempty_chk'
  ) THEN
    ALTER TABLE app_v3.organization_settings
      ADD CONSTRAINT organization_settings_booking_allowed_durations_nonempty_chk
      CHECK (array_length(booking_allowed_durations, 1) >= 1);
  END IF;
END
$$;

ALTER TABLE app_v3.trainer_profiles
  ADD COLUMN IF NOT EXISTS reservation_professional_id integer;

INSERT INTO app_v3.reservation_professionals (
  organization_id,
  user_id,
  name,
  role_title,
  is_active,
  priority
)
SELECT
  tp.organization_id,
  tp.user_id,
  COALESCE(NULLIF(btrim(p.full_name), ''), NULLIF(btrim(p.username), ''), 'Treinador') AS name,
  'Treinador',
  true,
  0
FROM app_v3.trainer_profiles tp
LEFT JOIN app_v3.profiles p
  ON p.id = tp.user_id
LEFT JOIN app_v3.reservation_professionals rp
  ON rp.organization_id = tp.organization_id
 AND rp.user_id = tp.user_id
WHERE tp.user_id IS NOT NULL
  AND rp.id IS NULL;

CREATE TEMP TABLE tmp_reservation_professional_dedup ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    rp.id,
    rp.organization_id,
    rp.user_id,
    first_value(rp.id) OVER (
      PARTITION BY rp.organization_id, rp.user_id
      ORDER BY rp.is_active DESC, rp.updated_at DESC, rp.created_at ASC, rp.id ASC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY rp.organization_id, rp.user_id
      ORDER BY rp.is_active DESC, rp.updated_at DESC, rp.created_at ASC, rp.id ASC
    ) AS rn
  FROM app_v3.reservation_professionals rp
  WHERE rp.user_id IS NOT NULL
)
SELECT
  id AS drop_id,
  keep_id,
  organization_id,
  user_id
FROM ranked
WHERE rn > 1;

DELETE FROM app_v3.service_professionals sp
USING tmp_reservation_professional_dedup d
WHERE sp.professional_id = d.drop_id
  AND EXISTS (
    SELECT 1
    FROM app_v3.service_professionals existing
    WHERE existing.service_id = sp.service_id
      AND existing.professional_id = d.keep_id
  );

UPDATE app_v3.service_professionals sp
SET professional_id = d.keep_id
FROM tmp_reservation_professional_dedup d
WHERE sp.professional_id = d.drop_id;

UPDATE app_v3.bookings b
SET professional_id = d.keep_id
FROM tmp_reservation_professional_dedup d
WHERE b.professional_id = d.drop_id;

UPDATE app_v3.class_series cs
SET professional_id = d.keep_id
FROM tmp_reservation_professional_dedup d
WHERE cs.professional_id = d.drop_id;

UPDATE app_v3.class_sessions cse
SET professional_id = d.keep_id
FROM tmp_reservation_professional_dedup d
WHERE cse.professional_id = d.drop_id;

UPDATE app_v3.booking_change_requests bcr
SET proposed_professional_id = d.keep_id
FROM tmp_reservation_professional_dedup d
WHERE bcr.proposed_professional_id = d.drop_id;

UPDATE app_v3.agenda_items ai
SET professional_id = d.keep_id
FROM tmp_reservation_professional_dedup d
WHERE ai.professional_id = d.drop_id;

UPDATE app_v3.availability_schedules sch
SET scope_id = d.keep_id
FROM tmp_reservation_professional_dedup d
WHERE sch.scope_type = 'PROFESSIONAL'
  AND sch.scope_id = d.drop_id;

UPDATE app_v3.availability_overrides ov
SET scope_id = d.keep_id
FROM tmp_reservation_professional_dedup d
WHERE ov.scope_type = 'PROFESSIONAL'
  AND ov.scope_id = d.drop_id;

UPDATE app_v3.schedule_delays sd
SET scope_id = d.keep_id
FROM tmp_reservation_professional_dedup d
WHERE sd.scope_type = 'PROFESSIONAL'
  AND sd.scope_id = d.drop_id;

UPDATE app_v3.trainer_profiles tp
SET reservation_professional_id = d.keep_id
FROM tmp_reservation_professional_dedup d
WHERE tp.reservation_professional_id = d.drop_id;

DELETE FROM app_v3.reservation_professionals rp
USING tmp_reservation_professional_dedup d
WHERE rp.id = d.drop_id;

UPDATE app_v3.reservation_professionals rp
SET is_active = true,
    updated_at = now()
FROM app_v3.trainer_profiles tp
WHERE rp.organization_id = tp.organization_id
  AND rp.user_id = tp.user_id
  AND rp.is_active = false;

UPDATE app_v3.trainer_profiles tp
SET reservation_professional_id = rp.id,
    updated_at = now()
FROM app_v3.reservation_professionals rp
WHERE rp.organization_id = tp.organization_id
  AND rp.user_id = tp.user_id
  AND tp.user_id IS NOT NULL
  AND tp.reservation_professional_id IS DISTINCT FROM rp.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trainer_profiles_reservation_professional_id_fkey'
  ) THEN
    ALTER TABLE app_v3.trainer_profiles
      ADD CONSTRAINT trainer_profiles_reservation_professional_id_fkey
      FOREIGN KEY (reservation_professional_id)
      REFERENCES app_v3.reservation_professionals(id)
      ON DELETE SET NULL
      ON UPDATE NO ACTION;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS reservation_professionals_org_user_unique
  ON app_v3.reservation_professionals (organization_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS trainer_profiles_org_prof_unique
  ON app_v3.trainer_profiles (organization_id, reservation_professional_id);

CREATE INDEX IF NOT EXISTS trainer_profiles_professional_idx
  ON app_v3.trainer_profiles (reservation_professional_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'class_series_day_of_week_chk'
  ) THEN
    ALTER TABLE app_v3.class_series
      ADD CONSTRAINT class_series_day_of_week_chk
      CHECK (day_of_week >= 0 AND day_of_week <= 6);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'class_series_start_minute_chk'
  ) THEN
    ALTER TABLE app_v3.class_series
      ADD CONSTRAINT class_series_start_minute_chk
      CHECK (start_minute >= 0 AND start_minute < 1440);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'class_series_duration_minutes_chk'
  ) THEN
    ALTER TABLE app_v3.class_series
      ADD CONSTRAINT class_series_duration_minutes_chk
      CHECK (duration_minutes > 0 AND duration_minutes <= 240);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'class_series_capacity_chk'
  ) THEN
    ALTER TABLE app_v3.class_series
      ADD CONSTRAINT class_series_capacity_chk
      CHECK (capacity > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'class_series_validity_chk'
  ) THEN
    ALTER TABLE app_v3.class_series
      ADD CONSTRAINT class_series_validity_chk
      CHECK (valid_until IS NULL OR valid_until >= valid_from);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'class_sessions_interval_chk'
  ) THEN
    ALTER TABLE app_v3.class_sessions
      ADD CONSTRAINT class_sessions_interval_chk
      CHECK (ends_at > starts_at);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'class_sessions_capacity_chk'
  ) THEN
    ALTER TABLE app_v3.class_sessions
      ADD CONSTRAINT class_sessions_capacity_chk
      CHECK (capacity > 0);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS class_series_org_day_start_idx
  ON app_v3.class_series (organization_id, day_of_week, start_minute);

CREATE INDEX IF NOT EXISTS class_sessions_org_prof_start_idx
  ON app_v3.class_sessions (organization_id, professional_id, starts_at);

CREATE INDEX IF NOT EXISTS class_sessions_org_service_start_idx
  ON app_v3.class_sessions (organization_id, service_id, starts_at);

UPDATE app_v3.services s
SET kind = 'CLASS'
WHERE s.kind = 'GENERAL'
  AND upper(btrim(COALESCE(s.category_tag, ''))) = 'AULAS'
  AND (
    EXISTS (
      SELECT 1
      FROM app_v3.class_series cs
      WHERE cs.service_id = s.id
    )
    OR EXISTS (
      SELECT 1
      FROM app_v3.class_sessions cse
      WHERE cse.service_id = s.id
    )
  );
