BEGIN;

-- Canonical club per organization (prefer OWN, then active, then oldest).
CREATE TEMP TABLE tmp_padel_club_mapping AS
WITH ranked AS (
  SELECT
    club.id,
    club.organization_id,
    ROW_NUMBER() OVER (
      PARTITION BY club.organization_id
      ORDER BY
        CASE WHEN club.kind = 'OWN' THEN 0 ELSE 1 END,
        CASE WHEN club.is_active THEN 0 ELSE 1 END,
        club.created_at ASC,
        club.id ASC
    ) AS row_num
  FROM app_v3.padel_clubs club
  WHERE club.deleted_at IS NULL
), canonical AS (
  SELECT organization_id, id AS canonical_club_id
  FROM ranked
  WHERE row_num = 1
)
SELECT
  ranked.id AS club_id,
  ranked.organization_id,
  canonical.canonical_club_id
FROM ranked
JOIN canonical ON canonical.organization_id = ranked.organization_id
WHERE ranked.id <> canonical.canonical_club_id;

-- Move club references to canonical clubs.
UPDATE app_v3.agenda_items item
SET padel_club_id = map.canonical_club_id
FROM tmp_padel_club_mapping map
WHERE item.padel_club_id = map.club_id;

UPDATE app_v3.padel_club_courts court
SET padel_club_id = map.canonical_club_id,
    updated_at = NOW()
FROM tmp_padel_club_mapping map
WHERE court.padel_club_id = map.club_id
  AND court.deleted_at IS NULL;

UPDATE app_v3.padel_club_staff staff
SET padel_club_id = map.canonical_club_id,
    updated_at = NOW()
FROM tmp_padel_club_mapping map
WHERE staff.padel_club_id = map.club_id
  AND staff.deleted_at IS NULL;

UPDATE app_v3.padel_club_staff_invites invite
SET padel_club_id = map.canonical_club_id,
    updated_at = NOW()
FROM tmp_padel_club_mapping map
WHERE invite.padel_club_id = map.club_id
  AND invite.cancelled_at IS NULL;

UPDATE app_v3.padel_tournament_configs cfg
SET padel_club_id = map.canonical_club_id,
    updated_at = NOW()
FROM tmp_padel_club_mapping map
WHERE cfg.padel_club_id = map.club_id;

UPDATE app_v3.padel_tournament_configs cfg
SET partner_club_ids = mapped.partner_club_ids,
    updated_at = NOW()
FROM (
  SELECT
    cfg_inner.id,
    COALESCE(
      array_agg(DISTINCT COALESCE(map.canonical_club_id, raw.club_id)) FILTER (WHERE raw.club_id IS NOT NULL),
      ARRAY[]::integer[]
    ) AS partner_club_ids
  FROM app_v3.padel_tournament_configs cfg_inner
  LEFT JOIN LATERAL unnest(cfg_inner.partner_club_ids) AS raw(club_id) ON TRUE
  LEFT JOIN tmp_padel_club_mapping map ON map.club_id = raw.club_id
  GROUP BY cfg_inner.id
) mapped
WHERE cfg.id = mapped.id;

UPDATE app_v3.padel_teams team
SET padel_club_id = map.canonical_club_id,
    updated_at = NOW()
FROM tmp_padel_club_mapping map
WHERE team.padel_club_id = map.club_id;

UPDATE app_v3.padel_community_posts post
SET padel_club_id = map.canonical_club_id,
    updated_at = NOW()
FROM tmp_padel_club_mapping map
WHERE post.padel_club_id = map.club_id;

UPDATE app_v3.padel_court_blocks block
SET padel_club_id = map.canonical_club_id,
    updated_at = NOW()
FROM tmp_padel_club_mapping map
WHERE block.padel_club_id = map.club_id;

UPDATE app_v3.padel_partnership_agreements agreement
SET owner_club_id = map.canonical_club_id,
    updated_at = NOW()
FROM tmp_padel_club_mapping map
WHERE agreement.owner_club_id = map.club_id;

UPDATE app_v3.padel_partnership_agreements agreement
SET partner_club_id = map.canonical_club_id,
    updated_at = NOW()
FROM tmp_padel_club_mapping map
WHERE agreement.partner_club_id = map.club_id;

UPDATE app_v3.padel_partnership_windows win
SET owner_club_id = map.canonical_club_id,
    updated_at = NOW()
FROM tmp_padel_club_mapping map
WHERE win.owner_club_id = map.club_id;

UPDATE app_v3.padel_partner_court_snapshots snap
SET partner_club_id = map.canonical_club_id,
    synced_at = COALESCE(snap.synced_at, NOW())
FROM tmp_padel_club_mapping map
WHERE snap.partner_club_id = map.club_id;

UPDATE app_v3.padel_partner_court_snapshots snap
SET source_club_id = map.canonical_club_id,
    synced_at = COALESCE(snap.synced_at, NOW())
FROM tmp_padel_club_mapping map
WHERE snap.source_club_id = map.club_id;

DO $$
BEGIN
  IF to_regclass('app_v3.padel_partnership_tournament_requests') IS NOT NULL THEN
    EXECUTE $q$
      UPDATE app_v3.padel_partnership_tournament_requests req
      SET owner_club_id = map.canonical_club_id
      FROM tmp_padel_club_mapping map
      WHERE req.owner_club_id = map.club_id
    $q$;

    EXECUTE $q$
      UPDATE app_v3.padel_partnership_tournament_requests req
      SET partner_club_id = map.canonical_club_id
      FROM tmp_padel_club_mapping map
      WHERE req.partner_club_id = map.club_id
    $q$;
  END IF;
END $$;

-- Normalize source links that referenced archived clubs.
UPDATE app_v3.padel_clubs club
SET source_club_id = map.canonical_club_id,
    updated_at = NOW()
FROM tmp_padel_club_mapping map
WHERE club.source_club_id = map.club_id;

-- Archive extra clubs (legacy multi-club state).
UPDATE app_v3.padel_clubs club
SET is_active = FALSE,
    deleted_at = COALESCE(club.deleted_at, NOW()),
    updated_at = NOW()
FROM tmp_padel_club_mapping map
WHERE club.id = map.club_id
  AND club.deleted_at IS NULL;

-- Remaining non-deleted clubs are canonical operational clubs.
UPDATE app_v3.padel_clubs club
SET kind = 'OWN',
    source_club_id = NULL,
    is_default = FALSE,
    updated_at = NOW()
WHERE club.deleted_at IS NULL
  AND (
    club.kind <> 'OWN'
    OR club.source_club_id IS NOT NULL
    OR club.is_default IS DISTINCT FROM FALSE
  );

-- Hard rule: only one non-deleted club per organization.
CREATE UNIQUE INDEX IF NOT EXISTS padel_clubs_one_per_organization_active_idx
  ON app_v3.padel_clubs (organization_id)
  WHERE deleted_at IS NULL;

COMMIT;
