import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("bookings module guardrails", () => {
  it("guards /bookings routes behind RESERVAS module access", () => {
    const layout = readLocal("app/org/[orgId]/bookings/layout.tsx");

    expect(layout).toContain("ModuleGuardLayout");
    expect(layout).toContain('requiredModules={["RESERVAS"]}');
    expect(layout).toContain('redirectTo="/org/calendar"');
  });
});

