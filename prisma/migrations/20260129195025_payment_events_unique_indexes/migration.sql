-- Ensure payment_events unique indexes match Prisma schema (no partial indexes)

DROP INDEX IF EXISTS app_v3.payment_events_purchase_id_key;
DROP INDEX IF EXISTS app_v3.payment_events_stripe_event_id_key;
DROP INDEX IF EXISTS app_v3.payment_events_stripe_intent_idx;

CREATE UNIQUE INDEX payment_events_purchase_id_key ON app_v3.payment_events (purchase_id);
CREATE UNIQUE INDEX payment_events_stripe_event_id_key ON app_v3.payment_events (stripe_event_id);
CREATE UNIQUE INDEX payment_events_stripe_payment_intent_id_key ON app_v3.payment_events (stripe_payment_intent_id);
