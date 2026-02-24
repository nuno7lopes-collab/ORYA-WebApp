import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("bookings operations ux guardrails", () => {
  it("keeps operational mode context and empty-state actions visible", () => {
    const operationsPage = readLocal("app/org/_internal/core/(dashboard)/reservas/page.tsx");

    expect(operationsPage).toContain("resolveOrganizationOperationalMode");
    expect(operationsPage).toContain("Operações focadas em reservas");
    expect(operationsPage).toContain("Criar reserva agora");
    expect(operationsPage).toContain("queueEmptyDescription");
    expect(operationsPage).toContain("Gerir disponibilidade");
  });
});

