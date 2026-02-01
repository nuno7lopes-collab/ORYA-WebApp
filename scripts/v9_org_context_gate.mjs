import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const API_ROOT = path.join(ROOT, "app", "api", "organizacao");
const ROUTE_REGEX = /\/route\.(ts|tsx|js|jsx)$/;

const ALLOWLIST = new Set([
  "app/api/organizacao/payouts/webhook/route.ts",
  "app/api/organizacao/invites/route.ts",
]);

const REQUIRED_MARKERS = [
  "getActiveOrganizationForUser",
  "getActiveOrganizationForUserForWrite",
  "ensureOrganizationContext",
  "setActiveOrganizationForUser",
  "requireOrganizationIdFromRequest",
  "requireOrganizationIdFromPayload",
  "resolveGroupMemberForOrg",
  "ensureGroupMemberForOrg",
  "ensureMemberModuleAccess",
  "ensureGroupMemberModuleAccess",
  "ensureMemberCheckinAccess",
  "ensureGroupMemberCheckinAccess",
  "requireInternalSecret",
  "requireAdminUser",
];

function listFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

const files = fs.existsSync(API_ROOT) ? listFiles(API_ROOT).filter((f) => ROUTE_REGEX.test(f)) : [];

const violations = [];

for (const file of files) {
  const rel = path.relative(ROOT, file);
  if (ALLOWLIST.has(rel)) continue;
  const content = fs.readFileSync(file, "utf8");
  const hasMarker = REQUIRED_MARKERS.some((marker) => content.includes(marker));
  if (!hasMarker) {
    violations.push(rel);
  }
}

if (violations.length > 0) {
  console.error("\n[ORG CONTEXT GATE] Missing org context guard in routes:");
  violations.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log("V9 org context gate: OK");
