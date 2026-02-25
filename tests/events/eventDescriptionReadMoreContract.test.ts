import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("event description read more contract", () => {
  it("expande apenas uma vez quando há overflow", () => {
    const source = readLocal("app/eventos/[slug]/EventDescriptionReadMore.tsx");

    expect(source).toContain("scrollHeight > paragraph.clientHeight");
    expect(source).toContain("setExpanded(true)");
    expect(source).not.toContain("setExpanded(false)");
    expect(source).toContain('t("readMoreLabel", locale)');
  });
});
