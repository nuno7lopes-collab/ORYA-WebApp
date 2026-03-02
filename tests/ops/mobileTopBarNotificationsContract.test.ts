import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("mobile topbar notifications contract", () => {
  it("desativa notificações de utilizador por omissão no topo mobile público", () => {
    const content = readFileSync("app/components/mobile/MobileTopBar.tsx", "utf8");
    expect(content).toContain("showNotifications = false");
  });

  it("só consulta o feed de notificações quando o sino está ativo", () => {
    const content = readFileSync("app/components/mobile/MobileTopBar.tsx", "utf8");
    expect(content).toContain("showNotifications && isLoggedIn");
    expect(content).toContain("/api/me/notifications/feed?limit=1&scope=user");
  });
});
