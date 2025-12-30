-- Fase 4: estrutura base de torneios (Tournament/Stage/Group/Match)
-- Apenas operações aditivas (sem DROP/RENAME destrutivo).

SET search_path TO app_v3, public;

-- Enums
CREATE TYPE app_v3."TournamentFormat" AS ENUM (
  'GROUPS_PLUS_PLAYOFF',
  'DRAW_A_B',
  'GROUPS_PLUS_FINALS_ALL_PLACES',
  'CHAMPIONSHIP_ROUND_ROBIN',
  'NONSTOP_ROUND_ROBIN',
  'MANUAL'
);

CREATE TYPE app_v3."TournamentStageType" AS ENUM (
  'GROUPS',
  'PLAYOFF',
  'CONSOLATION',
  'NONSTOP'
);

CREATE TYPE app_v3."TournamentMatchStatus" AS ENUM (
  'PENDING',
  'SCHEDULED',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED'
);

-- Table: tournaments
CREATE TABLE app_v3."tournaments" (
  "id" SERIAL PRIMARY KEY,
  "event_id" INTEGER NOT NULL UNIQUE,
  "format" app_v3."TournamentFormat" NOT NULL,
  "generation_seed" TEXT,
  "inscription_deadline_at" TIMESTAMPTZ(6),
  "tie_break_rules" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "config" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tournaments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES app_v3."events"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Table: tournament_stages
CREATE TABLE app_v3."tournament_stages" (
  "id" SERIAL PRIMARY KEY,
  "tournament_id" INTEGER NOT NULL,
  "name" TEXT,
  "stage_type" app_v3."TournamentStageType" NOT NULL DEFAULT 'GROUPS',
  "order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tournament_stages_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES app_v3."tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "tournament_stages_tournament_id_idx" ON app_v3."tournament_stages"("tournament_id");

-- Table: tournament_groups
CREATE TABLE app_v3."tournament_groups" (
  "id" SERIAL PRIMARY KEY,
  "stage_id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tournament_groups_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES app_v3."tournament_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "tournament_groups_stage_id_idx" ON app_v3."tournament_groups"("stage_id");

-- Table: tournament_matches
CREATE TABLE app_v3."tournament_matches" (
  "id" SERIAL PRIMARY KEY,
  "stage_id" INTEGER NOT NULL,
  "group_id" INTEGER,
  "pairing1_id" INTEGER,
  "pairing2_id" INTEGER,
  "round_number" INTEGER,
  "round_label" TEXT,
  "next_match_id" INTEGER,
  "next_slot" INTEGER,
  "court_id" INTEGER,
  "start_at" TIMESTAMPTZ(6),
  "score" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status" app_v3."TournamentMatchStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tournament_matches_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES app_v3."tournament_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tournament_matches_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES app_v3."tournament_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "tournament_matches_stage_id_idx" ON app_v3."tournament_matches"("stage_id");
CREATE INDEX "tournament_matches_group_id_idx" ON app_v3."tournament_matches"("group_id");
