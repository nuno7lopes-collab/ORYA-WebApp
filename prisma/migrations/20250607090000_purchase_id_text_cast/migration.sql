-- Converte purchase_id para TEXT em todas as superfícies de ledger/operations/fulfillment
-- Necessário porque purchaseId é uma âncora externa (ex.: pur_xxx) que não é UUID.

ALTER TABLE app_v3.payment_events
  ALTER COLUMN purchase_id TYPE text USING purchase_id::text;

ALTER TABLE app_v3.sale_summaries
  ALTER COLUMN purchase_id TYPE text USING purchase_id::text;

ALTER TABLE app_v3.tickets
  ALTER COLUMN purchase_id TYPE text USING purchase_id::text;

ALTER TABLE app_v3.promo_redemptions
  ALTER COLUMN purchase_id TYPE text USING purchase_id::text;

-- Refresca unique para Prisma (create DB index if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'promo_redemptions_purchase_code_unique'
  ) THEN
    ALTER TABLE app_v3.promo_redemptions
      ADD CONSTRAINT promo_redemptions_purchase_code_unique UNIQUE (purchase_id, promo_code_id);
  END IF;
END$$;

ALTER TABLE app_v3.tournament_entries
  ALTER COLUMN purchase_id TYPE text USING purchase_id::text;

ALTER TABLE app_v3.operations
  ALTER COLUMN purchase_id TYPE text USING purchase_id::text;

ALTER TABLE app_v3.refunds
  ALTER COLUMN purchase_id TYPE text USING purchase_id::text;
