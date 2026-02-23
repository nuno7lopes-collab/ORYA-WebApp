import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "scripts", "manifests", "p0_endpoints.json");

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(MANIFEST_PATH)) {
  fail("V9 P0 policy gate: missing scripts/manifests/p0_endpoints.json");
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
} catch (error) {
  fail(`V9 P0 policy gate: invalid manifest JSON (${error instanceof Error ? error.message : String(error)})`);
}

const endpoints = Array.isArray(manifest?.endpoints) ? manifest.endpoints : [];
const endpointSet = new Set();
for (const value of endpoints) {
  if (typeof value !== "string") continue;
  const relPath = value.trim();
  if (!/^app\/api\/.+\/route\.(ts|tsx|js|jsx)$/.test(relPath)) continue;
  endpointSet.add(relPath);
}

const disabledList = Array.isArray(manifest?.policies?.disabledByPolicy)
  ? manifest.policies.disabledByPolicy
  : [];

const issues = [];

for (const [index, entry] of disabledList.entries()) {
  if (!entry || typeof entry !== "object") {
    issues.push(`idx=${index} invalid_entry`);
    continue;
  }
  const relPath = typeof entry.path === "string" ? entry.path.trim() : "";
  const label = typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : "";
  const status = typeof entry.status === "number" ? entry.status : null;
  const errorCode = typeof entry.errorCode === "string" && entry.errorCode.trim()
    ? entry.errorCode.trim()
    : "";

  if (!/^app\/api\/.+\/route\.(ts|tsx|js|jsx)$/.test(relPath)) {
    issues.push(`idx=${index} invalid_path`);
    continue;
  }
  if (label !== "DISABLED_BY_POLICY") {
    issues.push(`path=${relPath} label_must_be_DISABLED_BY_POLICY`);
  }
  if (status !== 410) {
    issues.push(`path=${relPath} status_must_be_410`);
  }
  if (!errorCode) {
    issues.push(`path=${relPath} errorCode_missing`);
  }
  if (!endpointSet.has(relPath)) {
    issues.push(`path=${relPath} not_listed_in_endpoints`);
  }

  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    issues.push(`path=${relPath} file_missing`);
    continue;
  }

  const content = fs.readFileSync(absPath, "utf8");
  if (!/\bstatus\s*:\s*410\b/.test(content)) {
    issues.push(`path=${relPath} missing_status_410_on_disk`);
  }
  if (errorCode && !content.includes(errorCode)) {
    issues.push(`path=${relPath} missing_errorCode_${errorCode}_on_disk`);
  }
}

if (issues.length > 0) {
  console.error("V9 P0 policy gate failed:");
  for (const issue of issues.slice(0, 30)) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(`V9 P0 policy gate: OK (${disabledList.length} disabled-by-policy endpoints)`);
