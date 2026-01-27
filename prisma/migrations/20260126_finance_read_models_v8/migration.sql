DO $$ BEGIN
  CREATE TYPE app_v3."SaleSummaryStatus" AS ENUM ('PAID','REFUNDED','DISPUTED','PARTIAL_REFUND','FAILED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS app_v3.sale_summaries (
  id serial PRIMARY KEY,
  event_id integer NOT NULL,
  user_id uuid,
  owner_user_id uuid,
  owner_identity_id uuid,
  purchase_id text UNIQUE,
  payment_intent_id text UNIQUE,
  promo_code_id integer,
  promo_code_snapshot text,
  promo_label_snapshot text,
  promo_type_snapshot app_v3."PromoType",
  promo_value_snapshot integer,
  subtotal_cents integer,
  discount_cents integer,
  platform_fee_cents integer,
  card_platform_fee_cents integer,
  stripe_fee_cents integer,
  total_cents integer,
  net_cents integer,
  fee_mode app_v3."FeeMode",
  payment_method text,
  currency text NOT NULL DEFAULT 'EUR',
  status app_v3."SaleSummaryStatus" NOT NULL DEFAULT 'PAID',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE app_v3.sale_summaries
    ADD CONSTRAINT sale_summaries_event_fk
    FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE app_v3.sale_summaries
    ADD CONSTRAINT sale_summaries_promo_fk
    FOREIGN KEY (promo_code_id) REFERENCES app_v3.promo_codes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS sale_summaries_event_idx
  ON app_v3.sale_summaries (event_id);

CREATE INDEX IF NOT EXISTS sale_summaries_status_idx
  ON app_v3.sale_summaries (status);

CREATE INDEX IF NOT EXISTS sale_summaries_promo_idx
  ON app_v3.sale_summaries (promo_code_id);

CREATE TABLE IF NOT EXISTS app_v3.sale_lines (
  id serial PRIMARY KEY,
  sale_summary_id integer NOT NULL,
  event_id integer NOT NULL,
  ticket_type_id integer NOT NULL,
  promo_code_id integer,
  promo_code_snapshot text,
  promo_label_snapshot text,
  promo_type_snapshot app_v3."PromoType",
  promo_value_snapshot integer,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_cents integer,
  discount_per_unit_cents integer,
  gross_cents integer,
  net_cents integer,
  platform_fee_cents integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE app_v3.sale_lines
    ADD CONSTRAINT sale_lines_summary_fk
    FOREIGN KEY (sale_summary_id) REFERENCES app_v3.sale_summaries(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE app_v3.sale_lines
    ADD CONSTRAINT sale_lines_event_fk
    FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE app_v3.sale_lines
    ADD CONSTRAINT sale_lines_ticket_type_fk
    FOREIGN KEY (ticket_type_id) REFERENCES app_v3.ticket_types(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE app_v3.sale_lines
    ADD CONSTRAINT sale_lines_promo_fk
    FOREIGN KEY (promo_code_id) REFERENCES app_v3.promo_codes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS sale_lines_summary_idx
  ON app_v3.sale_lines (sale_summary_id);

CREATE INDEX IF NOT EXISTS sale_lines_event_idx
  ON app_v3.sale_lines (event_id);

CREATE INDEX IF NOT EXISTS sale_lines_ticket_type_idx
  ON app_v3.sale_lines (ticket_type_id);

CREATE INDEX IF NOT EXISTS sale_lines_promo_idx
  ON app_v3.sale_lines (promo_code_id);

DO $$ BEGIN
  ALTER TABLE app_v3.tickets
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE app_v3.tickets
    ADD COLUMN IF NOT EXISTS sale_summary_id integer;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE app_v3.tickets
    ADD CONSTRAINT tickets_sale_summary_fk
    FOREIGN KEY (sale_summary_id) REFERENCES app_v3.sale_summaries(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS tickets_stripe_intent_idx
  ON app_v3.tickets (stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS tickets_sale_summary_idx
  ON app_v3.tickets (sale_summary_id);
