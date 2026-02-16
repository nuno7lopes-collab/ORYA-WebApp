-- Hard-cut estrutural: remove colunas legacy de live e elimina estado LIVE do lifecycle de torneios.

-- 1) Remover colunas legacy de live em eventos e categorias.
ALTER TABLE app_v3.events
  DROP COLUMN IF EXISTS live_visibility,
  DROP COLUMN IF EXISTS live_stream_url;

ALTER TABLE app_v3.padel_event_category_links
  DROP COLUMN IF EXISTS live_stream_url;

-- 2) Normalizar lifecycle e remover o estado LIVE do enum canónico.
-- Eventos que ainda estejam LIVE passam para LOCKED (operação em curso).
UPDATE app_v3.padel_tournament_configs
SET
  lifecycle_status = 'LOCKED'::app_v3."PadelTournamentLifecycleStatus",
  locked_at = COALESCE(locked_at, live_at)
WHERE lifecycle_status = 'LIVE'::app_v3."PadelTournamentLifecycleStatus";

ALTER TABLE app_v3.padel_tournament_configs
  ALTER COLUMN lifecycle_status DROP DEFAULT;

ALTER TYPE app_v3."PadelTournamentLifecycleStatus" RENAME TO "PadelTournamentLifecycleStatus_old";

CREATE TYPE app_v3."PadelTournamentLifecycleStatus" AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'LOCKED',
  'COMPLETED',
  'CANCELLED'
);

ALTER TABLE app_v3.padel_tournament_configs
  ALTER COLUMN lifecycle_status TYPE app_v3."PadelTournamentLifecycleStatus"
  USING (lifecycle_status::text::app_v3."PadelTournamentLifecycleStatus");

DROP TYPE app_v3."PadelTournamentLifecycleStatus_old";

ALTER TABLE app_v3.padel_tournament_configs
  ALTER COLUMN lifecycle_status SET DEFAULT 'DRAFT'::app_v3."PadelTournamentLifecycleStatus";

-- 3) Remover timestamp dedicado a LIVE (já sem estado LIVE no lifecycle).
ALTER TABLE app_v3.padel_tournament_configs
  DROP COLUMN IF EXISTS live_at;

-- 4) Remover enum órfão LiveVisibility se existir.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'LiveVisibility'
  ) THEN
    DROP TYPE app_v3."LiveVisibility";
  END IF;
END $$;
