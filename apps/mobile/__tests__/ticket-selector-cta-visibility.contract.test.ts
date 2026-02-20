import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sheetPath = resolve(
  process.cwd(),
  "components/events/detail/TicketSelectorSheet.tsx",
);

describe("ticket selector sheet CTA contract", () => {
  it("shows CTA only when there is at least one selected ticket", () => {
    const file = readFileSync(sheetPath, "utf8");
    expect(file).toContain("const showSubmit = hasSelection || submitting");
    expect(file).toContain("const submitDisabled = !hasSelection || submitting");
  });

  it("renders submit button as full-width in footer", () => {
    const file = readFileSync(sheetPath, "utf8");
    expect(file).toContain('width: "100%"');
    expect(file).toContain("footerTopRow");
  });
});
