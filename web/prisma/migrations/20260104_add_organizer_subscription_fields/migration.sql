ALTER TABLE app_v3.organizers
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

CREATE INDEX IF NOT EXISTS organizers_stripe_customer_idx
  ON app_v3.organizers (stripe_customer_id);

CREATE INDEX IF NOT EXISTS organizers_stripe_subscription_idx
  ON app_v3.organizers (stripe_subscription_id);
