import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("legacy purge padel script cleanup", () => {
  it("script antigo foi removido", () => {
    const filePath = path.join(process.cwd(), "scripts", "purge_padel_total.js");
    expect(fs.existsSync(filePath)).toBe(false);
  });
});
