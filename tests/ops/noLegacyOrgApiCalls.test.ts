import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const ALLOWLIST_PREFIXES = [
  "app/api/organizacao/",
  "app/api/org/",
  "app/api/org-hub/",
  "app/api/org-system/",
  "app/docs/org-canonical-migration/page.tsx",
  "lib/canonicalOrgApiPath.ts",
];

const ALLOWLIST_FILES = new Set([
  "app/organizacao/(dashboard)/eventos/EventLivePrepClient.tsx",
  "app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx",
]);

const ALLOWLIST_LINE_PATTERNS = [
  /\/api\/organizacao\/(padel|tournaments|torneios)(\/|$)/i,
];

function isAllowlistedFile(file: string) {
  if (ALLOWLIST_FILES.has(file)) return true;
  if (/\/(padel|torneios|tournaments)\//i.test(file)) return true;
  return ALLOWLIST_PREFIXES.some((prefix) => file.startsWith(prefix));
}

describe("no legacy /api/organizacao calls outside compatibility zone", () => {
  it("blocks new runtime references to /api/organizacao", () => {
    let output = "";
    try {
      output = execFileSync(
        "rg",
        [
          "-n",
          "/api/organizacao",
          "app",
          "components",
          "lib",
          "domain",
          "apps/mobile",
          "--glob",
          "*.ts",
          "--glob",
          "*.tsx",
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ).trim();
    } catch (error) {
      const err = error as { status?: number };
      if (err.status !== 1) throw error;
    }

    const offenders = output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => {
        const [file, _lineNo, ...rest] = line.split(":");
        const text = rest.join(":");
        if (!file) return false;
        if (isAllowlistedFile(file)) return false;
        return !ALLOWLIST_LINE_PATTERNS.some((pattern) => pattern.test(text));
      });

    expect(Array.from(new Set(offenders))).toEqual([]);
  });
});
