import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const CODE_ROOTS = [
  path.join(ROOT, "app"),
  path.join(ROOT, "lib"),
  path.join(ROOT, "domain"),
];
const CODE_EXT = /\.(ts|tsx|js|jsx)$/;

const ALLOWLIST = new Set([
  "lib/organizationIdUtils.ts",
]);

const LOCAL_PARSER_PATTERNS = [
  /\bfunction\s+parseOrganizationId\s*\(/,
  /\bconst\s+parseOrganizationId\s*=\s*\(/,
  /\blet\s+parseOrganizationId\s*=\s*\(/,
];

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(full));
      continue;
    }
    if (CODE_EXT.test(entry.name)) files.push(full);
  }
  return files;
}

const violations = [];

for (const root of CODE_ROOTS) {
  for (const file of listFiles(root)) {
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    if (ALLOWLIST.has(rel)) continue;
    const content = fs.readFileSync(file, "utf8");
    const hasLocalParser = LOCAL_PARSER_PATTERNS.some((pattern) => pattern.test(content));
    if (!hasLocalParser) continue;
    violations.push(rel);
  }
}

if (violations.length > 0) {
  console.error("\n[ORG ID PARSER GATE] Local parseOrganizationId definitions are forbidden:");
  for (const rel of violations) {
    console.error(`- ${rel}`);
  }
  console.error("\nUse parseOrganizationId from lib/organizationIdUtils.ts.");
  process.exit(1);
}

console.log("V9 org-id parser gate: OK");
