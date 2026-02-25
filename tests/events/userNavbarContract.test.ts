import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("user navbar contract", () => {
  it("mantem shell reta e estado de scroll com hysteresis", () => {
    const source = readLocal("app/components/Navbar.tsx");

    expect(source).toContain('data-testid="user-navbar-shell"');
    expect(source).toContain("data-nav-phase={navPhase}");
    expect(source).toContain("currentY > 88 && scrollTrendRef.current.down > 20");
    expect(source).toContain("scrollTrendRef.current.up > 16");
    expect(source).not.toContain("rounded-b-[24px]");
  });

  it("alinha o topbar mobile publico com a mesma shell de user", () => {
    const source = readLocal("app/components/mobile/MobileTopBar.tsx");

    expect(source).toContain("orya-mobile-topbar orya-user-nav-shell");
  });
});
