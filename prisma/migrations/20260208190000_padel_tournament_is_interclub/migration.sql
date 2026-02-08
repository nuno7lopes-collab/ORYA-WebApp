-- Add missing column referenced by Prisma schema
ALTER TABLE "app_v3"."padel_tournament_configs"
ADD COLUMN IF NOT EXISTS "is_interclub" BOOLEAN NOT NULL DEFAULT false;
