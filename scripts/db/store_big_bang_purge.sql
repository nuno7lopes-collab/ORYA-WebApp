-- Store Big-Bang destructive purge
-- Approved destructive cleanup for store domain + related cross-domain artifacts.

BEGIN;

-- 1) Store domain tables
TRUNCATE TABLE
  app_v3.store_inventory_movements,
  app_v3.store_shipping_tiers,
  app_v3.store_shipping_methods,
  app_v3.store_shipping_zones,
  app_v3.store_shipments,
  app_v3.store_order_addresses,
  app_v3.store_order_bundle_items,
  app_v3.store_order_bundles,
  app_v3.store_digital_grants,
  app_v3.store_digital_assets,
  app_v3.store_order_lines,
  app_v3.store_orders,
  app_v3.store_cart_items,
  app_v3.store_carts,
  app_v3.store_bundle_items,
  app_v3.store_bundles,
  app_v3.store_product_option_values,
  app_v3.store_product_options,
  app_v3.store_product_images,
  app_v3.store_product_variants,
  app_v3.store_products,
  app_v3.store_categories,
  app_v3.stores
RESTART IDENTITY CASCADE;

-- 2) Cross-domain cleanup by source type
DELETE FROM app_v3.payment_events
WHERE source_type = 'STORE_ORDER';

DELETE FROM app_v3.payments
WHERE source_type = 'STORE_ORDER';

DELETE FROM app_v3.sale_lines
WHERE source_type = 'STORE_ORDER';

DELETE FROM app_v3.sale_summaries
WHERE source_type = 'STORE_ORDER';

DELETE FROM app_v3.checkout_snapshots
WHERE source_type = 'STORE_ORDER';

DELETE FROM app_v3.refund_events
WHERE source_type = 'STORE_ORDER';

DELETE FROM app_v3.operations_outbox
WHERE source_type = 'STORE_ORDER';

DELETE FROM app_v3.notification_outbox
WHERE source_type = 'STORE_ORDER';

DELETE FROM app_v3.ops_feed
WHERE source_type = 'STORE_ORDER';

DELETE FROM app_v3.event_logs
WHERE source_type = 'STORE_ORDER';

DELETE FROM app_v3.crm_interactions
WHERE source_type = 'STORE_ORDER';

DELETE FROM app_v3.invoices
WHERE source_type = 'STORE_ORDER';

DELETE FROM app_v3.invoice_snapshots
WHERE source_type = 'STORE_ORDER';

DELETE FROM app_v3.entitlements
WHERE type = 'STORE_ITEM';

COMMIT;
