-- Drop legacy Padel ticket linkage (Padel uses registrations + entitlements)
ALTER TABLE "app_v3"."padel_pairing_slots" DROP COLUMN IF EXISTS "ticket_id";
ALTER TABLE "app_v3"."padel_pairings" DROP COLUMN IF EXISTS "created_by_ticket_id";
ALTER TABLE "app_v3"."tickets" DROP COLUMN IF EXISTS "pairing_id";
ALTER TABLE "app_v3"."tickets" DROP COLUMN IF EXISTS "padel_split_share_cents";
ALTER TABLE "app_v3"."tickets" DROP COLUMN IF EXISTS "tournament_entry_id";
