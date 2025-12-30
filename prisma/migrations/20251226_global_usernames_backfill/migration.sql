INSERT INTO "app_v3"."global_usernames" ("username", "owner_type", "owner_id", "created_at", "updated_at")
SELECT
  btrim(p."username"),
  'user',
  p."id"::text,
  now(),
  now()
FROM "app_v3"."profiles" p
WHERE p."username" IS NOT NULL
  AND btrim(p."username") <> ''
ON CONFLICT DO NOTHING;

INSERT INTO "app_v3"."global_usernames" ("username", "owner_type", "owner_id", "created_at", "updated_at")
SELECT
  btrim(o."username"),
  'organizer',
  o."id"::text,
  now(),
  now()
FROM "app_v3"."organizers" o
WHERE o."username" IS NOT NULL
  AND btrim(o."username") <> ''
ON CONFLICT DO NOTHING;

UPDATE "app_v3"."organizers"
SET "public_website" = CASE
  WHEN btrim("public_website") ~* '^@' THEN 'https://instagram.com/' || substring(btrim("public_website") from 2)
  WHEN btrim("public_website") ~* '^https?://' THEN btrim("public_website")
  ELSE 'https://' || btrim("public_website")
END
WHERE "public_website" IS NOT NULL
  AND btrim("public_website") <> '';
