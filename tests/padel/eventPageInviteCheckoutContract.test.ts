import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("event page invite checkout contract", () => {
  it("alinha seleção de ticket com categoria da dupla e propaga categoryLinkId", () => {
    const source = readLocal("app/eventos/[slug]/EventPageClient.tsx");

    expect(source).toContain("resolvePairingTicketSelection");
    expect(source).toContain("pairingCategoryId");
    expect(source).toContain("padelCategoryLinkId");
    expect(source).toContain("categoryLinkId: ticketSelection.categoryLinkId");
  });
});
