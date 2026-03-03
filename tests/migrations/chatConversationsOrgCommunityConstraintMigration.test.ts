import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("chat conversations ORG_COMMUNITY constraint migration", () => {
  it("atualiza chat_conversations_context_org_chk para aceitar ORG_COMMUNITY", () => {
    const migrationPath = path.join(
      process.cwd(),
      "prisma/migrations/20260303190000_chat_conversations_org_community_constraint/migration.sql",
    );
    const migration = fs.readFileSync(migrationPath, "utf8");

    expect(migration).toContain("DROP CONSTRAINT IF EXISTS chat_conversations_context_org_chk");
    expect(migration).toContain("ADD CONSTRAINT chat_conversations_context_org_chk");
    expect(migration).toContain("'ORG_COMMUNITY'");
  });
});
