DO $$
BEGIN
  ALTER TABLE app_v3.sale_summaries
    ADD COLUMN IF NOT EXISTS promo_code_snapshot text NULL,
    ADD COLUMN IF NOT EXISTS promo_label_snapshot text NULL,
    ADD COLUMN IF NOT EXISTS promo_type_snapshot app_v3."PromoType" NULL,
    ADD COLUMN IF NOT EXISTS promo_value_snapshot integer NULL;
EXCEPTION WHEN undefined_object THEN
  -- Se o enum ainda não existir, criamos como text (fallback)
  ALTER TABLE app_v3.sale_summaries
    ADD COLUMN IF NOT EXISTS promo_code_snapshot text NULL,
    ADD COLUMN IF NOT EXISTS promo_label_snapshot text NULL,
    ADD COLUMN IF NOT EXISTS promo_type_snapshot text NULL,
    ADD COLUMN IF NOT EXISTS promo_value_snapshot integer NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE app_v3.sale_lines
    ADD COLUMN IF NOT EXISTS promo_code_snapshot text NULL,
    ADD COLUMN IF NOT EXISTS promo_label_snapshot text NULL,
    ADD COLUMN IF NOT EXISTS promo_type_snapshot app_v3."PromoType" NULL,
    ADD COLUMN IF NOT EXISTS promo_value_snapshot integer NULL;
EXCEPTION WHEN undefined_object THEN
  ALTER TABLE app_v3.sale_lines
    ADD COLUMN IF NOT EXISTS promo_code_snapshot text NULL,
    ADD COLUMN IF NOT EXISTS promo_label_snapshot text NULL,
    ADD COLUMN IF NOT EXISTS promo_type_snapshot text NULL,
    ADD COLUMN IF NOT EXISTS promo_value_snapshot integer NULL;
END $$;
