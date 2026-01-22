ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION app_v3.chat_compute_status(
  open_at timestamptz,
  read_only_at timestamptz,
  close_at timestamptz
) RETURNS app_v3."ChatThreadStatus" AS $$
BEGIN
  IF now() < open_at THEN
    RETURN 'ANNOUNCEMENTS';
  ELSIF now() < read_only_at THEN
    RETURN 'OPEN';
  ELSIF now() < close_at THEN
    RETURN 'READ_ONLY';
  END IF;
  RETURN 'CLOSED';
END;
$$ LANGUAGE plpgsql STABLE
SET search_path = app_v3, public;

CREATE OR REPLACE FUNCTION app_v3.chat_add_member(
  thread_id uuid,
  user_id uuid,
  role app_v3."ChatMemberRole"
) RETURNS void AS $$
BEGIN
  INSERT INTO app_v3.chat_members (thread_id, user_id, role, joined_at)
  VALUES ($1, $2, $3, now())
  ON CONFLICT ON CONSTRAINT chat_members_thread_user_unique DO UPDATE
    SET role = EXCLUDED.role,
        left_at = NULL,
        updated_at = now()
  WHERE app_v3.chat_members.banned_at IS NULL;
END;
$$ LANGUAGE plpgsql
SET search_path = app_v3, public;

CREATE OR REPLACE FUNCTION app_v3.chat_ensure_event_thread(event_id integer)
RETURNS uuid AS $$
DECLARE
  v_event record;
  v_thread_id uuid;
  v_open timestamptz;
  v_read timestamptz;
  v_close timestamptz;
  v_delete timestamptz;
BEGIN
  SELECT id, organization_id, starts_at, ends_at
  INTO v_event
  FROM app_v3.events
  WHERE id = event_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_event.organization_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_open := v_event.starts_at;
  v_read := COALESCE(v_event.ends_at, v_event.starts_at);
  v_close := v_read + interval '24 hours';
  v_delete := v_close + interval '7 days';

  INSERT INTO app_v3.chat_threads (
    entity_type,
    entity_id,
    organization_id,
    open_at,
    read_only_at,
    close_at,
    delete_after,
    status
  ) VALUES (
    'EVENT',
    v_event.id,
    v_event.organization_id,
    v_open,
    v_read,
    v_close,
    v_delete,
    app_v3.chat_compute_status(v_open, v_read, v_close)
  )
  ON CONFLICT (entity_type, entity_id) DO UPDATE
    SET organization_id = EXCLUDED.organization_id,
        open_at = EXCLUDED.open_at,
        read_only_at = EXCLUDED.read_only_at,
        close_at = EXCLUDED.close_at,
        delete_after = EXCLUDED.delete_after,
        status = app_v3.chat_compute_status(EXCLUDED.open_at, EXCLUDED.read_only_at, EXCLUDED.close_at),
        updated_at = now()
  RETURNING id INTO v_thread_id;

  RETURN v_thread_id;
END;
$$ LANGUAGE plpgsql
SET search_path = app_v3, public;

CREATE OR REPLACE FUNCTION app_v3.chat_refresh_event_thread(event_id integer)
RETURNS void AS $$
DECLARE
  v_thread_id uuid;
BEGIN
  SELECT id INTO v_thread_id
  FROM app_v3.chat_threads
  WHERE entity_type = 'EVENT' AND entity_id = event_id;

  IF v_thread_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM app_v3.chat_ensure_event_thread(event_id);
END;
$$ LANGUAGE plpgsql
SET search_path = app_v3, public;

CREATE OR REPLACE FUNCTION app_v3.chat_ensure_booking_thread(booking_id integer)
RETURNS uuid AS $$
DECLARE
  v_booking record;
  v_thread_id uuid;
  v_open timestamptz;
  v_read timestamptz;
  v_close timestamptz;
  v_delete timestamptz;
BEGIN
  SELECT id, organization_id, starts_at, duration_minutes
  INTO v_booking
  FROM app_v3.bookings
  WHERE id = booking_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_open := now();
  v_read := v_booking.starts_at + make_interval(mins => v_booking.duration_minutes);
  v_close := v_read + interval '24 hours';
  v_delete := v_close + interval '7 days';

  INSERT INTO app_v3.chat_threads (
    entity_type,
    entity_id,
    organization_id,
    open_at,
    read_only_at,
    close_at,
    delete_after,
    status
  ) VALUES (
    'BOOKING',
    v_booking.id,
    v_booking.organization_id,
    v_open,
    v_read,
    v_close,
    v_delete,
    app_v3.chat_compute_status(v_open, v_read, v_close)
  )
  ON CONFLICT (entity_type, entity_id) DO UPDATE
    SET organization_id = EXCLUDED.organization_id,
        open_at = EXCLUDED.open_at,
        read_only_at = EXCLUDED.read_only_at,
        close_at = EXCLUDED.close_at,
        delete_after = EXCLUDED.delete_after,
        status = app_v3.chat_compute_status(EXCLUDED.open_at, EXCLUDED.read_only_at, EXCLUDED.close_at),
        updated_at = now()
  RETURNING id INTO v_thread_id;

  RETURN v_thread_id;
