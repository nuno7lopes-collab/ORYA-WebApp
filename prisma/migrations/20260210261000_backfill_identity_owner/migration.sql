-- Ensure email identities for existing auth users
INSERT INTO app_v3.email_identities (email_normalized, user_id, email_verified_at)
SELECT LOWER(TRIM(u.email)) AS email_normalized,
       p.id AS user_id,
       u.email_confirmed_at AS email_verified_at
FROM auth.users u
LEFT JOIN app_v3.profiles p ON p.id = u.id
WHERE u.email IS NOT NULL AND TRIM(u.email) <> ''
ON CONFLICT (email_normalized) DO UPDATE
SET user_id = COALESCE(app_v3.email_identities.user_id, EXCLUDED.user_id),
    email_verified_at = COALESCE(app_v3.email_identities.email_verified_at, EXCLUDED.email_verified_at),
    updated_at = now();

-- Backfill entitlements from owner_user_id
UPDATE app_v3.entitlements e
SET owner_identity_id = i.id,
    owner_user_id = NULL,
    owner_key = CONCAT('identity:', i.id),
    updated_at = now()
FROM app_v3.email_identities i
WHERE e.owner_identity_id IS NULL
  AND e.owner_user_id IS NOT NULL
  AND i.user_id = e.owner_user_id;

-- Backfill entitlements from owner_key email
UPDATE app_v3.entitlements e
SET owner_identity_id = i.id,
    owner_user_id = NULL,
    owner_key = CONCAT('identity:', i.id),
    updated_at = now()
FROM app_v3.email_identities i
WHERE e.owner_identity_id IS NULL
  AND e.owner_key LIKE 'email:%'
  AND i.email_normalized = LOWER(TRIM(SUBSTRING(e.owner_key FROM 7)));

-- Backfill entitlements from owner_key identity (if present)
UPDATE app_v3.entitlements e
SET owner_identity_id = SUBSTRING(e.owner_key FROM 10)::uuid,
    owner_user_id = NULL,
    updated_at = now()
WHERE e.owner_identity_id IS NULL
  AND e.owner_key LIKE 'identity:%'
  AND SUBSTRING(e.owner_key FROM 10) ~* '^[0-9a-f\\-]{36}$';

-- Normalize owner_key to identity when owner_identity_id is set
UPDATE app_v3.entitlements e
SET owner_key = CONCAT('identity:', e.owner_identity_id),
    updated_at = now()
WHERE e.owner_identity_id IS NOT NULL
  AND e.owner_key <> CONCAT('identity:', e.owner_identity_id);

-- Optional: sync tickets owner_identity_id from entitlements
UPDATE app_v3.tickets t
SET owner_identity_id = e.owner_identity_id
FROM app_v3.entitlements e
WHERE t.owner_identity_id IS NULL
  AND e.ticket_id = t.id
  AND e.owner_identity_id IS NOT NULL;
