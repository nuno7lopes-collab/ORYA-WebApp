-- Padel club staff: move role from free-text to canonical enum.

WITH normalized_roles AS (
  SELECT
    id,
    regexp_replace(
      translate(
        upper(trim(coalesce(role, ''))),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'AAAAAEEEEIIIIOOOOOUUUUC'
      ),
      '[^A-Z0-9]+',
      '_',
      'g'
    ) AS normalized
  FROM app_v3.padel_club_staff
)
UPDATE app_v3.padel_club_staff AS staff
SET role = CASE
  WHEN normalized_roles.normalized IN ('ADMIN_CLUBE', 'ADMIN', 'ADMIN_CLUB', 'CLUB_ADMIN') THEN 'ADMIN_CLUBE'
  WHEN normalized_roles.normalized IN ('DIRETOR_PROVA', 'DIRETOR', 'DIRECTOR', 'ARBITRO', 'ARBITRO_PROVA', 'REFEREE', 'DIRETOR_ARBITRO') THEN 'DIRETOR_PROVA'
  WHEN normalized_roles.normalized IN ('STAFF', 'STAFF_DE_CAMPO', 'COURT_STAFF') THEN 'STAFF'
  ELSE 'STAFF'
END
FROM normalized_roles
WHERE normalized_roles.id = staff.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3'
      AND t.typname = 'PadelClubStaffRole'
  ) THEN
    CREATE TYPE app_v3."PadelClubStaffRole" AS ENUM ('ADMIN_CLUBE', 'DIRETOR_PROVA', 'STAFF');
  END IF;
END;
$$;

ALTER TABLE app_v3.padel_club_staff
  ALTER COLUMN role TYPE app_v3."PadelClubStaffRole"
  USING role::text::app_v3."PadelClubStaffRole";
