-- Tabela de settings simples (chave-valor)
CREATE TABLE IF NOT EXISTS "app_v3"."platform_settings" (
    "id" SERIAL PRIMARY KEY,
    "key" TEXT UNIQUE NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_settings_key_idx"
ON "app_v3"."platform_settings" ("key");
