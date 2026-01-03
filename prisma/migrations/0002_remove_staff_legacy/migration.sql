-- Remove legacy staff assignments and staff notification types.

UPDATE "app_v3"."notifications"
SET "type" = 'ORGANIZATION_INVITE'
WHERE "type" IN ('STAFF_INVITE', 'STAFF_ROLE_CHANGE');

ALTER TYPE "app_v3"."NotificationType" RENAME TO "NotificationType_old";

CREATE TYPE "app_v3"."NotificationType" AS ENUM (
  'ORGANIZATION_INVITE',
  'ORGANIZATION_TRANSFER',
  'EVENT_SALE',
  'EVENT_PAYOUT_STATUS',
  'STRIPE_STATUS',
  'FRIEND_REQUEST',
  'FRIEND_ACCEPT',
  'EVENT_REMINDER',
  'CHECKIN_READY',
  'TICKET_SHARED',
  'MARKETING_PROMO_ALERT',
  'SYSTEM_ANNOUNCE',
  'FOLLOWED_YOU',
  'TICKET_TRANSFER_RECEIVED',
  'TICKET_TRANSFER_ACCEPTED',
  'TICKET_TRANSFER_DECLINED',
  'CLUB_INVITE',
  'NEW_EVENT_FROM_FOLLOWED_ORGANIZATION'
);

ALTER TABLE "app_v3"."notifications"
  ALTER COLUMN "type" TYPE "app_v3"."NotificationType"
  USING ("type"::text::"app_v3"."NotificationType");

DROP TYPE "app_v3"."NotificationType_old";

DROP TABLE IF EXISTS "app_v3"."staff_assignments" CASCADE;
DROP TYPE IF EXISTS "app_v3"."StaffScope";
DROP TYPE IF EXISTS "app_v3"."StaffRole";
DROP TYPE IF EXISTS "app_v3"."StaffStatus";
