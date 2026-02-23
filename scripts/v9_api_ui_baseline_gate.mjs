import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const BASELINE_PATH = path.join(
  ROOT,
  "scripts",
  "manifests",
  "api_ui_orphan_baseline_v1.json",
);

function normalizeEndpoint(raw) {
  let endpoint = String(raw ?? "").trim();
  endpoint = endpoint.split("?")[0];
  endpoint = endpoint.replace(/\$\{[^}]+\}/g, "[param]");
  endpoint = endpoint.replace(/\[[^/]+\]/g, "[param]");
  endpoint = endpoint.replace(/([^/])\[param\]$/, "$1");
  endpoint = endpoint.replace(/\\/g, "/");
  endpoint = endpoint.replace(/\/+/g, "/");
  if (endpoint.length > 1 && endpoint.endsWith("/")) endpoint = endpoint.slice(0, -1);
  return endpoint;
}

function toEntries(parsed) {
  if (Array.isArray(parsed?.entries)) {
    return parsed.entries
      .map((entry) => (entry && typeof entry === "object" ? entry : null))
      .filter(Boolean);
  }
  if (Array.isArray(parsed?.routes)) {
    return parsed.routes.map((route) => ({ route }));
  }
  return [];
}

if (!fs.existsSync(BASELINE_PATH)) {
  console.error("V9 API/UI baseline gate: missing scripts/manifests/api_ui_orphan_baseline_v1.json");
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
} catch (err) {
  console.error("V9 API/UI baseline gate: invalid JSON", err instanceof Error ? err.message : err);
  process.exit(1);
}

const policy = parsed?.policy && typeof parsed.policy === "object" ? parsed.policy : {};
const entries = toEntries(parsed);
if (entries.length === 0) {
  console.error("V9 API/UI baseline gate: baseline entries are empty");
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const invalid = [];
const expired = [];
const seen = new Set();

for (const [index, entry] of entries.entries()) {
  const rawRoute = entry.route;
  if (typeof rawRoute !== "string") {
    invalid.push({ index, reason: "route_missing" });
    continue;
  }

  const route = normalizeEndpoint(rawRoute);
  if (!route.startsWith("/api/")) {
    invalid.push({ index, route, reason: "route_invalid" });
    continue;
  }

  if (seen.has(route)) {
    invalid.push({ index, route, reason: "duplicate_route" });
    continue;
  }
  seen.add(route);

  const owner = typeof entry.owner === "string" && entry.owner.trim()
    ? entry.owner.trim()
    : typeof policy.owner === "string"
      ? policy.owner.trim()
      : "";
  const reason = typeof entry.reason === "string" && entry.reason.trim()
    ? entry.reason.trim()
    : typeof policy.reason === "string"
      ? policy.reason.trim()
      : "";
  const expiresAt = typeof entry.expiresAt === "string" && entry.expiresAt.trim()
    ? entry.expiresAt.trim()
    : typeof policy.expiresAt === "string"
      ? policy.expiresAt.trim()
      : "";

  if (!owner) invalid.push({ index, route, reason: "owner_missing" });
  if (!reason) invalid.push({ index, route, reason: "reason_missing" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) {
    invalid.push({ index, route, reason: "expiresAt_invalid" });
  } else if (expiresAt < today) {
    expired.push({ route, expiresAt, owner, reason });
  }
}

if (invalid.length > 0 || expired.length > 0) {
  console.error("V9 API/UI baseline gate failed:");
  if (invalid.length > 0) {
    console.error(`- Invalid entries: ${invalid.length}`);
    for (const item of invalid.slice(0, 15)) {
      console.error(`  - idx=${item.index} route=${item.route ?? "-"} reason=${item.reason}`);
    }
  }
  if (expired.length > 0) {
    console.error(`- Expired entries: ${expired.length}`);
    for (const item of expired.slice(0, 15)) {
      console.error(`  - ${item.route} expiresAt=${item.expiresAt} owner=${item.owner}`);
    }
  }
  process.exit(1);
}

console.log(`V9 API/UI baseline gate: OK (${entries.length} entries, expires >= ${today})`);
