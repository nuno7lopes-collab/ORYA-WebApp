import fs from "fs";
import path from "path";
import * as ts from "typescript";

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

type StringMap = Map<string, string[]>;

const ROOT = process.cwd();
const API_ROOT = path.join(ROOT, "app", "api");
const REPORT_DIR = path.join(ROOT, "reports");
const CSV_PATH = path.join(REPORT_DIR, "api_ui_coverage_v1.csv");
const ORPHANS_PATH = path.join(REPORT_DIR, "api_orphans_v1.md");
const P0_MANIFEST_PATH = path.join(ROOT, "scripts", "manifests", "p0_endpoints.json");
const ROUTE_REGEX = /\/route\.(ts|tsx|js|jsx)$/;
const MAX_EXPR_CANDIDATES = 24;

const MISSING_API_ALLOWLIST = new Set([
  "/api/organizacao",
]);

const ORPHAN_API_ALLOWLIST = new Set<string>([
  "/api/messages/attachments/presign",
]);

const UI_ROOTS = [
  path.join(ROOT, "app"),
  path.join(ROOT, "components"),
  path.join(ROOT, "lib"),
  path.join(ROOT, "domain"),
  path.join(ROOT, "apps", "mobile"),
];

const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".expo",
  "dist",
  "build",
  "coverage",
  "reports",
  "backups",
  "ios",
  "android",
]);

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
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
  const apiIndex = endpoint.indexOf("/api/");
  if (apiIndex > 0) endpoint = endpoint.slice(apiIndex);
  endpoint = endpoint.split("#")[0];
  endpoint = endpoint.split("?")[0];
  endpoint = endpoint.replace(/\$\{[^}]+\}/g, "[param]");
  endpoint = endpoint.replace(/\[[^/]+\]/g, "[param]");
  // Template concatenations that append query fragments can leak as "...list[param]".
  // Keep path params ("/[param]") but drop inline suffix noise ("list[param]").
  endpoint = endpoint.replace(/([^/])(?:\[param\])+$/g, "$1");
  endpoint = endpoint.replace(/([^/])(?:\[param\])+(?=\/)/g, "$1");
  endpoint = endpoint.replace(/\/+/g, "/");
  endpoint = normalizeRoutePath(endpoint);
  if (endpoint.length > 1 && endpoint.endsWith("/")) endpoint = endpoint.slice(0, -1);
  return endpoint;
}

function routeType(route: string) {
  if (route.startsWith("/api/internal")) return "internal";
  if (route.startsWith("/api/cron")) return "cron";
  if (route.includes("/webhook")) return "webhook";
  return "public";
}

function isOutOfScopePadel(route: string) {
  return /\/(padel|tournaments|torneios)(?:\/|$)/i.test(route);
}

function isUiExempt(route: string) {
  const type = routeType(route);
  return type === "internal" || type === "cron" || type === "webhook" || isOutOfScopePadel(route);
}

function isOrphanAllowlisted(route: string) {
  return ORPHAN_API_ALLOWLIST.has(route);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function compact(values: string[]) {
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .slice(0, MAX_EXPR_CANDIDATES);
}

function mergeTemplateFragments(left: string[], right: string[]) {
  const combined: string[] = [];
  for (const l of left) {
    for (const r of right) {
      combined.push(`${l}${r}`);
      if (combined.length >= MAX_EXPR_CANDIDATES) {
        return unique(compact(combined));
      }
    }
  }
  return unique(compact(combined));
}

function getCalleeName(node: ts.Expression): string | null {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  return null;
}

function expressionToTemplates(expr: ts.Expression, vars: StringMap, depth = 0): string[] {
  if (depth > 7) return [];

  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return [expr.text];
  }

  if (ts.isTemplateExpression(expr)) {
    let current = [expr.head.text];
    for (const span of expr.templateSpans) {
      const spanValues = expressionToTemplates(span.expression, vars, depth + 1);
      const resolved = spanValues.length > 0 ? spanValues : ["[param]"];
      current = mergeTemplateFragments(current, resolved);
      current = mergeTemplateFragments(current, [span.literal.text]);
    }
    return unique(compact(current));
  }

  if (ts.isParenthesizedExpression(expr)) {
    return expressionToTemplates(expr.expression, vars, depth + 1);
  }

  if (ts.isIdentifier(expr)) {
    return vars.get(expr.text) ?? [];
  }

  if (ts.isConditionalExpression(expr)) {
    return unique(
      compact([
        ...expressionToTemplates(expr.whenTrue, vars, depth + 1),
        ...expressionToTemplates(expr.whenFalse, vars, depth + 1),
      ]),
    );
  }

  if (
    ts.isBinaryExpression(expr) &&
    expr.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = expressionToTemplates(expr.left, vars, depth + 1);
    const right = expressionToTemplates(expr.right, vars, depth + 1);
    if (left.length === 0 && right.length === 0) return [];
    if (left.length === 0) return right.map((entry) => `[param]${entry}`);
    if (right.length === 0) return left.map((entry) => `${entry}[param]`);
    return mergeTemplateFragments(left, right);
  }

  if (ts.isCallExpression(expr)) {
    const calleeName = getCalleeName(expr.expression);
    if (calleeName === "String" && expr.arguments.length > 0) {
      const resolved = expressionToTemplates(expr.arguments[0], vars, depth + 1);
      return resolved.length > 0 ? resolved : ["[param]"];
    }
    if (calleeName === "encodeURIComponent" && expr.arguments.length > 0) {
      const resolved = expressionToTemplates(expr.arguments[0], vars, depth + 1);
      return resolved.length > 0 ? resolved.map((entry) => encodeURIComponent(entry)) : ["[param]"];
    }
    return [];
  }

  if (ts.isNewExpression(expr)) {
    const calleeName = getCalleeName(expr.expression);
    if (calleeName === "URL" && expr.arguments?.length) {
      return expressionToTemplates(expr.arguments[0], vars, depth + 1);
    }
    return [];
  }

  return [];
}

