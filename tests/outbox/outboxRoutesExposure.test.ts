import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const API_DIR = path.join(ROOT, "app", "api");

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else if (entry.isFile()) {
      acc.push(full);
    }
  }
  return acc;
}

describe("Outbox internal routes exposure", () => {
  it("não expõe dlq/replay/backfill fora de /api/internal", () => {
    const files = walk(API_DIR);
    const offenders = files.filter((file) => {
      const rel = file.replace(API_DIR + path.sep, "");
      if (!rel.includes("outbox")) return false;
      return !rel.startsWith(`internal${path.sep}`);
    });

    expect(offenders).toEqual([]);
  });
});
