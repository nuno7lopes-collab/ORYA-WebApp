-- Drop unused columns in chat and store models
ALTER TABLE app_v3.chat_messages
  DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE app_v3.internal_chat_messages
  DROP COLUMN IF EXISTS deleted_by_user_id;

ALTER TABLE app_v3.store_products
  DROP COLUMN IF EXISTS weight_grams,
  DROP COLUMN IF EXISTS length_mm,
  DROP COLUMN IF EXISTS width_mm,
  DROP COLUMN IF EXISTS height_mm;
