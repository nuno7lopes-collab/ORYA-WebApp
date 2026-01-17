ALTER TABLE app_v3.store_orders
  ADD COLUMN shipping_zone_id integer,
  ADD COLUMN shipping_method_id integer;

ALTER TABLE app_v3.store_orders
  ADD CONSTRAINT store_orders_shipping_zone_fk
  FOREIGN KEY (shipping_zone_id) REFERENCES app_v3.store_shipping_zones(id)
  ON DELETE SET NULL;

ALTER TABLE app_v3.store_orders
  ADD CONSTRAINT store_orders_shipping_method_fk
  FOREIGN KEY (shipping_method_id) REFERENCES app_v3.store_shipping_methods(id)
  ON DELETE SET NULL;

CREATE INDEX store_orders_shipping_zone_idx
  ON app_v3.store_orders (shipping_zone_id);

CREATE INDEX store_orders_shipping_method_idx
  ON app_v3.store_orders (shipping_method_id);
