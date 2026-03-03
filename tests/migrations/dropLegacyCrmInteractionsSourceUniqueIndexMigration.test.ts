import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("drop legacy CRM interactions source unique index migration", () => {
  it("remove crm_interactions_org_source_type_unique", () => {
    const migrationPath = path.join(
      process.cwd(),
      "prisma/migrations/20260303194000_drop_legacy_crm_interactions_source_unique_index/migration.sql",
    );
    const migration = fs.readFileSync(migrationPath, "utf8");

    expect(migration).toContain("DROP INDEX IF EXISTS app_v3.crm_interactions_org_source_type_unique");
  });
});
