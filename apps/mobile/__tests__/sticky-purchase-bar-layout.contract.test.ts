import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const stickyPath = resolve(
  process.cwd(),
  "components/events/detail/StickyPurchaseBar.tsx",
);

describe("sticky purchase bar layout contract", () => {
  it("enforces a horizontal one-line row for price and CTA", () => {
    const file = readFileSync(stickyPath, "utf8");
    expect(file).toContain('flexDirection: "row"');
    expect(file).toContain('flexWrap: "nowrap"');
    expect(file).toContain('justifyContent: "space-between"');
  });
});
