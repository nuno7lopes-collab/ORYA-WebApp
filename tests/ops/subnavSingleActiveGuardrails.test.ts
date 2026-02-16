import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("subnav single-active guardrails", () => {
  it("tool subnav shell resolves a single active item", () => {
    const content = readLocal("app/org/_components/subnav/ToolSubnavShell.tsx");
    expect(content).toContain("const activeCandidates = scoredItems.filter((entry) => entry.customActive);");
    expect(content).toContain("const activeIndex =");
    expect(content).toContain("const active = index === activeIndex;");
    expect(content).toContain('aria-current={active ? "page" : undefined}');
  });

  it("check-in subnav gives mode param precedence per tab", () => {
    const content = readLocal("app/org/_components/subnav/CheckInSubnav.tsx");
    expect(content).toContain('if (mode) return mode === "scanner";');
    expect(content).toContain('if (mode) return mode === "list";');
    expect(content).toContain('if (mode) return mode === "sessions";');
    expect(content).toContain('if (mode) return mode === "logs";');
    expect(content).toContain('if (mode) return mode === "devices";');
  });
});
