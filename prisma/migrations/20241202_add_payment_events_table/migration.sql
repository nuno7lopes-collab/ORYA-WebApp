-- Criação defensiva da tabela payment_events (caso ainda não exista)
CREATE TABLE IF NOT EXISTS "app_v3"."payment_events" (
    "id" SERIAL PRIMARY KEY,
    "stripe_payment_intent_id" TEXT,
    "status" TEXT,
    "event_id" INTEGER,
    "amount_cents" INTEGER,
    "platform_fee_cents" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "payment_events_stripe_payment_intent_id_idx"
ON "app_v3"."payment_events" ("stripe_payment_intent_id");

CREATE INDEX IF NOT EXISTS "payment_events_event_id_idx"
ON "app_v3"."payment_events" ("event_id");
