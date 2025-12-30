-- Add line_item_index to support quantity>1 per sale_line
ALTER TABLE app_v3.entitlements
  ADD COLUMN IF NOT EXISTS line_item_index integer NOT NULL DEFAULT 0;

-- Refresh unique to include line_item_index
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entitlements_purchase_sale_owner_type_key'
  ) THEN
    ALTER TABLE app_v3.entitlements DROP CONSTRAINT entitlements_purchase_sale_owner_type_key;
  END IF;
END$$;

ALTER TABLE app_v3.entitlements
  ADD CONSTRAINT entitlements_purchase_sale_owner_type_idx UNIQUE (purchase_id, sale_line_id, line_item_index, owner_key, type);
