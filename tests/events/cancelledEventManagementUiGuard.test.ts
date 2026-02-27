import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readLocal(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("cancelled event management ui guard", () => {
  it("não exibe botão Operação no card/lista quando estado é CANCELLED", () => {
    const file = readLocal("app/org/_internal/core/DashboardClient.tsx");
    expect(file).toContain('ev.status !== "CANCELLED" ? (');
  });

  it("bloqueia atalhos operacionais no detalhe quando evento está cancelado", () => {
    const file = readLocal("app/org/_internal/core/(dashboard)/eventos/[id]/page.tsx");
    expect(file).toContain("!standardEventCancelled && (");
    expect(file).toContain("Evento cancelado em estado terminal");
  });
});
