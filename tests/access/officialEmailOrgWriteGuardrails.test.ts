import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const ORG_API_DIR = path.join(ROOT, "app/api/org");

const METHOD_RE = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/;
const GATE_PATTERNS: RegExp[] = [
  /ensureOrganizationEmailVerified/,
  /requireOfficialEmailVerified/,
  /ensureOrganizationWriteAccess/,
  /ensureLojaModuleAccess/,
  /ensureReservasModuleAccess/,
  /requireVerifiedEmail/,
  /ensureMemberModuleAccess/,
];

const ALLOWLIST: Record<string, string> = {
  "app/api/org-hub/organizations/route.ts": "org creation (no email yet)",
  "app/api/org-hub/organizations/switch/route.ts": "context switch (read-only mutation)",
  "app/api/org-hub/become/route.ts": "onboarding flow (pre-email)",
  "app/api/org-hub/organizations/settings/official-email/route.ts": "email setup endpoint",
  "app/api/org-hub/organizations/settings/official-email/confirm/route.ts": "email confirm endpoint",
};

function walk(dir: string, files: string[] = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (entry.isFile() && entry.name === "route.ts") {
      files.push(full);
    }
  }
  return files;
}

describe("official email guardrails for org writes", () => {
  it("requires official email gate or explicit allowlist", () => {
    const files = walk(ORG_API_DIR);
    const missing: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      if (!METHOD_RE.test(content)) continue;

      const rel = path.relative(ROOT, file).replace(/\\/g, "/");
      if (ALLOWLIST[rel]) continue;

      const hasGate = GATE_PATTERNS.some((pattern) => pattern.test(content));
      if (!hasGate) {
        missing.push(rel);
      }
    }

    expect(
      missing,
      `Missing official email gate in org write routes:\n${missing.join("\n")}`,
    ).toEqual([]);
  });
});
