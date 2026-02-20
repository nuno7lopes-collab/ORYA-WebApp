import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const eventDetailPath = resolve(
  process.cwd(),
  "app/event/[slug].tsx",
);

describe("event ticket sheet contract", () => {
  it("uses Finalizar compra copy and does not use Escolher bilhetes state", () => {
    const file = readFileSync(eventDetailPath, "utf8");
    expect(file).toContain('t("events:tickets.sheet.submit.default")');
    expect(file).not.toContain('t("events:tickets.sheet.submit.select")');
  });

  it("keeps submit CTA gated by selected quantity", () => {
    const file = readFileSync(eventDetailPath, "utf8");
    expect(file).toContain("hasSelection={selectedTicketQuantity > 0}");
  });
});
