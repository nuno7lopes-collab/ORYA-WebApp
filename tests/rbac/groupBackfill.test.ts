import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("D14 backfill org groupId", () => {
  it("migration 0060 backfills groups for existing orgs", () => {
    const migrationPath = path.join(
      process.cwd(),
      "prisma/migrations/0060_add_org_groups_v7/migration.sql",
    );
    const sql = fs.readFileSync(migrationPath, "utf8").toLowerCase();
    expect(sql).toContain("insert into app_v3.organization_groups");
    expect(sql).toContain("update app_v3.organizations");
    expect(sql).toContain("set group_id");
  });
});
