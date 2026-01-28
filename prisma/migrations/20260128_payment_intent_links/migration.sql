ALTER TABLE app_v3.payment_events
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

CREATE INDEX IF NOT EXISTS payment_events_stripe_intent_idx
  ON app_v3.payment_events (stripe_payment_intent_id);

ALTER TABLE app_v3.transactions
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

CREATE INDEX IF NOT EXISTS transactions_stripe_intent_idx
  ON app_v3.transactions (stripe_payment_intent_id);