function endpointFromTemplate(candidate: string): string | null {
  if (!candidate.includes("/api/")) return null;
  const normalized = normalizeEndpoint(candidate);
  if (!normalized.startsWith("/api/")) return null;
  return normalized;
}

function captureCallExpressionEndpoints(
  node: ts.CallExpression,
  vars: StringMap,
  output: Set<string>,
) {
  const calleeName = getCalleeName(node.expression);
  if (!calleeName) return;
  const looksLikeApiInvoker =
    calleeName === "fetch" ||
    calleeName === "request" ||
    calleeName === "get" ||
    calleeName === "post" ||
    calleeName === "put" ||
    calleeName === "patch" ||
    calleeName === "delete";
  if (!looksLikeApiInvoker) return;
  if (node.arguments.length === 0) return;

  const values = expressionToTemplates(node.arguments[0], vars);
  for (const value of values) {
    const endpoint = endpointFromTemplate(value);
    if (!endpoint) continue;
    output.add(endpoint);
  }
}

function captureNewUrlEndpoints(
  node: ts.NewExpression,
  vars: StringMap,
  output: Set<string>,
) {
  const calleeName = getCalleeName(node.expression);
  if (calleeName !== "URL" || !node.arguments?.length) return;
  const values = expressionToTemplates(node.arguments[0], vars);
  for (const value of values) {
    const endpoint = endpointFromTemplate(value);
    if (!endpoint) continue;
    output.add(endpoint);
  }
}

function buildStringMap(sourceFile: ts.SourceFile): StringMap {
  const vars: StringMap = new Map();

  const pass = () => {
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const values = expressionToTemplates(node.initializer, vars);
        const endpoints = values
          .map((value) => value.trim())
          .filter((value) => value.length > 0);
        if (endpoints.length > 0) {
          vars.set(node.name.text, unique(compact(endpoints)));
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  };

  pass();
  pass();
  pass();
  return vars;
}

function extractFrontendUsage() {
  const files: string[] = [];
  for (const root of UI_ROOTS) {
    if (!fs.existsSync(root)) continue;
    files.push(...listFiles(root));
  }

  const codeFiles = files.filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));
  const usage = new Map<string, Set<string>>();
  const fallbackRegex = /["'`]((?:https?:\/\/[^"'`\s]+)?\/api\/[^"'`\s]*)["'`]/g;

  for (const file of codeFiles) {
    if (file.includes(`${path.sep}app${path.sep}api${path.sep}`)) continue;

    const content = fs.readFileSync(file, "utf8");
    const relativeFile = path.relative(ROOT, file);
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const vars = buildStringMap(sourceFile);
    const endpoints = new Set<string>();

    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        captureCallExpressionEndpoints(node, vars, endpoints);
      } else if (ts.isNewExpression(node)) {
        captureNewUrlEndpoints(node, vars, endpoints);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    let match: RegExpExecArray | null;
    fallbackRegex.lastIndex = 0;
    while ((match = fallbackRegex.exec(content))) {
      const endpoint = endpointFromTemplate(match[1]);
      if (!endpoint) continue;
      endpoints.add(endpoint);
    }

    for (const endpoint of endpoints) {
      if (!endpoint.startsWith("/api/")) continue;
      if (!usage.has(endpoint)) usage.set(endpoint, new Set());
      usage.get(endpoint)?.add(relativeFile);
    }
  }

  return usage;
}

