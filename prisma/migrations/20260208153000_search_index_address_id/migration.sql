-- Add address_id to search_index_items to align with Prisma schema

ALTER TABLE app_v3.search_index_items
  ADD COLUMN IF NOT EXISTS address_id uuid;

CREATE INDEX IF NOT EXISTS search_index_items_address_idx
  ON app_v3.search_index_items (address_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'search_index_items_address_fk'
  ) THEN
    ALTER TABLE app_v3.search_index_items
      ADD CONSTRAINT search_index_items_address_fk
      FOREIGN KEY (address_id) REFERENCES app_v3.addresses(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;
