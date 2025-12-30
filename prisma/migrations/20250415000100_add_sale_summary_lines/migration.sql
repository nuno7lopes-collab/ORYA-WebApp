-- Sale summaries (fonte de verdade por PaymentIntent) e linhas por bilhete

CREATE TABLE IF NOT EXISTS "app_v3"."sale_summaries" (
    "id" SERIAL PRIMARY KEY,
    "payment_intent_id" TEXT NOT NULL,
    "event_id" INTEGER NOT NULL,
    "user_id" UUID,
    "promo_code_id" INTEGER,
    "subtotal_cents" INTEGER NOT NULL,
    "discount_cents" INTEGER NOT NULL,
    "platform_fee_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "net_cents" INTEGER NOT NULL,
    "fee_mode" "app_v3"."FeeMode",
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "sale_summaries_payment_intent_id_key" UNIQUE ("payment_intent_id"),
    CONSTRAINT "sale_summaries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "app_v3"."events"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "sale_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_v3"."profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT "sale_summaries_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "app_v3"."promo_codes"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "sale_summaries_event_idx" ON "app_v3"."sale_summaries" ("event_id");
CREATE INDEX IF NOT EXISTS "sale_summaries_user_idx" ON "app_v3"."sale_summaries" ("user_id");
CREATE INDEX IF NOT EXISTS "sale_summaries_promo_idx" ON "app_v3"."sale_summaries" ("promo_code_id");

CREATE TABLE IF NOT EXISTS "app_v3"."sale_lines" (
    "id" SERIAL PRIMARY KEY,
    "sale_summary_id" INTEGER NOT NULL,
    "event_id" INTEGER NOT NULL,
    "ticket_type_id" INTEGER NOT NULL,
    "promo_code_id" INTEGER,
    "quantity" INTEGER NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,
    "discount_per_unit_cents" INTEGER NOT NULL DEFAULT 0,
    "gross_cents" INTEGER NOT NULL,
    "net_cents" INTEGER NOT NULL,
    "platform_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "sale_lines_summary_fkey" FOREIGN KEY ("sale_summary_id") REFERENCES "app_v3"."sale_summaries"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "sale_lines_event_fkey" FOREIGN KEY ("event_id") REFERENCES "app_v3"."events"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "sale_lines_ticket_type_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "app_v3"."ticket_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "sale_lines_promo_code_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "app_v3"."promo_codes"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "sale_lines_summary_idx" ON "app_v3"."sale_lines" ("sale_summary_id");
CREATE INDEX IF NOT EXISTS "sale_lines_event_idx" ON "app_v3"."sale_lines" ("event_id");
CREATE INDEX IF NOT EXISTS "sale_lines_ticket_type_idx" ON "app_v3"."sale_lines" ("ticket_type_id");
CREATE INDEX IF NOT EXISTS "sale_lines_promo_code_idx" ON "app_v3"."sale_lines" ("promo_code_id");
