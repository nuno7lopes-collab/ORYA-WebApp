DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'AvailabilityConflictEntityType'
      AND e.enumlabel = 'MATCH'
  ) THEN
    ALTER TYPE app_v3."AvailabilityConflictEntityType" ADD VALUE 'MATCH';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'AvailabilityConflictEntityType'
      AND e.enumlabel = 'SOFT_BLOCK'
  ) THEN
    ALTER TYPE app_v3."AvailabilityConflictEntityType" ADD VALUE 'SOFT_BLOCK';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'AvailabilityConflictEntityType'
      AND e.enumlabel = 'HARD_BLOCK'
  ) THEN
    ALTER TYPE app_v3."AvailabilityConflictEntityType" ADD VALUE 'HARD_BLOCK';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'AvailabilityConflictResolutionAction'
      AND e.enumlabel = 'EXTERNAL_RESOLUTION'
  ) THEN
    ALTER TYPE app_v3."AvailabilityConflictResolutionAction" ADD VALUE 'EXTERNAL_RESOLUTION';
  END IF;
END $$;

WITH pending_ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, scope_type, scope_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM app_v3.availability_change_sets
  WHERE status IN ('PENDING', 'READY_TO_APPLY')
)
UPDATE app_v3.availability_change_sets cs
SET
  status = 'CANCELLED',
  cancelled_at = COALESCE(cs.cancelled_at, now()),
  updated_at = now()
FROM pending_ranked pr
WHERE cs.id = pr.id
  AND pr.rn > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'app_v3'
      AND indexname = 'availability_change_sets_one_pending_per_scope_uq'
  ) THEN
    CREATE UNIQUE INDEX availability_change_sets_one_pending_per_scope_uq
      ON app_v3.availability_change_sets (organization_id, scope_type, scope_id)
      WHERE status IN ('PENDING', 'READY_TO_APPLY');
  END IF;
END $$;

WITH conflict_ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY change_set_id, entity_type, entity_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM app_v3.availability_change_conflicts
)
DELETE FROM app_v3.availability_change_conflicts c
USING conflict_ranked r
WHERE c.id = r.id
  AND r.rn > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'availability_change_conflicts_set_entity_unique'
      AND connamespace = 'app_v3'::regnamespace
  ) THEN
    ALTER TABLE app_v3.availability_change_conflicts
      ADD CONSTRAINT availability_change_conflicts_set_entity_unique
      UNIQUE (change_set_id, entity_type, entity_id);
  END IF;
END $$;

WITH open_counts AS (
  SELECT
    cs.id AS change_set_id,
    COUNT(c.id) FILTER (WHERE c.status = 'OPEN')::int AS open_count
  FROM app_v3.availability_change_sets cs
  LEFT JOIN app_v3.availability_change_conflicts c
    ON c.change_set_id = cs.id
  GROUP BY cs.id
)
UPDATE app_v3.availability_change_sets cs
SET
  status = CASE
    WHEN oc.open_count > 0 THEN 'PENDING'::app_v3."AvailabilityChangeSetStatus"
    ELSE 'READY_TO_APPLY'::app_v3."AvailabilityChangeSetStatus"
  END,
  preflight_summary = jsonb_set(
    COALESCE(cs.preflight_summary, '{}'::jsonb),
    '{conflictsTotal}',
    to_jsonb(oc.open_count),
    true
  ),
  updated_at = now()
FROM open_counts oc
WHERE cs.id = oc.change_set_id
  AND cs.status IN ('PENDING', 'READY_TO_APPLY');
