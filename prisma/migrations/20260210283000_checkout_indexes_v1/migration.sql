CREATE INDEX IF NOT EXISTS "payments_org_source_idx"
ON "app_v3"."payments" ("organization_id", "source_type", "source_id");

CREATE INDEX IF NOT EXISTS "payment_snapshots_org_source_idx"
ON "app_v3"."payment_snapshots" ("organization_id", "source_type", "source_id");

CREATE INDEX IF NOT EXISTS "payment_events_purchase_intent_idx"
ON "app_v3"."payment_events" ("purchase_id", "stripe_payment_intent_id");
