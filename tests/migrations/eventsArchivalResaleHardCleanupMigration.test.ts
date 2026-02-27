import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readLocal(pathname: string) {
  return fs.readFileSync(path.join(process.cwd(), pathname), "utf8");
}

describe("events archival + resale hard cleanup migration", () => {
  it("normaliza estados legacy e remove revenda/arquivamento legado", () => {
    const migration = readLocal(
      "prisma/migrations/20260227113000_events_archival_resale_hard_cleanup/migration.sql",
    );

    expect(migration).toContain("WHERE status::text = 'ARCHIVED'");
    expect(migration).toContain("DROP COLUMN IF EXISTS archived_at");
    expect(migration).toContain("DROP COLUMN IF EXISTS resale_mode");
    expect(migration).toContain("DROP TABLE IF EXISTS app_v3.ticket_resales");
    expect(migration).toContain("'ResaleMode'");
    expect(migration).toContain("'ResaleStatus'");
  });
});

