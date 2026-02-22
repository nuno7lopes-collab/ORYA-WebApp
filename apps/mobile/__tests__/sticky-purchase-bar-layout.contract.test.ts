import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const stickyPath = resolve(
  process.cwd(),
  "components/events/detail/StickyPurchaseBar.tsx",
);

describe("sticky purchase bar layout contract", () => {
  it("mantém layout em linha única com CTA à direita", () => {
    const file = readFileSync(stickyPath, "utf8");
    expect(file).toContain("flexDirection: \"row\"");
    expect(file).toContain("flexWrap: \"nowrap\"");
    expect(file).toContain("maxWidth: \"34%\"");
    expect(file).toContain("flex: 1");
    expect(file).toContain("marginLeft: \"auto\"");
  });
});
