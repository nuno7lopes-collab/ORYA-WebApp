import { describe, expect, it } from "vitest";

async function readFile(pathname: string) {
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("payments UX CTA guardrail", () => {
  it("reservas novo mapeia erros canónicos para CTA", async () => {
    const file = await readFile("app/org/_internal/core/(dashboard)/reservas/novo/page.tsx");
    expect(file).toContain("mapPaymentGateUiState");
    expect(file).toContain("parseApiError");
    expect(file).toContain("setErrorCtaHref");
  });

  it("reservas detalhe mapeia erros canónicos para CTA", async () => {
    const file = await readFile("app/org/_internal/core/(dashboard)/reservas/[id]/page.tsx");
    expect(file).toContain("mapPaymentGateUiState");
    expect(file).toContain("setServiceErrorCtaHref");
  });

  it("loja mostra CTA em PAYMENTS_NOT_READY", async () => {
    const activationFile = await readFile("components/store/StoreActivationCard.tsx");
    const clientFile = await readFile("app/org/[orgId]/store/OrgStoreToolClient.tsx");
    expect(activationFile).toContain("mapPaymentGateUiState");
    expect(activationFile).toContain("error.ctaHref");
    expect(clientFile).toContain("buildStoreUiError");
    expect(clientFile).toContain("storeError.ctaHref");
  });
});
