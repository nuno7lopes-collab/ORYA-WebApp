import { describe, expect, it } from "vitest";

async function readRoute(pathname: string) {
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("paid write gate coverage", () => {
  it("aplica evaluatePaidWriteGate nas rotas de preço de Reservas", async () => {
    const routes = [
      "app/api/org/[orgId]/servicos/route.ts",
      "app/api/org/[orgId]/servicos/[id]/route.ts",
      "app/api/org/[orgId]/servicos/[id]/addons/route.ts",
      "app/api/org/[orgId]/servicos/[id]/addons/[addonId]/route.ts",
      "app/api/org/[orgId]/servicos/[id]/packages/route.ts",
      "app/api/org/[orgId]/servicos/[id]/packages/[packageId]/route.ts",
      "app/api/org/[orgId]/servicos/[id]/packs/route.ts",
      "app/api/org/[orgId]/servicos/[id]/packs/[packId]/route.ts",
    ];

    for (const route of routes) {
      const file = await readRoute(route);
      expect(file).toContain("evaluatePaidWriteGate");
      expect(file).toContain("paidWriteGate.errorCode");
      expect(file).toContain("details: paidWriteGate.details");
    }
  });

  it("aplica evaluatePaidWriteGate nas rotas de preço da Loja", async () => {
    const routes = [
      "app/api/org/[orgId]/store/products/route.ts",
      "app/api/org/[orgId]/store/products/[id]/route.ts",
      "app/api/org/[orgId]/store/products/[id]/variants/route.ts",
      "app/api/org/[orgId]/store/products/[id]/variants/[variantId]/route.ts",
      "app/api/org/[orgId]/store/products/[id]/options/route.ts",
      "app/api/org/[orgId]/store/products/[id]/options/[optionId]/route.ts",
      "app/api/org/[orgId]/store/products/[id]/options/[optionId]/values/route.ts",
      "app/api/org/[orgId]/store/products/[id]/options/[optionId]/values/[valueId]/route.ts",
      "app/api/org/[orgId]/store/bundles/route.ts",
      "app/api/org/[orgId]/store/bundles/[id]/route.ts",
    ];

    for (const route of routes) {
      const file = await readRoute(route);
      expect(file).toContain("evaluatePaidWriteGate");
      expect(file).toContain("paidWriteGate.errorCode");
      expect(file).toContain("details: paidWriteGate.details");
    }
  });
});
