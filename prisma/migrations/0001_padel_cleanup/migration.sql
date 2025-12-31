-- Padel cleanup: remove legacy teams in favor of pairings
ALTER TABLE app_v3.padel_matches DROP CONSTRAINT IF EXISTS padel_matches_team_a_id_fkey;
ALTER TABLE app_v3.padel_matches DROP CONSTRAINT IF EXISTS padel_matches_team_b_id_fkey;

ALTER TABLE app_v3.padel_matches DROP COLUMN IF EXISTS team_a_id;
ALTER TABLE app_v3.padel_matches DROP COLUMN IF EXISTS team_b_id;

DROP TABLE IF EXISTS app_v3.padel_teams CASCADE;
DROP SEQUENCE IF EXISTS app_v3.padel_teams_id_seq;
