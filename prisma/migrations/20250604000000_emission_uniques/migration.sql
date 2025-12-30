-- Add dedupe anchors to tickets
ALTER TABLE app_v3.tickets
  ADD COLUMN IF NOT EXISTS purchase_id uuid,
  ADD COLUMN IF NOT EXISTS sale_summary_id integer,
  ADD COLUMN IF NOT EXISTS emission_index integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS tickets_sale_summary_idx ON app_v3.tickets (sale_summary_id);

ALTER TABLE app_v3.tickets
  ADD CONSTRAINT tickets_purchase_ticket_idx UNIQUE (purchase_id, ticket_type_id, emission_index);

ALTER TABLE app_v3.tickets
  ADD CONSTRAINT tickets_sale_summary_fk FOREIGN KEY (sale_summary_id) REFERENCES app_v3.sale_summaries(id) ON DELETE SET NULL;

-- Add dedupe anchors to promo_redemptions
ALTER TABLE app_v3.promo_redemptions
  ADD COLUMN IF NOT EXISTS purchase_id uuid;

CREATE INDEX IF NOT EXISTS promo_redemptions_purchase_idx ON app_v3.promo_redemptions (purchase_id);

ALTER TABLE app_v3.promo_redemptions
  ADD CONSTRAINT promo_redemptions_purchase_code_unique UNIQUE (purchase_id, promo_code_id);

-- Add dedupe anchors to tournament_entries
ALTER TABLE app_v3.tournament_entries
  ADD COLUMN IF NOT EXISTS purchase_id uuid,
  ADD COLUMN IF NOT EXISTS sale_summary_id integer,
  ADD COLUMN IF NOT EXISTS emission_index integer NOT NULL DEFAULT 0;

ALTER TABLE app_v3.tournament_entries
  ADD CONSTRAINT tournament_entries_purchase_idx UNIQUE (purchase_id, emission_index);

ALTER TABLE app_v3.tournament_entries
  ADD CONSTRAINT tournament_entries_sale_summary_fk FOREIGN KEY (sale_summary_id) REFERENCES app_v3.sale_summaries(id) ON DELETE SET NULL;
