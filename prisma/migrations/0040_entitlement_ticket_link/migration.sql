ALTER TABLE app_v3.entitlements
  ADD COLUMN IF NOT EXISTS ticket_id text;

DO $$
BEGIN
  ALTER TABLE app_v3.entitlements
    ADD CONSTRAINT entitlements_ticket_id_fkey
    FOREIGN KEY (ticket_id) REFERENCES app_v3.tickets(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS entitlements_ticket_id_key
  ON app_v3.entitlements(ticket_id)
  WHERE ticket_id IS NOT NULL;

WITH line_tickets AS (
  SELECT
    t.id AS ticket_id,
    t.purchase_id,
    t.ticket_type_id,
    COALESCE(t.emission_index, 0) AS emission_index
  FROM app_v3.tickets t
  WHERE t.purchase_id IS NOT NULL
),
primary_matches AS (
  SELECT DISTINCT ON (lt.ticket_id) e.id AS entitlement_id, lt.ticket_id
  FROM app_v3.entitlements e
  JOIN app_v3.sale_lines sl ON sl.id = e.sale_line_id
  JOIN line_tickets lt
    ON lt.ticket_type_id = sl.ticket_type_id
   AND lt.purchase_id = e.purchase_id
   AND lt.emission_index = e.line_item_index
  WHERE e.ticket_id IS NULL
    AND e.type IN ('EVENT_TICKET', 'PADEL_ENTRY')
  ORDER BY lt.ticket_id, e.id
)
UPDATE app_v3.entitlements e
SET ticket_id = pm.ticket_id
FROM primary_matches pm
WHERE e.id = pm.entitlement_id;

WITH ranked_tickets AS (
  SELECT
    t.id AS ticket_id,
    sl.id AS sale_line_id,
    ROW_NUMBER() OVER (PARTITION BY sl.id ORDER BY t.id) - 1 AS line_item_index
  FROM app_v3.tickets t
  JOIN app_v3.sale_summaries ss ON ss.id = t.sale_summary_id
  JOIN app_v3.sale_lines sl ON sl.sale_summary_id = ss.id AND sl.ticket_type_id = t.ticket_type_id
  WHERE t.sale_summary_id IS NOT NULL
),
fallback_matches AS (
  SELECT DISTINCT ON (rt.ticket_id) e.id AS entitlement_id, rt.ticket_id
  FROM app_v3.entitlements e
  JOIN ranked_tickets rt
    ON rt.sale_line_id = e.sale_line_id
   AND rt.line_item_index = e.line_item_index
  WHERE e.ticket_id IS NULL
    AND e.type IN ('EVENT_TICKET', 'PADEL_ENTRY')
  ORDER BY rt.ticket_id, e.id
)
UPDATE app_v3.entitlements e
SET ticket_id = fm.ticket_id
FROM fallback_matches fm
WHERE e.id = fm.entitlement_id;
