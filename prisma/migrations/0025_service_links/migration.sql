CREATE TABLE IF NOT EXISTS app_v3.service_professionals (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL,
  professional_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_professionals_service_fk
    FOREIGN KEY (service_id) REFERENCES app_v3.services(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT service_professionals_professional_fk
    FOREIGN KEY (professional_id) REFERENCES app_v3.reservation_professionals(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT service_professional_unique UNIQUE (service_id, professional_id)
);

CREATE INDEX IF NOT EXISTS service_professionals_professional_idx
  ON app_v3.service_professionals (professional_id);

CREATE TABLE IF NOT EXISTS app_v3.service_resources (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL,
  resource_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_resources_service_fk
    FOREIGN KEY (service_id) REFERENCES app_v3.services(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT service_resources_resource_fk
    FOREIGN KEY (resource_id) REFERENCES app_v3.reservation_resources(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT service_resource_unique UNIQUE (service_id, resource_id)
);

CREATE INDEX IF NOT EXISTS service_resources_resource_idx
  ON app_v3.service_resources (resource_id);
