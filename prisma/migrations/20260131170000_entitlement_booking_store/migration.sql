ALTER TYPE "app_v3"."entitlement_type" ADD VALUE IF NOT EXISTS 'SERVICE_BOOKING';
ALTER TYPE "app_v3"."entitlement_type" ADD VALUE IF NOT EXISTS 'STORE_ITEM';

ALTER TABLE "app_v3"."entitlements"
  ALTER COLUMN "sale_line_id" DROP NOT NULL;

ALTER TABLE "app_v3"."entitlements"
  ADD COLUMN IF NOT EXISTS "booking_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "store_order_line_id" INTEGER;

ALTER TABLE "app_v3"."entitlements"
  ADD CONSTRAINT "entitlements_booking_fkey" FOREIGN KEY ("booking_id") REFERENCES "app_v3"."bookings"("id") ON DELETE SET NULL;

ALTER TABLE "app_v3"."entitlements"
  ADD CONSTRAINT "entitlements_store_order_line_fkey" FOREIGN KEY ("store_order_line_id") REFERENCES "app_v3"."store_order_lines"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "entitlements_booking_idx" ON "app_v3"."entitlements" ("booking_id");
CREATE INDEX IF NOT EXISTS "entitlements_store_line_idx" ON "app_v3"."entitlements" ("store_order_line_id");

CREATE UNIQUE INDEX IF NOT EXISTS "entitlements_booking_owner_line_idx" ON "app_v3"."entitlements" ("booking_id", "line_item_index", "owner_key", "type");
CREATE UNIQUE INDEX IF NOT EXISTS "entitlements_store_line_owner_idx" ON "app_v3"."entitlements" ("store_order_line_id", "line_item_index", "owner_key", "type");
