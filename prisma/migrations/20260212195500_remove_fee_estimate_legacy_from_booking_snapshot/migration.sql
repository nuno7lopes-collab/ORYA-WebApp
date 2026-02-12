-- Hard-cut: remove estimate legacy fields from booking confirmation snapshots.
-- SSOT: estimates are not canonical truth.

WITH normalized AS (
  SELECT
    b.id,
    b.confirmation_snapshot,
    b.confirmation_snapshot -> 'pricingSnapshot' AS ps
  FROM app_v3.bookings b
  WHERE b.confirmation_snapshot IS NOT NULL
    AND jsonb_typeof(b.confirmation_snapshot) = 'object'
    AND jsonb_typeof(b.confirmation_snapshot -> 'pricingSnapshot') = 'object'
),
values_resolved AS (
  SELECT
    n.id,
    n.confirmation_snapshot,
    n.ps,
    CASE
      WHEN (n.ps ->> 'combinedFeeCents') ~ '^-?[0-9]+$' THEN (n.ps ->> 'combinedFeeCents')::int
      WHEN (n.ps ->> 'combinedFeeEstimateCents') ~ '^-?[0-9]+$' THEN (n.ps ->> 'combinedFeeEstimateCents')::int
      ELSE 0
    END AS combined_fee_cents,
    CASE
      WHEN (n.ps ->> 'cardPlatformFeeCents') ~ '^-?[0-9]+$' THEN (n.ps ->> 'cardPlatformFeeCents')::int
      ELSE 0
    END AS card_platform_fee_cents,
    CASE
      WHEN n.ps ? 'processorFeesActualCents' THEN n.ps -> 'processorFeesActualCents'
      WHEN n.ps ? 'processorFeesActual' THEN n.ps -> 'processorFeesActual'
      ELSE 'null'::jsonb
    END AS processor_fees_actual_json,
    CASE
      WHEN NULLIF(n.ps ->> 'processorFeesStatus', '') IN ('PENDING', 'FINAL') THEN n.ps ->> 'processorFeesStatus'
      ELSE 'PENDING'
    END AS processor_fees_status
  FROM normalized n
)
UPDATE app_v3.bookings b
SET confirmation_snapshot = jsonb_set(
  v.confirmation_snapshot,
  '{pricingSnapshot}',
  (
    (v.ps - 'stripeFeeEstimateCents' - 'combinedFeeEstimateCents' - 'processorFeesActual')
    || jsonb_build_object(
      'combinedFeeCents', GREATEST(0, v.combined_fee_cents),
      'platformFeeCents', GREATEST(0, v.combined_fee_cents - GREATEST(0, v.card_platform_fee_cents)),
      'processorFeesStatus', v.processor_fees_status,
      'processorFeesActualCents', v.processor_fees_actual_json
    )
  ),
  true
)
FROM values_resolved v
WHERE b.id = v.id;
