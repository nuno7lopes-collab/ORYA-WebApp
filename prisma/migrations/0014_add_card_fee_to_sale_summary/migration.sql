ALTER TABLE app_v3.sale_summaries
  ADD COLUMN card_platform_fee_cents integer NOT NULL DEFAULT 0;

ALTER TABLE app_v3.sale_summaries
  ADD COLUMN payment_method text;
