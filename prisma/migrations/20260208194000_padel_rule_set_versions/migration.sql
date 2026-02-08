CREATE TABLE IF NOT EXISTS "app_v3"."padel_rule_set_versions" (
  "env" TEXT NOT NULL DEFAULT 'prod',
  "id" SERIAL PRIMARY KEY,
  "tournament_config_id" INTEGER NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "source_rule_set_id" INTEGER,
  "name" TEXT NOT NULL,
  "tie_break_rules" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "points_table" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "enabled_formats" TEXT[] NOT NULL DEFAULT ARRAY['TODOS_CONTRA_TODOS','QUADRO_ELIMINATORIO']::TEXT[],
  "season" TEXT,
  "year" INTEGER,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_by_user_id" UUID
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_rule_set_versions_config_version_uq'
  ) THEN
    ALTER TABLE "app_v3"."padel_rule_set_versions"
      ADD CONSTRAINT "padel_rule_set_versions_config_version_uq"
      UNIQUE ("tournament_config_id", "version");
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "padel_rule_set_versions_config_idx"
  ON "app_v3"."padel_rule_set_versions" ("tournament_config_id");

CREATE INDEX IF NOT EXISTS "padel_rule_set_versions_source_idx"
  ON "app_v3"."padel_rule_set_versions" ("source_rule_set_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_rule_set_versions_tournament_fk'
  ) THEN
    ALTER TABLE "app_v3"."padel_rule_set_versions"
      ADD CONSTRAINT "padel_rule_set_versions_tournament_fk"
      FOREIGN KEY ("tournament_config_id")
      REFERENCES "app_v3"."padel_tournament_configs"("id")
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'padel_rule_set_versions_source_fk'
  ) THEN
    ALTER TABLE "app_v3"."padel_rule_set_versions"
      ADD CONSTRAINT "padel_rule_set_versions_source_fk"
      FOREIGN KEY ("source_rule_set_id")
      REFERENCES "app_v3"."padel_rule_sets"("id")
      ON DELETE SET NULL;
  END IF;
END$$;
