import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("event invite hard cleanup migration", () => {
  it("remove tabela event_invites e enum EventInviteScope legado", () => {
    const migrationPath = path.join(
      process.cwd(),
      "prisma/migrations/20260227232000_event_invites_hard_cleanup/migration.sql",
    );
    const migration = fs.readFileSync(migrationPath, "utf8");

    expect(migration).toContain("DROP TABLE IF EXISTS app_v3.event_invites");
    expect(migration).toContain('app_v3."EventInviteScope"');
    expect(migration).toContain('DROP TYPE app_v3."EventInviteScope"');
  });
});
