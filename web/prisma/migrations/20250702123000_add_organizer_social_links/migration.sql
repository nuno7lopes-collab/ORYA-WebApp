ALTER TABLE "app_v3"."organizers" ADD COLUMN IF NOT EXISTS "public_instagram" TEXT;
ALTER TABLE "app_v3"."organizers" ADD COLUMN IF NOT EXISTS "public_youtube" TEXT;
ALTER TYPE "app_v3"."OrganizationModule" ADD VALUE IF NOT EXISTS 'LOJA';
ALTER TYPE "app_v3"."OrganizationModule" ADD VALUE IF NOT EXISTS 'GALERIA';
