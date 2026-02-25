import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("waves section layout contract", () => {
  it("suporta layout rail sem quebrar default panel", () => {
    const source = readLocal("app/eventos/[slug]/WavesSectionClient.tsx");

    expect(source).toContain('layout?: "rail" | "panel"');
    expect(source).toContain('layout = "panel"');
    expect(source).toContain('if (layout === "rail")');
    expect(source).toContain('data-testid="event-purchase-rail"');
    expect(source).toContain('data-testid="event-purchase-panel"');
  });
});
