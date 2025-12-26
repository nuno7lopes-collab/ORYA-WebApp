ALTER TABLE "app_v3"."events"
  ALTER COLUMN "type" SET DEFAULT 'ORGANIZER_EVENT';

UPDATE "app_v3"."events"
  SET "type" = 'ORGANIZER_EVENT'
  WHERE "type" = 'EXPERIENCE';
