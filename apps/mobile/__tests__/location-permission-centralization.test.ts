import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = ["app", "components", "features", "lib"] as const;
const ALLOWED_PERMISSION_FILES = new Set(["lib/locationConsent.ts"]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

const FORBIDDEN_PATTERNS = [
  "requestForegroundPermissionsAsync(",
  "getForegroundPermissionsAsync(",
] as const;

const walkFiles = (dir: string, results: string[]) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".expo" || entry.name === "dist") continue;
      walkFiles(next, results);
      continue;
    }
    const ext = path.extname(entry.name);
    if (!SOURCE_EXTENSIONS.has(ext)) continue;
    results.push(next);
  }
};

describe("location permission centralization", () => {
  it("keeps permission prompts only inside lib/locationConsent.ts", () => {
    const files: string[] = [];
    for (const folder of SCAN_DIRS) {
      walkFiles(path.join(ROOT, folder), files);
    }

    const violations: Array<{ file: string; pattern: string }> = [];

    for (const absoluteFile of files) {
      const relative = path.relative(ROOT, absoluteFile).replace(/\\/g, "/");
      if (ALLOWED_PERMISSION_FILES.has(relative)) continue;

      const source = fs.readFileSync(absoluteFile, "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (source.includes(pattern)) {
          violations.push({ file: relative, pattern });
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
