-- FeeMode enum e coluna fee_mode em events
-- Cria o enum apenas se não existir (para evitar erro P3018 em reruns)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'FeeMode' AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE "app_v3"."FeeMode" AS ENUM ('ON_TOP', 'INCLUDED');
  ELSE
    -- Garantir que os valores necessários existem
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = 'FeeMode' AND n.nspname = 'app_v3' AND e.enumlabel = 'ON_TOP'
    ) THEN
      ALTER TYPE "app_v3"."FeeMode" ADD VALUE 'ON_TOP';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = 'FeeMode' AND n.nspname = 'app_v3' AND e.enumlabel = 'INCLUDED'
    ) THEN
      ALTER TYPE "app_v3"."FeeMode" ADD VALUE 'INCLUDED';
    END IF;
  END IF;
END $$;

-- Adiciona a coluna se não existir (sem default novo para evitar erro de enum)
ALTER TABLE "app_v3"."events"
ADD COLUMN IF NOT EXISTS "fee_mode" "app_v3"."FeeMode";

-- Se ficou a null, usar valor seguro existente
ALTER TABLE "app_v3"."events"
ALTER COLUMN "fee_mode" SET DEFAULT 'INCLUDED';

UPDATE "app_v3"."events"
SET "fee_mode" = COALESCE("fee_mode", 'INCLUDED');

ALTER TABLE "app_v3"."events"
ALTER COLUMN "fee_mode" SET NOT NULL;
