-- Remove unique constraints que impedem múltiplas redemptions por utilizador/guest
ALTER TABLE app_v3.promo_redemptions DROP CONSTRAINT IF EXISTS promo_redemptions_user_unique;
ALTER TABLE app_v3.promo_redemptions DROP CONSTRAINT IF EXISTS promo_redemptions_guest_unique;

-- Optional: manter índices não-unique para pesquisa (guest_email lower)
CREATE INDEX IF NOT EXISTS promo_redemptions_guest_email_idx ON app_v3.promo_redemptions (lower(guest_email)) WHERE guest_email IS NOT NULL;
