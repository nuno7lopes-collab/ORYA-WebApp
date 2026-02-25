import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("event share button contract", () => {
  it("usa shareLink e feedback de partilha", () => {
    const source = readLocal("app/eventos/[slug]/EventShareButton.tsx");

    expect(source).toContain("shareLink");
    expect(source).toContain("Partilhar");
    expect(source).toContain("Link copiado.");
  });
});
