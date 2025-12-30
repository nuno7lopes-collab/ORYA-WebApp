-- Add Stripe fee storage to sale summaries and payment events (explicit, not estimated)
ALTER TABLE "app_v3"."sale_summaries" ADD COLUMN IF NOT EXISTS "stripe_fee_cents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "app_v3"."payment_events" ADD COLUMN IF NOT EXISTS "stripe_fee_cents" INTEGER;
