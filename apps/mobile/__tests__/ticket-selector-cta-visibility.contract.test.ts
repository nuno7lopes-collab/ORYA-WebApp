import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sheetPath = resolve(
  process.cwd(),
  "components/events/detail/TicketSelectorSheet.tsx",
);

describe("ticket selector sheet CTA contract", () => {
  it("shows CTA only when there is at least one selected ticket", () => {
    const file = readFileSync(sheetPath, "utf8");
    expect(file).toContain("const selectedQuantity = items.reduce(");
    expect(file).toContain("const showSubmit = selectedQuantity > 0");
    expect(file).toContain("const submitDisabled = !showSubmit");
  });

  it("renders submit button as full-width in footer", () => {
    const file = readFileSync(sheetPath, "utf8");
    expect(file).toContain('width: "100%"');
    expect(file).toContain("footerTopRow");
    expect(file).toContain("const sheetHeightRatio = items.length <=");
    expect(file).toContain("style={[styles.sheet, { height: sheetHeight, transform: [{ translateY }] }]}");
  });
});
