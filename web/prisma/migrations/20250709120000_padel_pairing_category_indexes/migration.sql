-- Allow multiple active pairings per event as long as they are in different categories.
DROP INDEX IF EXISTS app_v3.padel_pairings_event_player1_active_idx;
DROP INDEX IF EXISTS app_v3.padel_pairings_event_player2_active_idx;

CREATE UNIQUE INDEX IF NOT EXISTS padel_pairings_event_player1_active_idx
  ON app_v3.padel_pairings(event_id, category_id, player1_user_id)
  WHERE lifecycle_status <> 'CANCELLED_INCOMPLETE' AND player1_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS padel_pairings_event_player2_active_idx
  ON app_v3.padel_pairings(event_id, category_id, player2_user_id)
  WHERE lifecycle_status <> 'CANCELLED_INCOMPLETE' AND player2_user_id IS NOT NULL;
