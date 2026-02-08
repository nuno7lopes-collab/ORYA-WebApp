ALTER TABLE "app_v3"."padel_event_category_links"
  ADD COLUMN IF NOT EXISTS "price_per_player_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR';
