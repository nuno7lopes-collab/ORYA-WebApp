ALTER TABLE "app_v3"."profiles"
ADD COLUMN "padel_level" TEXT,
ADD COLUMN "padel_preferred_side" "app_v3"."PadelPreferredSide",
ADD COLUMN "padel_club_name" TEXT;
