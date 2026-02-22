import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("rounds advance usa arbitragem canónica do calendário", () => {
  it("reutiliza gateway de agenda e conflitos de aula/reserva", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/api/padel/rounds/advance/route.ts"),
      "utf8",
    );

    expect(source).toContain("buildExistingByCourt");
    expect(source).toContain("evaluateMatchBatchAgainstAgenda");
    expect(source).toContain("prisma.booking.findMany");
    expect(source).toContain("prisma.classSession.findMany");
    expect(source).toContain("skippedByMatch");
  });
});

