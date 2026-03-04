import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("searchable entity select", () => {
  it("renderiza dropdown em portal fixed para evitar clipping", () => {
    const source = readLocal("app/org/[orgId]/calendar/_components/day/SearchableEntitySelect.tsx");
    expect(source).toContain("createPortal");
    expect(source).toContain('position: "fixed"');
    expect(source).toContain("panelRef.current?.contains(target)");
    expect(source).toContain("window.addEventListener(\"scroll\", handleResize, true)");
  });

  it("mantém seleção multi sem chips dentro do trigger", () => {
    const source = readLocal("app/org/[orgId]/calendar/_components/day/SearchableEntitySelect.tsx");
    expect(source).toContain("onChange([...next])");
    expect(source).toContain("selecionados");
    expect(source).not.toContain("selectedOptions.slice(0, 2)");
  });
});
