DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'NotificationType' AND n.nspname = 'app_v3' AND e.enumlabel = 'CHAT_OPEN'
  ) THEN
    ALTER TYPE app_v3."NotificationType" ADD VALUE 'CHAT_OPEN';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'NotificationType' AND n.nspname = 'app_v3' AND e.enumlabel = 'CHAT_ANNOUNCEMENT'
  ) THEN
    ALTER TYPE app_v3."NotificationType" ADD VALUE 'CHAT_ANNOUNCEMENT';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ChatEntityType' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."ChatEntityType" AS ENUM ('EVENT', 'BOOKING');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ChatThreadStatus' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."ChatThreadStatus" AS ENUM ('ANNOUNCEMENTS', 'OPEN', 'READ_ONLY', 'CLOSED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ChatMemberRole' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."ChatMemberRole" AS ENUM ('PARTICIPANT', 'ORG', 'PLATFORM_ADMIN');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ChatMessageKind' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."ChatMessageKind" AS ENUM ('USER', 'ANNOUNCEMENT', 'SYSTEM');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_v3.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type app_v3."ChatEntityType" NOT NULL,
  entity_id integer NOT NULL,
  organization_id integer NOT NULL,
  open_at timestamptz NOT NULL,
  read_only_at timestamptz NOT NULL,
  close_at timestamptz NOT NULL,
  delete_after timestamptz NOT NULL,
  legal_hold_until timestamptz,
  open_notified_at timestamptz,
  status app_v3."ChatThreadStatus" NOT NULL DEFAULT 'ANNOUNCEMENTS',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_threads_organization_fk
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_threads_entity_unique
  ON app_v3.chat_threads (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS chat_threads_org_idx
  ON app_v3.chat_threads (organization_id);
CREATE INDEX IF NOT EXISTS chat_threads_status_idx
  ON app_v3.chat_threads (status);
CREATE INDEX IF NOT EXISTS chat_threads_open_idx
  ON app_v3.chat_threads (open_at);
CREATE INDEX IF NOT EXISTS chat_threads_close_idx
  ON app_v3.chat_threads (close_at);
CREATE INDEX IF NOT EXISTS chat_threads_delete_after_idx
  ON app_v3.chat_threads (delete_after);

CREATE TABLE IF NOT EXISTS app_v3.chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role app_v3."ChatMemberRole" NOT NULL DEFAULT 'PARTICIPANT',
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  muted_until timestamptz,
  banned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_members_thread_fk
    FOREIGN KEY (thread_id) REFERENCES app_v3.chat_threads(id) ON DELETE CASCADE,
  CONSTRAINT chat_members_user_fk
    FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_members_thread_user_unique
  ON app_v3.chat_members (thread_id, user_id);
CREATE INDEX IF NOT EXISTS chat_members_thread_idx
  ON app_v3.chat_members (thread_id);
CREATE INDEX IF NOT EXISTS chat_members_user_idx
  ON app_v3.chat_members (user_id);
CREATE INDEX IF NOT EXISTS chat_members_thread_active_idx
  ON app_v3.chat_members (thread_id, left_at);

CREATE TABLE IF NOT EXISTS app_v3.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  user_id uuid,
  kind app_v3."ChatMessageKind" NOT NULL DEFAULT 'USER',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid,
  CONSTRAINT chat_messages_thread_fk
    FOREIGN KEY (thread_id) REFERENCES app_v3.chat_threads(id) ON DELETE CASCADE,
  CONSTRAINT chat_messages_user_fk
    FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL,
  CONSTRAINT chat_messages_deleted_by_fk
    FOREIGN KEY (deleted_by) REFERENCES app_v3.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS chat_messages_thread_created_idx
  ON app_v3.chat_messages (thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_user_idx
  ON app_v3.chat_messages (user_id);

CREATE TABLE IF NOT EXISTS app_v3.chat_read_state (
  thread_id uuid NOT NULL,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_read_state_thread_fk
    FOREIGN KEY (thread_id) REFERENCES app_v3.chat_threads(id) ON DELETE CASCADE,
  CONSTRAINT chat_read_state_user_fk
    FOREIGN KEY (user_id) REFERENCES app_v3.profiles(id) ON DELETE CASCADE,
  CONSTRAINT chat_read_state_pkey PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS chat_read_state_user_idx
  ON app_v3.chat_read_state (user_id);

CREATE TABLE IF NOT EXISTS app_v3.chat_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  actor_user_id uuid,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_moderation_thread_fk
    FOREIGN KEY (thread_id) REFERENCES app_v3.chat_threads(id) ON DELETE CASCADE,
  CONSTRAINT chat_moderation_actor_fk
    FOREIGN KEY (actor_user_id) REFERENCES app_v3.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS chat_moderation_thread_idx
  ON app_v3.chat_moderation_log (thread_id);
CREATE INDEX IF NOT EXISTS chat_moderation_actor_idx
  ON app_v3.chat_moderation_log (actor_user_id);

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
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION app_v3.is_platform_admin(user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app_v3.profiles p
    WHERE p.id = user_id
      AND 'admin' = ANY (p.roles)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = app_v3, public;

CREATE OR REPLACE FUNCTION app_v3.chat_is_org_staff(org_id integer, user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app_v3.organization_members m
    WHERE m.organization_id = org_id
      AND m.user_id = user_id
      AND m.role IN ('OWNER', 'CO_OWNER', 'ADMIN', 'STAFF', 'TRAINER')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = app_v3, public;

CREATE OR REPLACE FUNCTION app_v3.chat_is_member(thread_id uuid, user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app_v3.chat_members m
    WHERE m.thread_id = thread_id
      AND m.user_id = user_id
      AND m.left_at IS NULL
      AND m.banned_at IS NULL
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = app_v3, public;

CREATE OR REPLACE FUNCTION app_v3.chat_is_org_actor(thread_id uuid, user_id uuid)
RETURNS boolean AS $$
DECLARE
  v_thread record;
  v_has_prof boolean;
BEGIN
  SELECT id, entity_type, entity_id, organization_id
  INTO v_thread
  FROM app_v3.chat_threads
  WHERE id = thread_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF app_v3.chat_is_org_staff(v_thread.organization_id, user_id) THEN
    RETURN true;
  END IF;

  IF v_thread.entity_type = 'BOOKING' THEN
    SELECT EXISTS (
      SELECT 1
      FROM app_v3.bookings b
      JOIN app_v3.reservation_professionals rp ON b.professional_id = rp.id
      WHERE b.id = v_thread.entity_id
        AND rp.user_id = user_id
    ) INTO v_has_prof;

    RETURN v_has_prof;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = app_v3, public;

CREATE OR REPLACE FUNCTION app_v3.chat_add_member(
  thread_id uuid,
  user_id uuid,
  role app_v3."ChatMemberRole"
) RETURNS void AS $$
BEGIN
  INSERT INTO app_v3.chat_members (thread_id, user_id, role, joined_at)
  VALUES (thread_id, user_id, role, now())
  ON CONFLICT (thread_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        left_at = NULL,
        updated_at = now()
  WHERE app_v3.chat_members.banned_at IS NULL;
END;
$$ LANGUAGE plpgsql;

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
$$ LANGUAGE plpgsql;

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
$$ LANGUAGE plpgsql;

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
$$ LANGUAGE plpgsql;

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
$$ LANGUAGE plpgsql;

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
$$ LANGUAGE plpgsql;

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
$$ LANGUAGE plpgsql;

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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION app_v3.chat_handle_event_schedule_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.starts_at IS DISTINCT FROM OLD.starts_at
     OR NEW.ends_at IS DISTINCT FROM OLD.ends_at THEN
    PERFORM app_v3.chat_ensure_event_thread(NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION app_v3.chat_handle_event_insert()
RETURNS trigger AS $$
BEGIN
  PERFORM app_v3.chat_ensure_event_thread(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION app_v3.chat_handle_booking_schedule_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.starts_at IS DISTINCT FROM OLD.starts_at
     OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes THEN
    PERFORM app_v3.chat_refresh_booking_thread(NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION app_v3.chat_notify_announcement()
RETURNS trigger AS $$
DECLARE
  v_thread record;
  v_event record;
BEGIN
  IF NEW.kind <> 'ANNOUNCEMENT' THEN
    RETURN NEW;
  END IF;

  SELECT id, entity_type, entity_id, organization_id
  INTO v_thread
  FROM app_v3.chat_threads
  WHERE id = NEW.thread_id;

  IF NOT FOUND OR v_thread.entity_type <> 'EVENT' THEN
    RETURN NEW;
  END IF;

  SELECT id, slug, title
  INTO v_event
  FROM app_v3.events
  WHERE id = v_thread.entity_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  INSERT INTO app_v3.notifications (
    user_id,
    type,
    title,
    body,
    organization_id,
    event_id,
    cta_url,
    created_at
  )
  SELECT
    m.user_id,
    'CHAT_ANNOUNCEMENT',
    'Anuncio do organizador',
    LEFT(NEW.body, 180),
    v_thread.organization_id,
    v_event.id,
    '/eventos/' || v_event.slug || '/live',
    now()
  FROM app_v3.chat_members m
  LEFT JOIN app_v3.notification_preferences p
    ON p.user_id = m.user_id
  WHERE m.thread_id = NEW.thread_id
    AND m.left_at IS NULL
    AND m.user_id IS NOT NULL
    AND (NEW.user_id IS NULL OR m.user_id <> NEW.user_id)
    AND COALESCE(p.allow_system_announcements, true) = true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = app_v3, public;

DROP TRIGGER IF EXISTS chat_ticket_sync ON app_v3.tickets;
CREATE TRIGGER chat_ticket_sync
  AFTER INSERT OR UPDATE OF status, user_id, owner_user_id ON app_v3.tickets
  FOR EACH ROW EXECUTE FUNCTION app_v3.chat_handle_ticket_change();

DROP TRIGGER IF EXISTS chat_tournament_entry_sync ON app_v3.tournament_entries;
CREATE TRIGGER chat_tournament_entry_sync
  AFTER INSERT OR UPDATE OF status, user_id ON app_v3.tournament_entries
  FOR EACH ROW EXECUTE FUNCTION app_v3.chat_handle_tournament_entry_change();

DROP TRIGGER IF EXISTS chat_booking_sync ON app_v3.bookings;
CREATE TRIGGER chat_booking_sync
  AFTER INSERT OR UPDATE OF status, user_id ON app_v3.bookings
  FOR EACH ROW EXECUTE FUNCTION app_v3.chat_handle_booking_change();

DROP TRIGGER IF EXISTS chat_event_schedule_sync ON app_v3.events;
CREATE TRIGGER chat_event_schedule_sync
  AFTER UPDATE OF starts_at, ends_at ON app_v3.events
  FOR EACH ROW EXECUTE FUNCTION app_v3.chat_handle_event_schedule_update();

DROP TRIGGER IF EXISTS chat_event_insert_sync ON app_v3.events;
CREATE TRIGGER chat_event_insert_sync
  AFTER INSERT ON app_v3.events
  FOR EACH ROW EXECUTE FUNCTION app_v3.chat_handle_event_insert();

DROP TRIGGER IF EXISTS chat_booking_schedule_sync ON app_v3.bookings;
CREATE TRIGGER chat_booking_schedule_sync
  AFTER UPDATE OF starts_at, duration_minutes ON app_v3.bookings
  FOR EACH ROW EXECUTE FUNCTION app_v3.chat_handle_booking_schedule_update();

DROP TRIGGER IF EXISTS chat_notify_announcement_trigger ON app_v3.chat_messages;
CREATE TRIGGER chat_notify_announcement_trigger
  AFTER INSERT ON app_v3.chat_messages
  FOR EACH ROW EXECUTE FUNCTION app_v3.chat_notify_announcement();

ALTER TABLE app_v3.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_v3.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_v3.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_v3.chat_read_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_v3.chat_moderation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_threads_select_participants ON app_v3.chat_threads
  FOR SELECT TO authenticated
  USING (
    app_v3.chat_is_member(id, auth.uid())
    AND status <> 'CLOSED'
  );

CREATE POLICY chat_threads_select_org ON app_v3.chat_threads
  FOR SELECT TO authenticated
  USING (
    app_v3.chat_is_org_actor(id, auth.uid())
    OR app_v3.is_platform_admin(auth.uid())
  );

CREATE POLICY chat_threads_select_service_role ON app_v3.chat_threads
  FOR SELECT TO service_role
  USING (true);

CREATE POLICY chat_threads_update_platform ON app_v3.chat_threads
  FOR UPDATE TO authenticated
  USING (app_v3.is_platform_admin(auth.uid()))
  WITH CHECK (app_v3.is_platform_admin(auth.uid()));

CREATE POLICY chat_members_select_self ON app_v3.chat_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR app_v3.chat_is_org_actor(thread_id, auth.uid())
    OR app_v3.is_platform_admin(auth.uid())
  );

CREATE POLICY chat_members_service_role ON app_v3.chat_members
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY chat_messages_select ON app_v3.chat_messages
  FOR SELECT TO authenticated
  USING (
    app_v3.is_platform_admin(auth.uid())
    OR app_v3.chat_is_org_actor(thread_id, auth.uid())
    OR (
      app_v3.chat_is_member(thread_id, auth.uid())
      AND EXISTS (
        SELECT 1 FROM app_v3.chat_threads t
        WHERE t.id = chat_messages.thread_id
          AND t.status <> 'CLOSED'
      )
    )
  );

CREATE POLICY chat_messages_insert_participant ON app_v3.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    kind = 'USER'
    AND user_id = auth.uid()
    AND app_v3.chat_is_member(thread_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM app_v3.chat_threads t
      WHERE t.id = chat_messages.thread_id
        AND t.status = 'OPEN'
    )
    AND NOT EXISTS (
      SELECT 1 FROM app_v3.chat_members m
      WHERE m.thread_id = chat_messages.thread_id
        AND m.user_id = auth.uid()
        AND m.muted_until IS NOT NULL
        AND m.muted_until > now()
    )
  );

CREATE POLICY chat_messages_insert_org_open ON app_v3.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND app_v3.chat_is_org_actor(thread_id, auth.uid())
    AND kind IN ('USER', 'ANNOUNCEMENT')
    AND EXISTS (
      SELECT 1 FROM app_v3.chat_threads t
      WHERE t.id = chat_messages.thread_id
        AND t.status = 'OPEN'
    )
  );

CREATE POLICY chat_messages_insert_org_announcements ON app_v3.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND app_v3.chat_is_org_actor(thread_id, auth.uid())
    AND kind = 'ANNOUNCEMENT'
    AND EXISTS (
      SELECT 1 FROM app_v3.chat_threads t
      WHERE t.id = chat_messages.thread_id
        AND t.status = 'ANNOUNCEMENTS'
    )
  );

CREATE POLICY chat_messages_update_platform ON app_v3.chat_messages
  FOR UPDATE TO authenticated
  USING (app_v3.is_platform_admin(auth.uid()))
  WITH CHECK (app_v3.is_platform_admin(auth.uid()));

CREATE POLICY chat_messages_service_role ON app_v3.chat_messages
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY chat_read_state_self ON app_v3.chat_read_state
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND (
      app_v3.chat_is_member(thread_id, auth.uid())
      OR app_v3.chat_is_org_actor(thread_id, auth.uid())
      OR app_v3.is_platform_admin(auth.uid())
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (
      app_v3.chat_is_member(thread_id, auth.uid())
      OR app_v3.chat_is_org_actor(thread_id, auth.uid())
      OR app_v3.is_platform_admin(auth.uid())
    )
  );

CREATE POLICY chat_read_state_service_role ON app_v3.chat_read_state
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY chat_moderation_select_org ON app_v3.chat_moderation_log
  FOR SELECT TO authenticated
  USING (
    app_v3.chat_is_org_actor(thread_id, auth.uid())
    OR app_v3.is_platform_admin(auth.uid())
  );

CREATE POLICY chat_moderation_service_role ON app_v3.chat_moderation_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
