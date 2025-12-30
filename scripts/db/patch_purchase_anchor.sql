DO $$
BEGIN
  CREATE TYPE app_v3."PaymentEventSource" AS ENUM ('WEBHOOK', 'JOB', 'API');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

ALTER TABLE app_v3.payment_events
  ADD COLUMN IF NOT EXISTS stripe_event_id text,
  ADD COLUMN IF NOT EXISTS purchase_id uuid,
  ADD COLUMN IF NOT EXISTS source app_v3."PaymentEventSource" NOT NULL DEFAULT 'WEBHOOK',
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS attempt integer NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS payment_events_stripe_event_id_key
  ON app_v3.payment_events(stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_events_purchase_id_key
  ON app_v3.payment_events(purchase_id)
  WHERE purchase_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_events_dedupe_key_idx
  ON app_v3.payment_events(dedupe_key);

ALTER TABLE app_v3.sale_summaries
  ADD COLUMN IF NOT EXISTS purchase_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS sale_summaries_purchase_id_key
  ON app_v3.sale_summaries(purchase_id)
  WHERE purchase_id IS NOT NULL;
