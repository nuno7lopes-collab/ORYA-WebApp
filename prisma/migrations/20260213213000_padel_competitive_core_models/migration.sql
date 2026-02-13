-- Padel competitive core models: participants, rounds and match participants

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PadelTournamentParticipantStatus'
      AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."PadelTournamentParticipantStatus" AS ENUM (
      'ACTIVE',
      'INACTIVE',
      'WITHDRAWN'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PadelRoundPhase'
      AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."PadelRoundPhase" AS ENUM (
      'GROUPS',
      'PLAYOFF',
      'NON_STOP',
      'ROUND_ROBIN'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PadelRoundState'
      AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."PadelRoundState" AS ENUM (
      'PENDING',
      'LIVE',
      'CLOSED',
      'CANCELLED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PadelRoundTimerState'
      AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."PadelRoundTimerState" AS ENUM (
      'IDLE',
      'RUNNING',
      'STOPPED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PadelMatchSide'
      AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."PadelMatchSide" AS ENUM (
      'A',
      'B'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PadelScoreMode'
      AND n.nspname = 'app_v3'
  ) THEN
    CREATE TYPE app_v3."PadelScoreMode" AS ENUM (
      'SETS',
      'TIMED_GAMES'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_v3.padel_tournament_participants (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  event_id INT NOT NULL,
  category_id INT,
  organization_id INT NOT NULL,
  player_profile_id INT NOT NULL,
  source_pairing_id INT,
  status app_v3."PadelTournamentParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
  seed_rank INT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT padel_tournament_participants_event_fk
    FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE,
  CONSTRAINT padel_tournament_participants_category_fk
    FOREIGN KEY (category_id) REFERENCES app_v3.padel_categories(id) ON DELETE SET NULL,
  CONSTRAINT padel_tournament_participants_org_fk
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT padel_tournament_participants_player_profile_fk
    FOREIGN KEY (player_profile_id) REFERENCES app_v3.padel_player_profiles(id) ON DELETE CASCADE,
  CONSTRAINT padel_tournament_participants_source_pairing_fk
    FOREIGN KEY (source_pairing_id) REFERENCES app_v3.padel_pairings(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS padel_tournament_participants_event_category_player_uq
  ON app_v3.padel_tournament_participants (event_id, category_id, player_profile_id);
CREATE INDEX IF NOT EXISTS padel_tournament_participants_event_category_idx
  ON app_v3.padel_tournament_participants (event_id, category_id);
CREATE INDEX IF NOT EXISTS padel_tournament_participants_org_idx
  ON app_v3.padel_tournament_participants (organization_id);
CREATE INDEX IF NOT EXISTS padel_tournament_participants_status_idx
  ON app_v3.padel_tournament_participants (status);
CREATE INDEX IF NOT EXISTS padel_tournament_participants_source_pairing_idx
  ON app_v3.padel_tournament_participants (source_pairing_id);

CREATE TABLE IF NOT EXISTS app_v3.padel_rounds (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  event_id INT NOT NULL,
  category_id INT,
  organization_id INT NOT NULL,
  round_key TEXT NOT NULL,
  phase app_v3."PadelRoundPhase" NOT NULL,
  round_number INT NOT NULL DEFAULT 1,
  group_label TEXT,
  state app_v3."PadelRoundState" NOT NULL DEFAULT 'PENDING',
  score_mode app_v3."PadelScoreMode" NOT NULL DEFAULT 'SETS',
  duration_seconds INT,
  starts_at TIMESTAMPTZ(6),
  ends_at TIMESTAMPTZ(6),
  timer_state app_v3."PadelRoundTimerState" NOT NULL DEFAULT 'IDLE',
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT padel_rounds_event_fk
    FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE,
  CONSTRAINT padel_rounds_category_fk
    FOREIGN KEY (category_id) REFERENCES app_v3.padel_categories(id) ON DELETE SET NULL,
  CONSTRAINT padel_rounds_org_fk
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS padel_rounds_round_key_uq
  ON app_v3.padel_rounds (round_key);
CREATE INDEX IF NOT EXISTS padel_rounds_event_category_idx
  ON app_v3.padel_rounds (event_id, category_id);
CREATE INDEX IF NOT EXISTS padel_rounds_phase_round_number_idx
  ON app_v3.padel_rounds (phase, round_number);
CREATE INDEX IF NOT EXISTS padel_rounds_state_idx
  ON app_v3.padel_rounds (state);

CREATE TABLE IF NOT EXISTS app_v3.padel_match_participants (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  match_id INT NOT NULL,
  participant_id INT NOT NULL,
  side app_v3."PadelMatchSide" NOT NULL,
  slot_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT padel_match_participants_match_fk
    FOREIGN KEY (match_id) REFERENCES app_v3.padel_matches(id) ON DELETE CASCADE,
  CONSTRAINT padel_match_participants_participant_fk
    FOREIGN KEY (participant_id) REFERENCES app_v3.padel_tournament_participants(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS padel_match_participants_match_participant_uq
  ON app_v3.padel_match_participants (match_id, participant_id);
CREATE INDEX IF NOT EXISTS padel_match_participants_match_side_idx
  ON app_v3.padel_match_participants (match_id, side);
CREATE INDEX IF NOT EXISTS padel_match_participants_participant_idx
  ON app_v3.padel_match_participants (participant_id);

ALTER TABLE app_v3.padel_matches
  ADD COLUMN IF NOT EXISTS round_id INT,
  ADD COLUMN IF NOT EXISTS winner_participant_id INT,
  ADD COLUMN IF NOT EXISTS score_mode app_v3."PadelScoreMode";

UPDATE app_v3.padel_matches
SET score_mode = COALESCE(score_mode, 'SETS'::app_v3."PadelScoreMode");

ALTER TABLE app_v3.padel_matches
  ALTER COLUMN score_mode SET DEFAULT 'SETS'::app_v3."PadelScoreMode",
  ALTER COLUMN score_mode SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.conname = 'padel_matches_round_fk'
      AND n.nspname = 'app_v3'
  ) THEN
    ALTER TABLE app_v3.padel_matches
      ADD CONSTRAINT padel_matches_round_fk
      FOREIGN KEY (round_id) REFERENCES app_v3.padel_rounds(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.conname = 'padel_matches_winner_participant_fk'
      AND n.nspname = 'app_v3'
  ) THEN
    ALTER TABLE app_v3.padel_matches
      ADD CONSTRAINT padel_matches_winner_participant_fk
      FOREIGN KEY (winner_participant_id) REFERENCES app_v3.padel_tournament_participants(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS padel_matches_round_idx
  ON app_v3.padel_matches (round_id);
CREATE INDEX IF NOT EXISTS padel_matches_winner_participant_idx
  ON app_v3.padel_matches (winner_participant_id);

-- Backfill histórico para o novo core competitivo
INSERT INTO app_v3.padel_tournament_participants (
  event_id,
  category_id,
  organization_id,
  player_profile_id,
  source_pairing_id,
  status
)
SELECT DISTINCT
  p.event_id,
  p.category_id,
  p.organization_id,
  s.player_profile_id,
  p.id,
  'ACTIVE'::app_v3."PadelTournamentParticipantStatus"
FROM app_v3.padel_pairings p
JOIN app_v3.padel_pairing_slots s ON s.pairing_id = p.id
WHERE s.player_profile_id IS NOT NULL
ON CONFLICT (event_id, category_id, player_profile_id) DO NOTHING;

INSERT INTO app_v3.padel_rounds (
  event_id,
  category_id,
  organization_id,
  round_key,
  phase,
  round_number,
  group_label,
  state,
  score_mode,
  timer_state
)
SELECT
  m.event_id,
  m.category_id,
  e.organization_id,
  CONCAT(
    m.event_id,
    ':',
    COALESCE(m.category_id::text, 'null'),
    ':',
    COALESCE(m.round_type, 'GROUPS'),
    ':',
    COALESCE(m.group_label, '-'),
    ':',
    COALESCE(m.round_label, '-')
  ) AS round_key,
  (
    CASE
      WHEN m.round_type = 'KNOCKOUT' THEN 'PLAYOFF'
      WHEN cfg.format = 'NON_STOP' THEN 'NON_STOP'
      WHEN cfg.format IN ('AMERICANO', 'MEXICANO') THEN 'ROUND_ROBIN'
      ELSE 'GROUPS'
    END
  )::app_v3."PadelRoundPhase" AS phase,
  COALESCE(NULLIF(regexp_replace(COALESCE(m.round_label, ''), '\D', '', 'g'), '')::int, 1) AS round_number,
  m.group_label,
  (
    CASE
      WHEN bool_or(m.status = 'IN_PROGRESS') THEN 'LIVE'
      WHEN bool_and(m.status IN ('DONE', 'CANCELLED')) THEN 'CLOSED'
      ELSE 'PENDING'
    END
  )::app_v3."PadelRoundState" AS state,
  (
    CASE
      WHEN bool_or(lower(COALESCE(m.score->>'mode', 'SETS')) = 'timed_games') THEN 'TIMED_GAMES'
      ELSE 'SETS'
    END
  )::app_v3."PadelScoreMode" AS score_mode,
  (
    CASE
      WHEN (
        CASE
          WHEN m.round_type = 'KNOCKOUT' THEN 'PLAYOFF'
          WHEN cfg.format = 'NON_STOP' THEN 'NON_STOP'
          WHEN cfg.format IN ('AMERICANO', 'MEXICANO') THEN 'ROUND_ROBIN'
          ELSE 'GROUPS'
        END
      ) = 'NON_STOP' THEN
        CASE
          WHEN bool_or(m.status = 'IN_PROGRESS') THEN 'RUNNING'
          ELSE 'STOPPED'
        END
      ELSE 'IDLE'
    END
  )::app_v3."PadelRoundTimerState" AS timer_state
FROM app_v3.padel_matches m
JOIN app_v3.events e ON e.id = m.event_id
LEFT JOIN app_v3.padel_tournament_configs cfg ON cfg.event_id = m.event_id
GROUP BY
  m.event_id,
  m.category_id,
  e.organization_id,
  m.round_type,
  m.group_label,
  m.round_label,
  cfg.format
ON CONFLICT (round_key) DO NOTHING;

UPDATE app_v3.padel_matches m
SET
  round_id = r.id,
  score_mode = (
    CASE
      WHEN lower(COALESCE(m.score->>'mode', 'SETS')) = 'timed_games'
        THEN 'TIMED_GAMES'
      ELSE 'SETS'
    END
  )::app_v3."PadelScoreMode"
FROM app_v3.padel_rounds r
WHERE r.round_key = CONCAT(
  m.event_id,
  ':',
  COALESCE(m.category_id::text, 'null'),
  ':',
  COALESCE(m.round_type, 'GROUPS'),
  ':',
  COALESCE(m.group_label, '-'),
  ':',
  COALESCE(m.round_label, '-')
);

INSERT INTO app_v3.padel_match_participants (
  match_id,
  participant_id,
  side,
  slot_order
)
SELECT
  m.id,
  tp.id,
  'A'::app_v3."PadelMatchSide",
  row_number() OVER (PARTITION BY m.id ORDER BY s.id) - 1
FROM app_v3.padel_matches m
JOIN app_v3.padel_pairing_slots s
  ON s.pairing_id = m.pairing_a_id
 AND s.player_profile_id IS NOT NULL
JOIN app_v3.padel_tournament_participants tp
  ON tp.event_id = m.event_id
 AND tp.player_profile_id = s.player_profile_id
 AND tp.category_id IS NOT DISTINCT FROM m.category_id
ON CONFLICT (match_id, participant_id) DO NOTHING;

INSERT INTO app_v3.padel_match_participants (
  match_id,
  participant_id,
  side,
  slot_order
)
SELECT
  m.id,
  tp.id,
  'B'::app_v3."PadelMatchSide",
  row_number() OVER (PARTITION BY m.id ORDER BY s.id) - 1
FROM app_v3.padel_matches m
JOIN app_v3.padel_pairing_slots s
  ON s.pairing_id = m.pairing_b_id
 AND s.player_profile_id IS NOT NULL
JOIN app_v3.padel_tournament_participants tp
  ON tp.event_id = m.event_id
 AND tp.player_profile_id = s.player_profile_id
 AND tp.category_id IS NOT DISTINCT FROM m.category_id
ON CONFLICT (match_id, participant_id) DO NOTHING;

UPDATE app_v3.padel_matches m
SET winner_participant_id = (
  SELECT mp.participant_id
  FROM app_v3.padel_match_participants mp
  WHERE mp.match_id = m.id
    AND (
      (m.winner_pairing_id = m.pairing_a_id AND mp.side = 'A'::app_v3."PadelMatchSide")
      OR
      (m.winner_pairing_id = m.pairing_b_id AND mp.side = 'B'::app_v3."PadelMatchSide")
    )
  ORDER BY mp.slot_order ASC
  LIMIT 1
)
WHERE m.winner_pairing_id IS NOT NULL;

COMMIT;
