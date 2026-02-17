BEGIN;

-- Remove legacy chat triggers still attached to runtime tables.
DROP TRIGGER IF EXISTS chat_event_insert_sync ON app_v3.events;
DROP TRIGGER IF EXISTS chat_event_schedule_sync ON app_v3.events;
DROP TRIGGER IF EXISTS chat_booking_schedule_sync ON app_v3.bookings;
DROP TRIGGER IF EXISTS chat_notify_announcement_trigger ON app_v3.chat_messages;

-- Remove legacy chat helper functions/triggers implementation.
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'app_v3'
      AND p.proname = ANY (
        ARRAY[
          'chat_add_member',
          'chat_compute_status',
          'chat_ensure_booking_thread',
          'chat_ensure_event_thread',
          'chat_handle_booking_change',
          'chat_handle_booking_schedule_update',
          'chat_handle_event_insert',
          'chat_handle_event_schedule_update',
          'chat_handle_ticket_change',
          'chat_handle_tournament_entry_change',
          'chat_is_member',
          'chat_is_org_actor',
          'chat_is_org_staff',
          'chat_notify_announcement',
          'chat_refresh_booking_thread',
          'chat_refresh_event_thread'
        ]::text[]
      )
  LOOP
    EXECUTE format(
      'DROP FUNCTION IF EXISTS app_v3.%I(%s) CASCADE',
      fn.proname,
      pg_get_function_identity_arguments(fn.oid)
    );
  END LOOP;
END $$;

-- Hard cut of legacy chat persistence objects.
DROP TABLE IF EXISTS app_v3.chat_event_invites CASCADE;
DROP TABLE IF EXISTS app_v3.chat_invites CASCADE;
DROP TABLE IF EXISTS app_v3.chat_moderation_log CASCADE;
DROP TABLE IF EXISTS app_v3.chat_read_state CASCADE;
DROP TABLE IF EXISTS app_v3.chat_messages CASCADE;
DROP TABLE IF EXISTS app_v3.chat_members CASCADE;
DROP TABLE IF EXISTS app_v3.chat_threads CASCADE;
DROP TABLE IF EXISTS app_v3.chat_conversation_requests CASCADE;
DROP TABLE IF EXISTS app_v3.chat_channel_requests CASCADE;

-- Remove legacy geo/access/fee columns still present outside canonical Prisma contract.
ALTER TABLE app_v3.events
  DROP COLUMN IF EXISTS lat,
  DROP COLUMN IF EXISTS lng,
  DROP COLUMN IF EXISTS location_name,
  DROP COLUMN IF EXISTS location_city,
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS location_source,
  DROP COLUMN IF EXISTS location_provider_id,
  DROP COLUMN IF EXISTS location_formatted_address,
  DROP COLUMN IF EXISTS location_components,
  DROP COLUMN IF EXISTS location_overrides,
  DROP COLUMN IF EXISTS is_free,
  DROP COLUMN IF EXISTS invite_only,
  DROP COLUMN IF EXISTS public_access_mode,
  DROP COLUMN IF EXISTS participant_access_mode,
  DROP COLUMN IF EXISTS public_ticket_type_ids,
  DROP COLUMN IF EXISTS participant_ticket_type_ids,
  DROP COLUMN IF EXISTS fee_mode_override,
  DROP COLUMN IF EXISTS platform_fee_bps_override,
  DROP COLUMN IF EXISTS platform_fee_fixed_cents_override;

ALTER TABLE app_v3.search_index_items
  DROP COLUMN IF EXISTS location_formatted_address,
  DROP COLUMN IF EXISTS lat,
  DROP COLUMN IF EXISTS lng,
  DROP COLUMN IF EXISTS location_source,
  DROP COLUMN IF EXISTS location_name,
  DROP COLUMN IF EXISTS location_city,
  DROP COLUMN IF EXISTS address;

ALTER TABLE app_v3.organizations
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS live_hub_premium_enabled,
  DROP COLUMN IF EXISTS padel_default_city,
  DROP COLUMN IF EXISTS padel_default_address,
  DROP COLUMN IF EXISTS address;

ALTER TABLE app_v3.profiles
  DROP COLUMN IF EXISTS city;

ALTER TABLE app_v3.padel_clubs
  DROP COLUMN IF EXISTS lat,
  DROP COLUMN IF EXISTS lng;

ALTER TABLE app_v3.services
  DROP COLUMN IF EXISTS default_location_text,
  DROP COLUMN IF EXISTS required_membership_plan_ids;

-- Drop orphan enum types tied only to removed legacy chat tables.
DROP TYPE IF EXISTS app_v3."ChatEntityType";
DROP TYPE IF EXISTS app_v3."ChatThreadStatus";
DROP TYPE IF EXISTS app_v3."ChatMemberRole";
DROP TYPE IF EXISTS app_v3."ChatMessageKind";
DROP TYPE IF EXISTS app_v3."ChatInviteStatus";
DROP TYPE IF EXISTS app_v3."ChatEventInviteStatus";
DROP TYPE IF EXISTS app_v3."ChatConversationRequestStatus";
DROP TYPE IF EXISTS app_v3."ChatChannelRequestStatus";

COMMIT;
