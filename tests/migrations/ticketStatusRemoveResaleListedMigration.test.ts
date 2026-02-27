import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("ticket status remove resale listed migration", () => {
  it("normaliza RESALE_LISTED e recria enum TicketStatus sem revenda", () => {
    const migrationPath = path.join(
      process.cwd(),
      "prisma/migrations/20260227143000_ticket_status_remove_resale_listed/migration.sql",
    );
    const migration = fs.readFileSync(migrationPath, "utf8");
    const enumBlock = migration
      .split("CREATE TYPE app_v3.\"TicketStatus_v2\" AS ENUM")[1]
      ?.split(");")[0] ?? "";

    expect(migration).toContain("WHERE status::text = 'RESALE_LISTED'");
    expect(migration).toContain("CREATE TYPE app_v3.\"TicketStatus_v2\" AS ENUM");
    expect(migration).toContain("'DISPUTED'");
    expect(migration).toContain("'CHARGEBACK_LOST'");
    expect(enumBlock).not.toContain("RESALE_LISTED");
    expect(migration).toContain("DROP TYPE app_v3.\"TicketStatus\"");
    expect(migration).toContain("ALTER TYPE app_v3.\"TicketStatus_v2\" RENAME TO \"TicketStatus\"");
  });
});
