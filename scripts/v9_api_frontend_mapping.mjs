import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const API_ROOT = path.join(ROOT, "app", "api");
const USAGE_PATH = path.join(ROOT, "reports", "v9_inventory_frontend_api_usage_v1.md");
const P0_MANIFEST_PATH = path.join(ROOT, "scripts", "manifests", "p0_endpoints.json");
const OUT_CSV = path.join(ROOT, "reports", "v9_api_frontend_mapping_v1.csv");
const OUT_REPORT = path.join(ROOT, "reports", "v9_api_frontend_mapping_report_v1.md");

const ROUTE_REGEX = /\/route\.(ts|tsx|js|jsx)$/;

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
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

function routeFromFile(filePath) {
  const rel = path.relative(API_ROOT, filePath).replace(/\\/g, "/");
  const route = `/api/${rel.replace(ROUTE_REGEX, "")}`;
  return route;
}

function normalizeRoute(route) {
  return route.replace(/\[[^\]]+\]/g, "[param]");
}

function parseFrontendUsage(mdText) {
  const usage = new Map();
  let current = null;
  const lines = mdText.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith("## ")) {
      current = line.slice(3).trim();
      usage.set(current, []);
      continue;
    }
    if (current && line.startsWith("- ")) {
      const entry = line.slice(2).trim();
      if (entry) usage.get(current).push(entry);
    }
  }
  return usage;
}

function parseP0ManifestRoutes() {
  if (!fs.existsSync(P0_MANIFEST_PATH)) return [];
  let manifest = null;
  try {
    manifest = JSON.parse(fs.readFileSync(P0_MANIFEST_PATH, "utf8"));
  } catch {
    return [];
  }
  const paths = new Set();
  const entries = Array.isArray(manifest?.endpoints) ? manifest.endpoints : [];
  for (const entry of entries) {
    if (typeof entry !== "string") continue;
    const value = entry.trim();
    if (!/^app\/api\/.+\/route\.(ts|tsx|js|jsx)$/.test(value)) continue;
    paths.add(value);
  }
  return Array.from(paths.values());
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
    return `"${str.replace(/\"/g, "\"\"")}"`;
  }
  return str;
}

const routeFiles = listFiles(API_ROOT).filter((f) => ROUTE_REGEX.test(f));
const usageText = fs.existsSync(USAGE_PATH) ? fs.readFileSync(USAGE_PATH, "utf8") : "";
const usageByRoute = parseFrontendUsage(usageText);
const usageByNormalized = new Map();
const usageEntries = [];

for (const [route, files] of usageByRoute.entries()) {
  const normalized = normalizeRoute(route);
  usageByNormalized.set(normalized, files);
  usageEntries.push({ route: normalized, segments: normalized.split("/"), files });
}

function matchUsageFiles(route) {
  const normalized = normalizeRoute(route);
  const direct = usageByNormalized.get(normalized);
  if (direct && direct.length > 0) return direct;
  const routeSegments = normalized.split("/");
  const matches = [];
  for (const entry of usageEntries) {
    if (entry.segments.length !== routeSegments.length) continue;
    let ok = true;
    for (let i = 0; i < routeSegments.length; i += 1) {
      const usageSeg = entry.segments[i];
      const routeSeg = routeSegments[i];
      if (usageSeg !== "[param]" && usageSeg !== routeSeg) {
        ok = false;
        break;
      }
    }
    if (ok) {
      matches.push(...entry.files);
    }
  }
  return matches;
}

const rows = [];
rows.push(["api_route", "file_path_server", "frontend_files_that_call_it"]);

for (const file of routeFiles) {
  const route = routeFromFile(file);
  const frontendFiles = matchUsageFiles(route);
  const frontendJoined = frontendFiles.join("; ");
  rows.push([route, path.relative(ROOT, file), frontendJoined]);
}

const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
fs.writeFileSync(OUT_CSV, csv, "utf8");

const planPaths = parseP0ManifestRoutes();
const internalOnly = [];
const externalOnly = [];
const missingUi = [];

for (const relPath of planPaths) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) continue;
  const route = routeFromFile(absPath);
  if (route.startsWith("/api/internal") || route.startsWith("/api/cron")) {
    internalOnly.push(route);
    continue;
  }
  if (route.includes("/webhook")) {
    externalOnly.push(route);
    continue;
  }
  const frontendFiles = matchUsageFiles(route);
  if (frontendFiles.length === 0) {
    missingUi.push(route);
  }
}

const reportLines = [
  "# V9 API → Frontend Mapping Report",
  "",
  `CSV: ${path.relative(ROOT, OUT_CSV)}`,
  "",
  "## Internal/Cron endpoints (no UI required)",
  ...(internalOnly.length ? internalOnly.map((route) => `- ${route}`) : ["- none"]),
  "",
  "## External/Webhook endpoints (no UI required)",
  ...(externalOnly.length ? externalOnly.map((route) => `- ${route}`) : ["- none"]),
  "",
  "## Endpoints referenced in p0_endpoints manifest without frontend usage",
  "- Nota: lista calculada por strings `/api/...` no frontend; endpoints aqui podem ser mobile/server-only.",
  ...(missingUi.length ? missingUi.map((route) => `- ${route}`) : ["- none"]),
  "",
];
fs.writeFileSync(OUT_REPORT, reportLines.join("\n"), "utf8");

console.log("V9 API → frontend mapping: OK");
