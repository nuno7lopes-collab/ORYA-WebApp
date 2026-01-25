-- Ensure only one pending transfer per organization
WITH ranked AS (
  SELECT
    id,
    organization_id,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at DESC, id DESC) AS rn
  FROM app_v3.organization_owner_transfers
  WHERE status = 'PENDING'
)
UPDATE app_v3.organization_owner_transfers t
SET status = 'CANCELLED', cancelled_at = now()
FROM ranked r
WHERE t.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS organization_owner_transfers_pending_unique
  ON app_v3.organization_owner_transfers (organization_id)
  WHERE status = 'PENDING';
