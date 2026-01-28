import fs from "fs";
import path from "path";

type UsageEntry = {
  route: string;
  segments: string[];
  files: string[];
};

type ApiEntry = {
  route: string;
  file: string;
  type: string;
  uiFiles: string[];
  uiStatus: "covered" | "orphan" | "exempt";
};

const ROOT = process.cwd();
const API_ROOT = path.join(ROOT, "app", "api");
const REPORT_DIR = path.join(ROOT, "reports");
const CSV_PATH = path.join(REPORT_DIR, "api_ui_coverage.csv");
const ORPHANS_PATH = path.join(REPORT_DIR, "api_orphans.md");
const PLAN_PATH = path.join(ROOT, "docs", "v9_close_plan.md");
const ROUTE_REGEX = /\/route\.(ts|tsx|js|jsx)$/;

const UI_ROOTS = [
  path.join(ROOT, "app"),
  path.join(ROOT, "components"),
  path.join(ROOT, "lib"),
  path.join(ROOT, "domain"),
];

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
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

function normalizeRoutePath(routePath: string) {
  let route = routePath.replace(/\\/g, "/");
  route = route.replace(/\/\([^/]+\)/g, "");
  route = route.replace(/\([^/]+\)/g, "");
  route = route.replace(/\/+/g, "/");
  if (route.length > 1 && route.endsWith("/")) route = route.slice(0, -1);
  return route;
}

function apiRouteFromFile(filePath: string) {
  const rel = path.relative(API_ROOT, filePath).replace(/\\/g, "/");
  const withoutRoute = rel.replace(/\/route\.[^/.]+$/, "");
  const route = withoutRoute ? `/api/${withoutRoute}` : "/api";
  return normalizeRoutePath(route);
}

function normalizeEndpoint(raw: string) {
  let endpoint = raw.trim();
  endpoint = endpoint.split("?")[0];
  endpoint = endpoint.replace(/\$\{[^}]+\}/g, "[param]");
  endpoint = endpoint.replace(/\[[^/]+\]/g, "[param]");
  endpoint = endpoint.replace(/([^/])\[param\]$/g, "$1");
  endpoint = normalizeRoutePath(endpoint);
  endpoint = endpoint.replace(/\/+/g, "/");
  if (endpoint.length > 1 && endpoint.endsWith("/")) endpoint = endpoint.slice(0, -1);
  return endpoint;
}

function routeType(route: string) {
  if (route.startsWith("/api/internal")) return "internal";
  if (route.startsWith("/api/cron")) return "cron";
  if (route.includes("/webhook")) return "webhook";
  return "public";
}

function isUiExempt(route: string) {
  const type = routeType(route);
  return type === "internal" || type === "cron" || type === "webhook";
}

function extractFrontendUsage() {
  const files: string[] = [];
  for (const root of UI_ROOTS) {
    if (!fs.existsSync(root)) continue;
    files.push(...listFiles(root));
  }
  const codeFiles = files.filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));
  const usage = new Map<string, Set<string>>();
  const apiRegex = /["'`](\/api\/[^"'`\s]+)["'`]/g;

  for (const file of codeFiles) {
    if (file.includes(`${path.sep}app${path.sep}api${path.sep}`)) continue;
    const content = fs.readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    apiRegex.lastIndex = 0;
    while ((match = apiRegex.exec(content))) {
      const endpoint = normalizeEndpoint(match[1]);
      if (!endpoint.startsWith("/api/")) continue;
      if (!usage.has(endpoint)) usage.set(endpoint, new Set());
      usage.get(endpoint)?.add(path.relative(ROOT, file));
    }
  }
  return usage;
}

function buildUsageEntries(usage: Map<string, Set<string>>): UsageEntry[] {
  return Array.from(usage.entries()).map(([route, files]) => ({
    route,
    segments: route.split("/"),
    files: Array.from(files).sort(),
  }));
}

function matchUsageFiles(
  route: string,
  usage: Map<string, Set<string>>,
  usageEntries: UsageEntry[],
) {
  const normalized = normalizeEndpoint(route);
  const direct = usage.get(normalized);
  if (direct && direct.size > 0) return Array.from(direct).sort();

  const routeSegments = normalized.split("/");
  const matches = new Set<string>();
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
      for (const file of entry.files) matches.add(file);
    }
  }
  return Array.from(matches).sort();
}

function matchesEndpointPattern(pattern: string, candidate: string) {
  if (pattern === candidate) return true;
  const patternParts = pattern.split("/").filter(Boolean);
  const candidateParts = candidate.split("/").filter(Boolean);
  if (patternParts.length !== candidateParts.length) return false;
  for (let i = 0; i < patternParts.length; i += 1) {
    const part = patternParts[i];
    if (part === "[param]") continue;
    if (part !== candidateParts[i]) return false;
  }
  return true;
}

function csvEscape(value: unknown) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
    return `"${str.replace(/\"/g, "\"\"")}"`;
  }
  return str;
}

