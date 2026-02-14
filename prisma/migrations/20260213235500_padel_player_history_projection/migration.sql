-- Padel player history projection (titles + competitive history)

BEGIN;

CREATE TABLE IF NOT EXISTS app_v3.padel_player_history_projection (
  id SERIAL PRIMARY KEY,
  env TEXT NOT NULL DEFAULT 'prod',
  organization_id INT NOT NULL,
  event_id INT NOT NULL,
  category_id INT,
  player_profile_id INT NOT NULL,
  partner_player_profile_id INT,
  final_position INT,
  won_title BOOLEAN NOT NULL DEFAULT false,
  bracket_snapshot JSONB,
  computed_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT padel_player_history_org_fk
    FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE CASCADE,
  CONSTRAINT padel_player_history_event_fk
    FOREIGN KEY (event_id) REFERENCES app_v3.events(id) ON DELETE CASCADE,
  CONSTRAINT padel_player_history_category_fk
    FOREIGN KEY (category_id) REFERENCES app_v3.padel_categories(id) ON DELETE SET NULL,
  CONSTRAINT padel_player_history_player_fk
    FOREIGN KEY (player_profile_id) REFERENCES app_v3.padel_player_profiles(id) ON DELETE CASCADE,
  CONSTRAINT padel_player_history_partner_player_fk
    FOREIGN KEY (partner_player_profile_id) REFERENCES app_v3.padel_player_profiles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS padel_player_history_event_category_player_uq
  ON app_v3.padel_player_history_projection (event_id, category_id, player_profile_id);
CREATE INDEX IF NOT EXISTS padel_player_history_org_idx
  ON app_v3.padel_player_history_projection (organization_id);
CREATE INDEX IF NOT EXISTS padel_player_history_player_idx
  ON app_v3.padel_player_history_projection (player_profile_id);
CREATE INDEX IF NOT EXISTS padel_player_history_event_idx
  ON app_v3.padel_player_history_projection (event_id);

COMMIT;
