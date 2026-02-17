import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const MIN_TOUCH_TARGET = 44;
const ROOT = process.cwd();
const MOBILE_FOLDERS = ["apps/mobile/app", "apps/mobile/components"];

function walkTsxFiles(relativeDir: string): string[] {
  const absRoot = resolve(ROOT, relativeDir);
  const files: string[] = [];
  const stack = [absRoot];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const entries = readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const next = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
        continue;
      }
      if (entry.isFile() && next.endsWith(".tsx")) {
        files.push(next);
      }
    }
  }

  return files;
}

function lineViolations(content: string, pattern: RegExp, mapper: (line: string, match: RegExpExecArray) => string | null) {
  const violations: string[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = pattern.exec(line);
    if (!match) continue;
    const mapped = mapper(line, match);
    if (mapped) {
      violations.push(`L${i + 1}: ${mapped}`);
    }
  }
  return violations;
}

describe("mobile touch-target guardrails", () => {
  it("forbids reduced touchTarget offsets", () => {
    const offenders: string[] = [];
    const pattern = /tokens\.layout\.touchTarget\s*-\s*(\d+)/;

    for (const folder of MOBILE_FOLDERS) {
      for (const file of walkTsxFiles(folder)) {
        const content = readFileSync(file, "utf8");
        const violations = lineViolations(content, pattern, (line) => line.trim());
        if (violations.length > 0) {
          const relative = file.replace(`${ROOT}/`, "");
          offenders.push(`${relative}\n  ${violations.join("\n  ")}`);
        }
      }
    }

    expect(offenders, `touchTarget offset violations:\n${offenders.join("\n\n")}`).toEqual([]);
  });

  it("forbids minHeight below AA touch target", () => {
    const offenders: string[] = [];
    const pattern = /minHeight:\s*(\d+)/;

    for (const folder of MOBILE_FOLDERS) {
      for (const file of walkTsxFiles(folder)) {
        const content = readFileSync(file, "utf8");
        const violations = lineViolations(content, pattern, (line, match) => {
          const value = Number(match[1]);
          if (!Number.isFinite(value) || value >= MIN_TOUCH_TARGET) return null;
          return `${line.trim()} (minHeight=${value})`;
        });
        if (violations.length > 0) {
          const relative = file.replace(`${ROOT}/`, "");
          offenders.push(`${relative}\n  ${violations.join("\n  ")}`);
        }
      }
    }

    expect(offenders, `minHeight violations:\n${offenders.join("\n\n")}`).toEqual([]);
  });
});
