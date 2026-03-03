-- Remove legacy unique index that blocks repeated interactions by source.
DROP INDEX IF EXISTS app_v3.crm_interactions_org_source_type_unique;
