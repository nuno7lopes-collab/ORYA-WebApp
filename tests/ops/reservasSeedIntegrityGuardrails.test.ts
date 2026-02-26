import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("reservas seed integrity guardrails", () => {
  it("mantém execução do gate no pipeline db:gates", () => {
    const dbGates = readLocal("scripts/db/gates.js");
    expect(dbGates).toContain("gate:reservas-seed-integrity");
  });

  it("mantém script npm oficial do gate e do backfill", () => {
    const packageJson = readLocal("package.json");
    expect(packageJson).toContain("gate:reservas-seed-integrity");
    expect(packageJson).toContain("reservas:backfill-confirmation-snapshots:dry");
    expect(packageJson).toContain("reservas:backfill-confirmation-snapshots:execute");
  });
});
