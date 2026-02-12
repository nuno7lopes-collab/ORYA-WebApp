import { describe, expect, it } from "vitest";
import {
  PUBLIC_PROFILE_DEFAULT_ORDER,
  ensurePublicProfileLayout,
  sanitizePublicProfileLayout,
} from "@/lib/publicProfileLayout";

describe("public profile layout v2", () => {
  it("returns v2 default order", () => {
    const layout = ensurePublicProfileLayout(null);
    expect(layout.version).toBe(2);
    expect(layout.modules.map((moduleItem) => moduleItem.type)).toEqual(PUBLIC_PROFILE_DEFAULT_ORDER);
  });

  it("migrates legacy v1 module names into canonical v2 names", () => {
    const legacy = {
      version: 1,
      modules: [
        { type: "SERVICOS", enabled: true, width: "full" },
        { type: "AGENDA", enabled: true, width: "full" },
        { type: "FORMULARIOS", enabled: true, width: "half" },
        { type: "AVALIACOES", enabled: true, width: "half", settings: { maxItems: 4 } },
        { type: "SOBRE", enabled: true, width: "half" },
        { type: "LOJA", enabled: false, width: "half" },
      ],
    };

    const layout = ensurePublicProfileLayout(legacy);
    const moduleTypes = layout.modules.map((moduleItem) => moduleItem.type);

    expect(layout.version).toBe(2);
    expect(moduleTypes).toContain("SERVICES");
    expect(moduleTypes).toContain("EVENTS_AGENDA");
    expect(moduleTypes).toContain("FORMS");
    expect(moduleTypes).toContain("GALLERY");
    expect(moduleTypes).toContain("ABOUT");
    expect(moduleTypes).toContain("STORE");
    expect(moduleTypes).toContain("HERO");
    expect(moduleTypes).toContain("FAQ");
    expect(moduleTypes).toContain("CONTACT");

    const gallery = layout.modules.find((moduleItem) => moduleItem.type === "GALLERY");
    expect(gallery?.settings?.maxItems).toBe(4);
  });

  it("sanitizer ignores unknown modules and deduplicates by type", () => {
    const result = sanitizePublicProfileLayout({
      version: 2,
      modules: [
        { type: "SERVICES", enabled: true, width: "full" },
        { type: "SERVICES", enabled: false, width: "half" },
        { type: "UNKNOWN", enabled: true, width: "full" },
      ],
    });

    expect(result).not.toBeNull();
    expect(result?.modules).toHaveLength(1);
    expect(result?.modules[0]?.type).toBe("SERVICES");
  });
});
