import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readLocal(pathname: string) {
  return fs.readFileSync(path.join(process.cwd(), pathname), "utf8");
}

describe("finance source integrity guards migration", () => {
  it("inclui triggers para bloquear fontes invalidas e drift de source entre tabelas financeiras", () => {
    const migration = readLocal(
      "prisma/migrations/20260227003000_finance_source_integrity_guards/migration.sql",
    );

    expect(migration).toContain("enforce_payment_source_integrity");
    expect(migration).toContain("payments_source_integrity_trg");
    expect(migration).toContain("PAYMENT_SOURCE_NOT_FOUND");
    expect(migration).toContain("enforce_ledger_entry_source_matches_payment");
    expect(migration).toContain("ledger_entries_source_matches_payment_trg");
    expect(migration).toContain("LEDGER_SOURCE_MISMATCH");
    expect(migration).toContain("enforce_payment_snapshot_source_matches_payment");
    expect(migration).toContain("payment_snapshots_source_matches_payment_trg");
    expect(migration).toContain("PAYMENT_SNAPSHOT_SOURCE_MISMATCH");
  });
});
