-- Align chat membership with ticket status (USED removed; consumption is metadata)
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

  v_is_active := NEW.status = 'ACTIVE';

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
