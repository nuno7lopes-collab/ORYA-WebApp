import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const TARGET_DIRS = [
  "app/org/_internal/core",
  "app/org/[orgId]",
];

const FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

const RAW_NAV_PATTERNS: Array<{ id: string; regex: RegExp }> = [
  { id: "raw_href_string", regex: /href\s*=\s*["']\/org\//g },
  { id: "raw_href_template", regex: /href\s*=\s*\{\s*`\/org\//g },
  { id: "raw_router_nav", regex: /router\.(?:push|replace)\(\s*["'`]\/org\//g },
  { id: "raw_window_open", regex: /window\.open\(\s*["'`]\/org\//g },
];

function collectSourceFiles(rootDir: string): string[] {
  if (!fs.existsSync(rootDir)) return [];
  const output: string[] = [];
  const queue = [rootDir];
  while (queue.length) {
    const current = queue.pop();
    if (!current) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!FILE_EXTENSIONS.has(path.extname(entry.name))) continue;
      output.push(absolute);
    }
  }
  return output;
}

describe("org navigation literals guardrail", () => {
  it("blocks direct /org literals in UI navigation points", () => {
    const files = TARGET_DIRS.flatMap((dir) => collectSourceFiles(path.join(process.cwd(), dir)));
    const violations: string[] = [];

    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      for (const pattern of RAW_NAV_PATTERNS) {
        const match = source.match(pattern.regex);
        if (!match || match.length === 0) continue;
        violations.push(`${path.relative(process.cwd(), file)} -> ${pattern.id} (${match.length})`);
      }
    }

    expect(violations).toEqual([]);
  });
});