function buildUsageEntries(usage: Map<string, Set<string>>): UsageEntry[] {
  return Array.from(usage.entries()).map(([route, files]) => ({
    route,
    segments: route.split("/").filter(Boolean),
    files: Array.from(files).sort(),
  }));
}

function segmentsMatch(routeSegments: string[], usageSegments: string[]) {
  if (usageSegments.length !== routeSegments.length) return false;
  for (let i = 0; i < routeSegments.length; i += 1) {
    const usageSeg = usageSegments[i];
    const routeSeg = routeSegments[i];
    if (usageSeg !== "[param]" && usageSeg !== routeSeg) {
      return false;
    }
  }
  return true;
}

function prefixSegmentsMatch(routeSegments: string[], usageSegments: string[]) {
  if (usageSegments.length > routeSegments.length) return false;
  for (let i = 0; i < usageSegments.length; i += 1) {
    const usageSeg = usageSegments[i];
    const routeSeg = routeSegments[i];
    if (usageSeg !== "[param]" && usageSeg !== routeSeg) {
      return false;
    }
  }
  return true;
}

function matchUsageFiles(
  route: string,
  usage: Map<string, Set<string>>,
  usageEntries: UsageEntry[],
) {
  const normalized = normalizeEndpoint(route);
  const direct = usage.get(normalized);
  if (direct && direct.size > 0) return Array.from(direct).sort();

  const routeSegments = normalized.split("/").filter(Boolean);
  const matches = new Set<string>();

  for (const entry of usageEntries) {
    if (segmentsMatch(routeSegments, entry.segments) || prefixSegmentsMatch(routeSegments, entry.segments)) {
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

function matchesEndpointPrefix(pattern: string, candidate: string) {
  const patternParts = pattern.split("/").filter(Boolean);
  const candidateParts = candidate.split("/").filter(Boolean);
  if (patternParts.length > candidateParts.length) return false;
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

function extractP0RoutesFromManifest() {
  if (!fs.existsSync(P0_MANIFEST_PATH)) return [];
  let manifest: unknown = null;
  try {
    manifest = JSON.parse(fs.readFileSync(P0_MANIFEST_PATH, "utf8"));
  } catch {
    return [];
  }
  const entries = Array.isArray((manifest as { endpoints?: unknown[] })?.endpoints)
    ? ((manifest as { endpoints: unknown[] }).endpoints ?? [])
    : [];
  const paths = new Set<string>();
  for (const entry of entries) {
    if (typeof entry !== "string") continue;
    const value = entry.trim();
    if (!/^app\/api\/.+\/route\.(ts|tsx|js|jsx)$/.test(value)) continue;
    paths.add(value);
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
    const matched = apiRoutesNormalized.some(
      (candidate) =>
        matchesEndpointPattern(endpoint, candidate) || matchesEndpointPrefix(endpoint, candidate),
    );
    if (!matched) {
      if (MISSING_API_ALLOWLIST.has(endpoint)) continue;
      if (isOutOfScopePadel(endpoint)) continue;
      missingApi.push({ endpoint, files: Array.from(files).sort() });
    }
  }
  missingApi.sort((a, b) => a.endpoint.localeCompare(b.endpoint));

  const orphanApiAll = apiEntries.filter((entry) => entry.uiStatus === "orphan");
  const orphanApiAllowed = orphanApiAll.filter((entry) => isOrphanAllowlisted(entry.route));
  const orphanApi = orphanApiAll.filter((entry) => !isOrphanAllowlisted(entry.route));
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
    `- Orphan allowlisted: ${orphanApiAllowed.length}`,
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
    "## API orphan allowlist matches",
    ...(orphanApiAllowed.length
      ? orphanApiAllowed.map((entry) => `- ${entry.route} (${entry.file})`)
      : ["- none"]),
    "",
    "## Exempt routes (internal/cron/webhook)",
    ...(exemptApi.length
      ? exemptApi.map((entry) => `- ${entry.route} (${entry.file})`)
      : ["- none"]),
    "",
  ];

  const p0Paths = extractP0RoutesFromManifest();
  if (p0Paths.length > 0) {
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

    reportLines.push("## P0 endpoints coverage (scripts/manifests/p0_endpoints.json)");
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

  const failOnOrphans = process.env.FAIL_ON_ORPHANS === "1";
  if (failOnOrphans && (orphanApi.length > 0 || missingApi.length > 0)) {
    console.error("API <-> UI coverage audit: FAIL");
    console.error(`- Orphan API routes: ${orphanApi.length}`);
    console.error(`- UI endpoints missing API: ${missingApi.length}`);
    process.exit(1);
  }

  console.log("API <-> UI coverage audit: OK");
}

main();
