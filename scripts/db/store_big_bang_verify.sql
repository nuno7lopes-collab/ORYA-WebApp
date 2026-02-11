-- Store Big-Bang verification queries
-- All counters below must be zero after purge.

SELECT 'stores' AS check, COUNT(*) AS count FROM app_v3.stores;
SELECT 'store_categories' AS check, COUNT(*) AS count FROM app_v3.store_categories;
SELECT 'store_products' AS check, COUNT(*) AS count FROM app_v3.store_products;
SELECT 'store_product_variants' AS check, COUNT(*) AS count FROM app_v3.store_product_variants;
SELECT 'store_product_images' AS check, COUNT(*) AS count FROM app_v3.store_product_images;
SELECT 'store_product_options' AS check, COUNT(*) AS count FROM app_v3.store_product_options;
SELECT 'store_product_option_values' AS check, COUNT(*) AS count FROM app_v3.store_product_option_values;
SELECT 'store_bundles' AS check, COUNT(*) AS count FROM app_v3.store_bundles;
SELECT 'store_bundle_items' AS check, COUNT(*) AS count FROM app_v3.store_bundle_items;
SELECT 'store_carts' AS check, COUNT(*) AS count FROM app_v3.store_carts;
SELECT 'store_cart_items' AS check, COUNT(*) AS count FROM app_v3.store_cart_items;
SELECT 'store_orders' AS check, COUNT(*) AS count FROM app_v3.store_orders;
SELECT 'store_order_lines' AS check, COUNT(*) AS count FROM app_v3.store_order_lines;
SELECT 'store_order_bundles' AS check, COUNT(*) AS count FROM app_v3.store_order_bundles;
SELECT 'store_order_bundle_items' AS check, COUNT(*) AS count FROM app_v3.store_order_bundle_items;
SELECT 'store_order_addresses' AS check, COUNT(*) AS count FROM app_v3.store_order_addresses;
SELECT 'store_shipments' AS check, COUNT(*) AS count FROM app_v3.store_shipments;
SELECT 'store_shipping_zones' AS check, COUNT(*) AS count FROM app_v3.store_shipping_zones;
SELECT 'store_shipping_methods' AS check, COUNT(*) AS count FROM app_v3.store_shipping_methods;
SELECT 'store_shipping_tiers' AS check, COUNT(*) AS count FROM app_v3.store_shipping_tiers;
SELECT 'store_inventory_movements' AS check, COUNT(*) AS count FROM app_v3.store_inventory_movements;
SELECT 'store_digital_assets' AS check, COUNT(*) AS count FROM app_v3.store_digital_assets;
SELECT 'store_digital_grants' AS check, COUNT(*) AS count FROM app_v3.store_digital_grants;

SELECT 'payments_source_type_store_order' AS check, COUNT(*) AS count
FROM app_v3.payments
WHERE source_type = 'STORE_ORDER';

SELECT 'payment_events_source_type_store_order' AS check, COUNT(*) AS count
FROM app_v3.payment_events
WHERE source_type = 'STORE_ORDER';

SELECT 'sale_summaries_source_type_store_order' AS check, COUNT(*) AS count
FROM app_v3.sale_summaries
WHERE source_type = 'STORE_ORDER';

SELECT 'sale_lines_source_type_store_order' AS check, COUNT(*) AS count
FROM app_v3.sale_lines
WHERE source_type = 'STORE_ORDER';

SELECT 'checkout_snapshots_source_type_store_order' AS check, COUNT(*) AS count
FROM app_v3.checkout_snapshots
WHERE source_type = 'STORE_ORDER';

SELECT 'refund_events_source_type_store_order' AS check, COUNT(*) AS count
FROM app_v3.refund_events
WHERE source_type = 'STORE_ORDER';

SELECT 'operations_outbox_source_type_store_order' AS check, COUNT(*) AS count
FROM app_v3.operations_outbox
WHERE source_type = 'STORE_ORDER';

SELECT 'notification_outbox_source_type_store_order' AS check, COUNT(*) AS count
FROM app_v3.notification_outbox
WHERE source_type = 'STORE_ORDER';

SELECT 'ops_feed_source_type_store_order' AS check, COUNT(*) AS count
FROM app_v3.ops_feed
WHERE source_type = 'STORE_ORDER';

SELECT 'event_logs_source_type_store_order' AS check, COUNT(*) AS count
FROM app_v3.event_logs
WHERE source_type = 'STORE_ORDER';

SELECT 'crm_interactions_source_type_store_order' AS check, COUNT(*) AS count
FROM app_v3.crm_interactions
WHERE source_type = 'STORE_ORDER';

SELECT 'invoices_source_type_store_order' AS check, COUNT(*) AS count
FROM app_v3.invoices
WHERE source_type = 'STORE_ORDER';

SELECT 'invoice_snapshots_source_type_store_order' AS check, COUNT(*) AS count
FROM app_v3.invoice_snapshots
WHERE source_type = 'STORE_ORDER';

SELECT 'entitlements_store_item' AS check, COUNT(*) AS count
FROM app_v3.entitlements
WHERE type = 'STORE_ITEM';
