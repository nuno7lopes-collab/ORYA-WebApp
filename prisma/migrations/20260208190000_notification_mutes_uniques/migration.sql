-- Deduplicate existing mutes to enforce partial unique indexes
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY user_id, organization_id ORDER BY created_at ASC, id ASC) AS rn
  FROM app_v3.notification_mutes
  WHERE event_id IS NULL AND organization_id IS NOT NULL
)
DELETE FROM app_v3.notification_mutes
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY user_id, event_id ORDER BY created_at ASC, id ASC) AS rn
  FROM app_v3.notification_mutes
  WHERE organization_id IS NULL AND event_id IS NOT NULL
)
DELETE FROM app_v3.notification_mutes
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS notification_mutes_user_org_unique
  ON app_v3.notification_mutes (user_id, organization_id)
  WHERE event_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notification_mutes_user_event_unique
  ON app_v3.notification_mutes (user_id, event_id)
  WHERE organization_id IS NULL;
