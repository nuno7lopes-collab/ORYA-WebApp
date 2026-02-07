import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("purge padel script", () => {
  it("requires confirm flag and supports dry-run", () => {
    const filePath = path.join(process.cwd(), "scripts", "purge_padel_total.js");
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toMatch(/--confirm/);
    expect(content).toMatch(/--dry-run/);
    expect(content).toMatch(/purge-padel/);
  });
});
