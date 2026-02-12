import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SSOT_PATH = path.join(ROOT, "docs", "ssot_registry_v1.md");
const MANIFEST_PATH = path.join(ROOT, "scripts", "manifests", "p0_endpoints.json");
const START_MARKER = "<!-- P0_ENDPOINTS_START -->";
const END_MARKER = "<!-- P0_ENDPOINTS_END -->";
const CHECK_ONLY = process.argv.includes("--check");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function loadManifestEndpoints() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    fail(`Missing ${path.relative(ROOT, MANIFEST_PATH)}`);
  }
  const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(`Invalid JSON in ${path.relative(ROOT, MANIFEST_PATH)}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const endpoints = Array.isArray(parsed?.endpoints) ? parsed.endpoints : null;
  if (!endpoints || endpoints.length === 0) {
    fail("P0 manifest must contain a non-empty endpoints array.");
  }
  const normalized = [];
  const seen = new Set();
  for (const value of endpoints) {
    if (typeof value !== "string") {
      fail("All manifest endpoints must be strings.");
    }
    const endpoint = value.trim();
    if (!/^app\/api\/.+\/route\.(ts|tsx|js|jsx)$/.test(endpoint)) {
      fail(`Invalid endpoint path in manifest: ${endpoint}`);
    }
    if (seen.has(endpoint)) continue;
    seen.add(endpoint);
    normalized.push(endpoint);
  }
  return normalized;
}

function renderBlock(endpoints) {
  const lines = endpoints.map((entry) => `- \`${entry}\``);
  return `${START_MARKER}\n${lines.join("\n")}\n${END_MARKER}`;
}

if (!fs.existsSync(SSOT_PATH)) {
  fail(`Missing ${path.relative(ROOT, SSOT_PATH)}`);
}

const endpoints = loadManifestEndpoints();
const ssotText = fs.readFileSync(SSOT_PATH, "utf8");
const startIdx = ssotText.indexOf(START_MARKER);
const endIdx = ssotText.indexOf(END_MARKER);

if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
  fail(`Missing or invalid P0 markers in ${path.relative(ROOT, SSOT_PATH)}`);
}

const block = renderBlock(endpoints);
const nextText = `${ssotText.slice(0, startIdx)}${block}${ssotText.slice(endIdx + END_MARKER.length)}`;

if (CHECK_ONLY) {
  if (nextText !== ssotText) {
    console.error("SSOT P0 block is out of sync with scripts/manifests/p0_endpoints.json.");
    console.error("Run: npm run ssot:p0:sync");
    process.exit(1);
  }
  console.log("SSOT P0 block is in sync.");
  process.exit(0);
}

if (nextText !== ssotText) {
  fs.writeFileSync(SSOT_PATH, nextText, "utf8");
  console.log("SSOT P0 block updated from manifest.");
} else {
  console.log("SSOT P0 block already up to date.");
}
