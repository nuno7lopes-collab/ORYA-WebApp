-- Cria tabela de memberships entre utilizadores e organizadores
CREATE TABLE IF NOT EXISTS "app_v3"."organizer_members" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id integer NOT NULL REFERENCES "app_v3"."organizers"(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES "app_v3"."profiles"(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('OWNER','ADMIN','STAFF','CHECKIN_ONLY')),
  invited_by_user_id uuid NULL REFERENCES "app_v3"."profiles"(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organizer_members_user_idx ON "app_v3"."organizer_members"(user_id);
CREATE INDEX IF NOT EXISTS organizer_members_org_role_idx ON "app_v3"."organizer_members"(organizer_id, role);
CREATE UNIQUE INDEX IF NOT EXISTS organizer_members_org_user_uniq ON "app_v3"."organizer_members"(organizer_id, user_id);

-- Backfill: cria memberships OWNER para organizers existentes com user_id
INSERT INTO "app_v3"."organizer_members" (organizer_id, user_id, role)
SELECT o.id, o.user_id, 'OWNER'
FROM "app_v3"."organizers" o
WHERE o.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "app_v3"."organizer_members" m
    WHERE m.organizer_id = o.id AND m.user_id = o.user_id
  );
