-- Remove legacy TicketStatus.USED (consumption is tracked via EntitlementCheckin)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'TicketStatus'
  ) THEN
    DROP TRIGGER IF EXISTS chat_ticket_sync ON app_v3.tickets;

    CREATE TYPE "app_v3"."TicketStatus_new" AS ENUM (
      'ACTIVE',
      'REFUNDED',
      'TRANSFERRED',
      'RESALE_LISTED',
      'DISPUTED',
      'CANCELLED'
    );

    ALTER TABLE "app_v3"."tickets"
      ALTER COLUMN "status" DROP DEFAULT;

    ALTER TABLE "app_v3"."tickets"
      ALTER COLUMN "status" TYPE "app_v3"."TicketStatus_new"
      USING (
        CASE
          WHEN "status"::text = 'USED' THEN 'ACTIVE'
          ELSE "status"::text
        END
      )::"app_v3"."TicketStatus_new";

    ALTER TABLE "app_v3"."tickets"
      ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

    DROP TYPE "app_v3"."TicketStatus";
    ALTER TYPE "app_v3"."TicketStatus_new" RENAME TO "TicketStatus";

    CREATE TRIGGER chat_ticket_sync
      AFTER INSERT OR UPDATE OF status, user_id, owner_user_id ON app_v3.tickets
      FOR EACH ROW EXECUTE FUNCTION app_v3.chat_handle_ticket_change();
  END IF;
END $$;