END;
$$ LANGUAGE plpgsql
SET search_path = app_v3, public;

CREATE OR REPLACE FUNCTION app_v3.chat_refresh_booking_thread(booking_id integer)
RETURNS void AS $$
DECLARE
  v_thread_id uuid;
  v_booking record;
  v_read timestamptz;
  v_close timestamptz;
  v_delete timestamptz;
BEGIN
  SELECT id INTO v_thread_id
  FROM app_v3.chat_threads
  WHERE entity_type = 'BOOKING' AND entity_id = booking_id;

  IF v_thread_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id, starts_at, duration_minutes
  INTO v_booking
  FROM app_v3.bookings
  WHERE id = booking_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_read := v_booking.starts_at + make_interval(mins => v_booking.duration_minutes);
  v_close := v_read + interval '24 hours';
  v_delete := v_close + interval '7 days';

  UPDATE app_v3.chat_threads
    SET read_only_at = v_read,
        close_at = v_close,
        delete_after = v_delete,
        status = app_v3.chat_compute_status(open_at, v_read, v_close),
        updated_at = now()
  WHERE id = v_thread_id;
END;
$$ LANGUAGE plpgsql
SET search_path = app_v3, public;

CREATE OR REPLACE FUNCTION app_v3.chat_handle_ticket_change()
RETURNS trigger AS $$
DECLARE
  v_user uuid;
  v_thread_id uuid;
  v_is_active boolean;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = OLD.status
     AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
     AND NEW.owner_user_id IS NOT DISTINCT FROM OLD.owner_user_id THEN
    RETURN NEW;
  END IF;

  v_user := COALESCE(NEW.owner_user_id, NEW.user_id);
  IF v_user IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_active := NEW.status IN ('ACTIVE', 'USED');

  IF v_is_active THEN
    v_thread_id := app_v3.chat_ensure_event_thread(NEW.event_id);
    IF v_thread_id IS NOT NULL THEN
      PERFORM app_v3.chat_add_member(v_thread_id, v_user, 'PARTICIPANT');
    END IF;
  ELSE
    SELECT id INTO v_thread_id
    FROM app_v3.chat_threads
    WHERE entity_type = 'EVENT' AND entity_id = NEW.event_id;

    IF v_thread_id IS NOT NULL THEN
      UPDATE app_v3.chat_members
        SET left_at = now(),
            updated_at = now()
      WHERE thread_id = v_thread_id
        AND user_id = v_user
        AND left_at IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = app_v3, public;

CREATE OR REPLACE FUNCTION app_v3.chat_handle_tournament_entry_change()
RETURNS trigger AS $$
DECLARE
  v_thread_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'CONFIRMED' THEN
    v_thread_id := app_v3.chat_ensure_event_thread(NEW.event_id);
    IF v_thread_id IS NOT NULL THEN
      PERFORM app_v3.chat_add_member(v_thread_id, NEW.user_id, 'PARTICIPANT');
    END IF;
  ELSIF NEW.status = 'CANCELLED' THEN
    SELECT id INTO v_thread_id
    FROM app_v3.chat_threads
    WHERE entity_type = 'EVENT' AND entity_id = NEW.event_id;

    IF v_thread_id IS NOT NULL THEN
      UPDATE app_v3.chat_members
        SET left_at = now(),
            updated_at = now()
      WHERE thread_id = v_thread_id
        AND user_id = NEW.user_id
        AND left_at IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = app_v3, public;

CREATE OR REPLACE FUNCTION app_v3.chat_handle_booking_change()
RETURNS trigger AS $$
DECLARE
  v_thread_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'CONFIRMED' THEN
    v_thread_id := app_v3.chat_ensure_booking_thread(NEW.id);
    IF v_thread_id IS NOT NULL THEN
      PERFORM app_v3.chat_add_member(v_thread_id, NEW.user_id, 'PARTICIPANT');
    END IF;
  ELSIF NEW.status IN ('CANCELLED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_ORG') THEN
    SELECT id INTO v_thread_id
    FROM app_v3.chat_threads
    WHERE entity_type = 'BOOKING' AND entity_id = NEW.id;

    IF v_thread_id IS NOT NULL THEN
      UPDATE app_v3.chat_members
        SET left_at = now(),
            updated_at = now()
      WHERE thread_id = v_thread_id
        AND user_id = NEW.user_id
        AND left_at IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = app_v3, public;

CREATE OR REPLACE FUNCTION app_v3.chat_handle_event_schedule_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.starts_at IS DISTINCT FROM OLD.starts_at
     OR NEW.ends_at IS DISTINCT FROM OLD.ends_at THEN
    PERFORM app_v3.chat_ensure_event_thread(NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = app_v3, public;

CREATE OR REPLACE FUNCTION app_v3.chat_handle_event_insert()
RETURNS trigger AS $$
BEGIN
  PERFORM app_v3.chat_ensure_event_thread(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = app_v3, public;

CREATE OR REPLACE FUNCTION app_v3.chat_handle_booking_schedule_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.starts_at IS DISTINCT FROM OLD.starts_at
     OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes THEN
    PERFORM app_v3.chat_refresh_booking_thread(NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = app_v3, public;
