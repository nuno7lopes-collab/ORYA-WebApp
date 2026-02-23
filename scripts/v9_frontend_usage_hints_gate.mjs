import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const API_ROOT = path.join(ROOT, "app", "api");
const HINTS_PATH = path.join(ROOT, "scripts", "manifests", "frontend_api_usage_hints_v1.json");

function normalizeRoute(raw) {
  let route = String(raw ?? "").trim();
  route = route.split("?")[0];
  route = route.split("#")[0];
  route = route.replace(/\\/g, "/");
  route = route.replace(/\/+/g, "/");
  if (route.length > 1 && route.endsWith("/")) route = route.slice(0, -1);
  return route;
}

function routeToFilePath(route) {
  const trimmed = route.replace(/^\/api\//, "");
  return path.join(API_ROOT, trimmed, "route.ts");
}

if (!fs.existsSync(HINTS_PATH)) {
  console.error("V9 frontend usage hints gate: missing scripts/manifests/frontend_api_usage_hints_v1.json");
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(fs.readFileSync(HINTS_PATH, "utf8"));
} catch (error) {
  console.error(`V9 frontend usage hints gate: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
  process.exit(1);
}

const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
if (entries.length === 0) {
  console.error("V9 frontend usage hints gate: entries are empty");
  process.exit(1);
}

const issues = [];
const seen = new Set();

for (const [index, entry] of entries.entries()) {
  if (!entry || typeof entry !== "object") {
    issues.push(`idx=${index} invalid_entry`);
    continue;
  }
  const route = normalizeRoute(entry.route);
  const files = Array.isArray(entry.files) ? entry.files : [];
  const reason = typeof entry.reason === "string" ? entry.reason.trim() : "";

  if (!route.startsWith("/api/")) {
    issues.push(`idx=${index} route_invalid`);
    continue;
  }
  if (seen.has(route)) {
    issues.push(`route=${route} duplicate`);
  }
  seen.add(route);

  if (!reason) issues.push(`route=${route} reason_missing`);
  if (files.length === 0) issues.push(`route=${route} files_empty`);

  const routeFile = routeToFilePath(route);
  if (!fs.existsSync(routeFile)) {
    issues.push(`route=${route} api_route_file_missing`);
  }

  for (const file of files) {
    if (typeof file !== "string" || !file.trim()) {
      issues.push(`route=${route} file_invalid`);
      continue;
    }
    const rel = file.trim().replace(/\\/g, "/");
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      issues.push(`route=${route} hint_file_missing:${rel}`);
    }
  }
}

if (issues.length > 0) {
  console.error("V9 frontend usage hints gate failed:");
  for (const issue of issues.slice(0, 50)) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(`V9 frontend usage hints gate: OK (${entries.length} hinted routes)`);