function extractP0Routes(planText: string) {
  const lines = planText.split(/\r?\n/);
  const paths = new Set<string>();
  let inSection = false;

  for (const line of lines) {
    if (line.includes("P0 endpoints")) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith("**Jobs/cron/internal**")) break;
    if (!inSection) continue;
    const matches = line.matchAll(/app\/api\/[^\s`]+\/route\.ts/g);
    for (const match of matches) {
      paths.add(match[0]);
    }
  }
  return Array.from(paths.values());
}

function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const apiFiles = listFiles(API_ROOT).filter((file) => ROUTE_REGEX.test(file));
  const usage = extractFrontendUsage();
  const usageEntries = buildUsageEntries(usage);

  const apiEntries: ApiEntry[] = apiFiles.map((file) => {
    const route = apiRouteFromFile(file);
    const uiFiles = matchUsageFiles(route, usage, usageEntries);
    const type = routeType(route);
    const exempt = isUiExempt(route);
    return {
      route,
      file: path.relative(ROOT, file),
      type,
      uiFiles,
      uiStatus: exempt ? "exempt" : uiFiles.length > 0 ? "covered" : "orphan",
    };
  });

  apiEntries.sort((a, b) => a.route.localeCompare(b.route));

  const apiRoutesNormalized = apiEntries.map((entry) => normalizeEndpoint(entry.route));
  const missingApi: Array<{ endpoint: string; files: string[] }> = [];
  for (const [endpoint, files] of usage.entries()) {
    if (apiRoutesNormalized.includes(endpoint)) continue;
    const matched = apiRoutesNormalized.some((candidate) => matchesEndpointPattern(endpoint, candidate));
    if (!matched) {
      missingApi.push({ endpoint, files: Array.from(files).sort() });
    }
  }
  missingApi.sort((a, b) => a.endpoint.localeCompare(b.endpoint));

  const orphanApi = apiEntries.filter((entry) => entry.uiStatus === "orphan");
  const exemptApi = apiEntries.filter((entry) => entry.uiStatus === "exempt");
  const coveredApi = apiEntries.filter((entry) => entry.uiStatus === "covered");

  const rows = [
    [
      "api_route",
      "api_file",
      "api_type",
      "ui_status",
      "ui_file_count",
      "ui_files",
    ],
    ...apiEntries.map((entry) => [
      entry.route,
      entry.file,
      entry.type,
      entry.uiStatus,
      entry.uiFiles.length,
      entry.uiFiles.join("; "),
    ]),
  ];
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
  fs.writeFileSync(CSV_PATH, csv, "utf8");

  const now = new Date().toISOString();
  const reportLines = [
    "# API <-> UI Coverage Report",
    "",
    `Generated: ${now}`,
    `CSV: ${path.relative(ROOT, CSV_PATH)}`,
    "",
    "## Summary",
    `- API routes total: ${apiEntries.length}`,
    `- Covered by UI: ${coveredApi.length}`,
    `- Orphan (no UI): ${orphanApi.length}`,
    `- Exempt (internal/cron/webhook): ${exemptApi.length}`,
    `- UI endpoints missing API: ${missingApi.length}`,
    "",
    "## UI endpoints missing API routes",
    ...(missingApi.length
      ? missingApi.map((entry) => `- ${entry.endpoint} (files: ${entry.files.join(", ")})`)
      : ["- none"]),
    "",
    "## API routes without UI usage (excluding internal/cron/webhook)",
    ...(orphanApi.length
      ? orphanApi.map((entry) => `- ${entry.route} (${entry.file})`)
      : ["- none"]),
    "",
    "## Exempt routes (internal/cron/webhook)",
    ...(exemptApi.length
      ? exemptApi.map((entry) => `- ${entry.route} (${entry.file})`)
      : ["- none"]),
    "",
  ];

  if (fs.existsSync(PLAN_PATH)) {
    const planText = fs.readFileSync(PLAN_PATH, "utf8");
    const p0Paths = extractP0Routes(planText);
    const p0Entries = p0Paths.map((relPath) => {
      const absPath = path.join(ROOT, relPath);
      const exists = fs.existsSync(absPath);
      const route = exists ? apiRouteFromFile(absPath) : "";
      const uiFiles = exists ? matchUsageFiles(route, usage, usageEntries) : [];
      const exempt = exists ? isUiExempt(route) : false;
      return { relPath, route, exists, uiFiles, exempt };
    });

    const p0MissingFiles = p0Entries.filter((entry) => !entry.exists);
    const p0Exempt = p0Entries.filter((entry) => entry.exists && entry.exempt);
    const p0Covered = p0Entries.filter(
      (entry) => entry.exists && !entry.exempt && entry.uiFiles.length > 0,
    );
    const p0MissingUi = p0Entries.filter(
      (entry) => entry.exists && !entry.exempt && entry.uiFiles.length === 0,
    );

    reportLines.push("## P0 endpoints coverage (docs/v9_close_plan.md)");
    reportLines.push(`- Total: ${p0Entries.length}`);
    reportLines.push("");
    reportLines.push("### P0 missing files");
    reportLines.push(
      ...(p0MissingFiles.length
        ? p0MissingFiles.map((entry) => `- ${entry.relPath}`)
        : ["- none"]),
    );
    reportLines.push("");
    reportLines.push("### P0 exempt (internal/cron/webhook)");
    reportLines.push(
      ...(p0Exempt.length
        ? p0Exempt.map((entry) => `- ${entry.route} (${entry.relPath})`)
        : ["- none"]),
    );
    reportLines.push("");
    reportLines.push("### P0 covered by UI");
    reportLines.push(
      ...(p0Covered.length
        ? p0Covered.map(
            (entry) => `- ${entry.route} (files: ${entry.uiFiles.join(", ")})`,
          )
        : ["- none"]),
    );
    reportLines.push("");
    reportLines.push("### P0 missing UI usage");
    reportLines.push(
      ...(p0MissingUi.length
        ? p0MissingUi.map((entry) => `- ${entry.route} (${entry.relPath})`)
        : ["- none"]),
    );
    reportLines.push("");
  }

  fs.writeFileSync(ORPHANS_PATH, reportLines.join("\n"), "utf8");

  console.log("API <-> UI coverage audit: OK");
}

main();
