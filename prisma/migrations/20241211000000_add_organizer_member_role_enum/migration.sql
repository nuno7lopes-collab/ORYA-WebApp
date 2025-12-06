-- Ensure schema exists
CREATE SCHEMA IF NOT EXISTS app_v3;

-- Create enum type used by Prisma for organizer_member.role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app_v3' AND t.typname = 'OrganizerMemberRole'
  ) THEN
    CREATE TYPE "app_v3"."OrganizerMemberRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'CHECKIN_ONLY');
  END IF;
END$$;

-- Ensure the organizer_members table exists (noop if already created by previous migration)
CREATE TABLE IF NOT EXISTS "app_v3"."organizer_members" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id integer NOT NULL REFERENCES "app_v3"."organizers"(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES "app_v3"."profiles"(id) ON DELETE CASCADE,
  role "app_v3"."OrganizerMemberRole" NOT NULL,
  invited_by_user_id uuid NULL REFERENCES "app_v3"."profiles"(id),
  last_used_at timestamptz NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- If the role column exists as text, cast it to the enum
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'app_v3'
      AND table_name = 'organizer_members'
      AND column_name = 'role'
      AND udt_schema <> 'app_v3'
  ) THEN
    ALTER TABLE "app_v3"."organizer_members"
      ALTER COLUMN role TYPE "app_v3"."OrganizerMemberRole" USING role::text::"app_v3"."OrganizerMemberRole";
  END IF;
END$$;

-- Indexes and unique constraints (idempotent)
CREATE INDEX IF NOT EXISTS organizer_members_user_idx ON "app_v3"."organizer_members"(user_id);
CREATE INDEX IF NOT EXISTS organizer_members_org_role_idx ON "app_v3"."organizer_members"(organizer_id, role);
CREATE UNIQUE INDEX IF NOT EXISTS organizer_members_org_user_uniq ON "app_v3"."organizer_members"(organizer_id, user_id);

-- Ensure last_used_at column exists
ALTER TABLE "app_v3"."organizer_members"
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz NULL;

-- Backfill OWNER memberships from legacy organizers.user_id when missing
INSERT INTO "app_v3"."organizer_members" (organizer_id, user_id, role)
SELECT o.id, o.user_id, 'OWNER'::"app_v3"."OrganizerMemberRole"
FROM "app_v3"."organizers" o
WHERE o.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "app_v3"."organizer_members" m
    WHERE m.organizer_id = o.id AND m.user_id = o.user_id
  );
