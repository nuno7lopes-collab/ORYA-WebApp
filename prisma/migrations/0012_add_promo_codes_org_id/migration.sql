ALTER TABLE app_v3.promo_codes
  ADD COLUMN organization_id integer;

CREATE INDEX promo_codes_organization_id_idx
  ON app_v3.promo_codes (organization_id);

ALTER TABLE app_v3.promo_codes
  ADD CONSTRAINT promo_codes_organization_fk
  FOREIGN KEY (organization_id) REFERENCES app_v3.organizations(id) ON DELETE SET NULL;
