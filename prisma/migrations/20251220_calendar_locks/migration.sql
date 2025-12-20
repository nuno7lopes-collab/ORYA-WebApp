-- Simple locking table for optimistic lock with TTL
CREATE TABLE IF NOT EXISTS "app_v3"."locks" (
    "key" text PRIMARY KEY,
    "expires_at" timestamptz NOT NULL
);

