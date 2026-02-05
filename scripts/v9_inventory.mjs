import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const API_ROOT = path.join(ROOT, "app", "api");
const APP_ROOT = path.join(ROOT, "app");

const OUTPUTS = {
  api: path.join(ROOT, "docs", "v9_inventory_api.md"),
  pages: path.join(ROOT, "docs", "v9_inventory_pages.md"),
  features: path.join(ROOT, "docs", "v9_inventory_features.md"),
  frontendApi: path.join(ROOT, "docs", "v9_inventory_frontend_api_usage.md"),
  parity: path.join(ROOT, "docs", "v9_parity_report.md"),
};

const API_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

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

function normalizeRoutePath(routePath) {
  let route = routePath.replace(/\\/g, "/");
  route = route.replace(/\/\([^/]+\)/g, "");
  route = route.replace(/\([^/]+\)/g, "");
  route = route.replace(/\/+/g, "/");
  if (route.length > 1 && route.endsWith("/")) route = route.slice(0, -1);
  return route;
}

function apiRouteFromFile(filePath) {
  const rel = path.relative(API_ROOT, filePath).replace(/\\/g, "/");
  const withoutRoute = rel.replace(/\/route\.[^/.]+$/, "");
  const route = withoutRoute ? `/api/${withoutRoute}` : "/api";
  return normalizeRoutePath(route);
}

function pageRouteFromFile(filePath) {
  const rel = path.relative(APP_ROOT, filePath).replace(/\\/g, "/");
  const withoutPage = rel.replace(/\/page\.[^/.]+$/, "");
  const route = withoutPage ? `/${withoutPage}` : "/";
  return normalizeRoutePath(route);
}

function extractMethods(content) {
  const methods = new Set();
  const funcRegex = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;
  const constRegex = /export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;
  let match;
  while ((match = funcRegex.exec(content))) {
    methods.add(match[1]);
  }
  while ((match = constRegex.exec(content))) {
    methods.add(match[1]);
  }
  return methods.size > 0 ? Array.from(methods).sort() : [];
}

function detectRuntime(content) {
  const runtimeMatch = content.match(/export\s+const\s+runtime\s*=\s*['"]([^'"]+)['"]/);
  const dynamicMatch = content.match(/export\s+const\s+dynamic\s*=\s*['"]([^'"]+)['"]/);
  const revalidateMatch = content.match(/export\s+const\s+revalidate\s*=\s*([\d_]+)/);
  const fetchCacheMatch = content.match(/export\s+const\s+fetchCache\s*=\s*['"]([^'"]+)['"]/);
  return {
    runtime: runtimeMatch ? runtimeMatch[1] : "default",
    dynamic: dynamicMatch ? dynamicMatch[1] : "default",
    revalidate: revalidateMatch ? revalidateMatch[1] : "default",
    fetchCache: fetchCacheMatch ? fetchCacheMatch[1] : "default",
  };
}

function detectPayload(content) {
  const payloads = new Set();
  if (/req\.json\s*\(/.test(content)) payloads.add("json");
  if (/req\.formData\s*\(/.test(content)) payloads.add("formData");
  if (/req\.text\s*\(/.test(content)) payloads.add("text");
  if (/req\.arrayBuffer\s*\(/.test(content)) payloads.add("arrayBuffer");
  if (/searchParams/.test(content) || /new URL\(.*\)\.searchParams/.test(content)) payloads.add("query");
  return payloads.size > 0 ? Array.from(payloads).sort() : ["none detected"];
}

function detectStatusCodes(content) {
  const codes = new Set();
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const statusMatch = line.match(/\b(status|httpStatus)\s*:\s*(\d{3})\b/);
    if (statusMatch) codes.add(statusMatch[2]);
    if (line.includes("respondError") || line.includes("respondPlainText") || line.includes("new Response") || line.includes("NextResponse")) {
      const numMatch = line.match(/\b(\d{3})\b/);
      if (numMatch && API_METHODS.length) codes.add(numMatch[1]);
    }
  }
  return Array.from(codes).sort();
}

function detectLegacy(content) {
  const legacy = [];
  if (/@deprecated/i.test(content)) legacy.push("@deprecated");
  if (/LEGACY_/i.test(content)) legacy.push("LEGACY_");
  return legacy;
}

function detectEnvelopeUsage(content) {
  if (/withApiEnvelope\(/.test(content)) return "withApiEnvelope";
  if (/respondOk\(/.test(content) || /respondError\(/.test(content) || /respondPlainText\(/.test(content)) return "respond*";
  if (/jsonWrap\(/.test(content)) return "jsonWrap";
  if (/NextResponse\.json\(/.test(content)) return "NextResponse.json (raw)";
  if (/new Response\(/.test(content)) return "new Response (raw)";
  return "unknown";
}

function detectType(routePath) {
  if (routePath.startsWith("/api/internal")) return "internal";
  if (routePath.startsWith("/api/cron")) return "cron";
  if (routePath.startsWith("/api/admin")) return "admin";
  if (routePath.startsWith("/api/organizacao")) return "organizacao";
  if (routePath.startsWith("/api/me")) return "me";
  if (routePath.startsWith("/api/public")) return "public";
  if (routePath.startsWith("/api/widgets")) return "public";
  return "public";
}

const AUTH_SIGNALS = {
  internal: [/requireInternalSecret\s*\(/],
  admin: [/requireAdminUser\s*\(/, /isAdmin/i],
  org: [
    /getActiveOrganizationForUser\s*\(/,
    /ensureOrganizationContext\s*\(/,
    /ensureOrganizationAccess\s*\(/,
    /requireOrganization\s*\(/,
    /resolveGroupMemberForOrg\s*\(/,
    /ensureGroupMemberForOrg\s*\(/,
    /ensureGroupMemberRole\s*\(/,
    /ensureMemberModuleAccess\s*\(/,
    /ensureGroupMemberModuleAccess\s*\(/,
    /ensureGroupMemberCheckinAccess\s*\(/,
    /requireChatContext\s*\(/,
  ],
  orgEmail: [/ensureOrganizationEmailVerified\s*\(/],
  user: [/ensureAuthenticated\s*\(/, /supabase\.auth\.getUser\s*\(/, /requireUser\s*\(/, /requireChatContext\s*\(/],
  webhook: [/stripe-signature/, /constructStripeWebhookEvent/],
};

function detectAuth(content, routeType) {
  const flags = [];
  for (const [key, patterns] of Object.entries(AUTH_SIGNALS)) {
    if (patterns.some((pattern) => pattern.test(content))) {
      flags.push(key);
    }
  }
  if (flags.length === 0) {
    if (routeType === "internal" || routeType === "cron") return "secret (expected) - NOT DETECTED";
    if (routeType === "admin") return "admin (expected) - NOT DETECTED";
    if (routeType === "organizacao") return "user+org (expected) - NOT DETECTED";
    if (routeType === "me") return "user (expected) - NOT DETECTED";
    return "none detected";
  }
  return flags.join(", ");
}

function detectCaching(content) {
  if (/fetchCache/.test(content)) return "fetchCache exported";
  if (/revalidate/.test(content)) return "revalidate exported";
  if (/dynamic/.test(content)) return "dynamic exported";
  return "default";
}

function normalizeEndpoint(raw) {
  let endpoint = raw.trim();
  endpoint = endpoint.split("?")[0];
  endpoint = endpoint.replace(/\$\{[^}]+\}/g, "[param]");
  endpoint = endpoint.replace(/\[[^/]+\]/g, "[param]");
  endpoint = endpoint.replace(/([^/])\[param\]$/, "$1");
  endpoint = endpoint.replace(/\\/g, "/");
  endpoint = endpoint.replace(/\/+/g, "/");
  if (endpoint.length > 1 && endpoint.endsWith("/")) endpoint = endpoint.slice(0, -1);
  return endpoint;
}

function extractFrontendApiUsage() {
  const sourceRoots = [path.join(ROOT, "app"), path.join(ROOT, "components")];
  const files = [];
  const apiRoot = path.join(ROOT, "app", "api");
  for (const root of sourceRoots) {
    if (!fs.existsSync(root)) continue;
    files.push(...listFiles(root));
  }
  const codeFiles = files.filter((file) => {
    if (!/\.(ts|tsx|js|jsx)$/.test(file)) return false;
    if (file.startsWith(apiRoot + path.sep)) return false;
    return true;
  });
  const usage = new Map();
  const apiRegex = /["'`](\/api\/[^"'`\s]+)["'`]/g;

  for (const file of codeFiles) {
    const content = fs.readFileSync(file, "utf8");
    let match;
    while ((match = apiRegex.exec(content))) {
      const raw = match[1];
      const endpoint = normalizeEndpoint(raw);
      if (!usage.has(endpoint)) usage.set(endpoint, new Set());
      usage.get(endpoint).add(path.relative(ROOT, file));
    }
  }

  return usage;
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}

function renderApiInventory(entries) {
  const lines = [];
  lines.push("# V9 Inventory — API Routes");
  lines.push("");
  lines.push(`Total: ${entries.length}`);
  lines.push("");
  lines.push("| Route | File | Methods | Type | Auth | Payloads | Status codes | Runtime | Cache | Envelope | Legacy |" );
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const entry of entries) {
    lines.push(
      `| ${entry.route} | ${entry.file} | ${entry.methods.join(", ") || "unknown"} | ${entry.type} | ${entry.auth} | ${entry.payloads.join(", ")} | ${entry.statusCodes.join(", ") || "unknown"} | ${entry.runtime.runtime}/${entry.runtime.dynamic}/${entry.runtime.revalidate} | ${entry.cache} | ${entry.envelope} | ${entry.legacy.length ? entry.legacy.join(", ") : "-"} |`
    );
  }
  lines.push("");
  lines.push("Notas:");
  lines.push("- Auth/códigos/payloads foram inferidos por heurística; revisar manualmente endpoints críticos.");
  lines.push("- Envelope indica uso detectado (withApiEnvelope/respond*/jsonWrap); raw = potencial não conformidade.");
  return lines.join("\n");
}

function renderPagesInventory(pages) {
  const lines = [];
  lines.push("# V9 Inventory — Pages/Routes");
  lines.push("");
  lines.push(`Total: ${pages.length}`);
  lines.push("");
  lines.push("| Route | File | Group | Flow Tags |" );
  lines.push("| --- | --- | --- | --- |");
  for (const page of pages) {
    lines.push(`| ${page.route} | ${page.file} | ${page.group} | ${page.tags.join(", ") || "-"} |`);
  }
  lines.push("");
  lines.push("Flow tags: login, onboarding, organizacao, checkout, padel, loja, crm, reservas, admin, eventos, social, user, public.");
  return lines.join("\n");
}

function tagPageRoute(route) {
  const tags = new Set();
  if (/^\/login$|^\/signup$|^\/reset-password$|^\/auth\//.test(route)) tags.add("login");
  if (/^\/onboarding\b/.test(route)) tags.add("onboarding");
  if (/^\/organizacao\b/.test(route)) tags.add("organizacao");
  if (/\/checkout/.test(route)) tags.add("checkout");
  if (/\/padel\b/.test(route)) tags.add("padel");
  if (/\/loja\b/.test(route)) tags.add("loja");
  if (/\/crm\b/.test(route)) tags.add("crm");
  if (/\/reservas\b/.test(route)) tags.add("reservas");
  if (/^\/admin\b/.test(route)) tags.add("admin");
  if (/^\/eventos\b/.test(route)) tags.add("eventos");
  if (/^\/rede\b|^\/social\b/.test(route)) tags.add("social");
  if (/^\/me\b|^\/perfil\b/.test(route)) tags.add("user");
  if (tags.size === 0) tags.add("public");
  return Array.from(tags);
}

function renderFeaturesInventory(features) {
  const lines = [];
  lines.push("# V9 Inventory — Features vs Backend");
  lines.push("");
  for (const [feature, data] of Object.entries(features)) {
    lines.push(`## ${feature}`);
    lines.push("");
    lines.push(`API routes (${data.api.length}):`);
    for (const route of data.api.sort()) lines.push(`- ${route}`);
    lines.push("");
    lines.push(`Pages (${data.pages.length}):`);
    for (const page of data.pages.sort()) lines.push(`- ${page}`);
    lines.push("");
  }
  return lines.join("\n");
}

function renderFrontendUsage(usage) {
  const lines = [];
  lines.push("# V9 Inventory — Frontend API Usage");
  lines.push("");
  lines.push(`Total endpoints referenced: ${usage.size}`);
  lines.push("");
  const sorted = Array.from(usage.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [endpoint, files] of sorted) {
    lines.push(`## ${endpoint}`);
    for (const file of Array.from(files).sort()) {
      lines.push(`- ${file}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function renderParityReport(parity) {
  const lines = [];
  lines.push("# V9 Parity Report — Frontend vs Backend");
  lines.push("");
  lines.push("## A) API endpoints existentes mas não usados no frontend");
  lines.push("");
  for (const entry of parity.unusedApi) {
    lines.push(`- ${entry.route} (${entry.type}${entry.legacy ? ", legacy" : ""})`);
  }
  lines.push("");
  lines.push("## B) Frontend chama endpoint inexistente");
  lines.push("");
  for (const endpoint of parity.missingApi) {
    lines.push(`- ${endpoint}`);
  }
  lines.push("");
  lines.push("## C) Frontend chama endpoint legacy/410");
  lines.push("");
  for (const entry of parity.legacyUsed) {
    lines.push(`- ${entry.endpoint} (files: ${entry.files.join(", ")})`);
  }
  lines.push("");
  lines.push("## Notas");
  lines.push("");
  lines.push("- Paridade calculada por normalização heurística; revisar manualmente endpoints críticos e internos.");
  return lines.join("\n");
}

function matchesEndpointPattern(pattern, candidate) {
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

function main() {
  const apiFiles = fs.existsSync(API_ROOT) ? listFiles(API_ROOT) : [];
  const apiRouteFiles = apiFiles.filter((file) => /\/route\.(ts|tsx|js|jsx)$/.test(file));
  const apiEntries = apiRouteFiles.map((file) => {
    const content = fs.readFileSync(file, "utf8");
    const route = apiRouteFromFile(file);
    const type = detectType(route);
    return {
      route,
      file: path.relative(ROOT, file),
      methods: extractMethods(content),
      type,
      auth: detectAuth(content, type),
      payloads: detectPayload(content),
      statusCodes: detectStatusCodes(content),
      runtime: detectRuntime(content),
      cache: detectCaching(content),
      envelope: detectEnvelopeUsage(content),
      legacy: detectLegacy(content),
    };
  });

  apiEntries.sort((a, b) => a.route.localeCompare(b.route));

  const pageFiles = listFiles(APP_ROOT).filter((file) => /\/page\.(ts|tsx|js|jsx)$/.test(file));
  const pageEntries = pageFiles
    .filter((file) => !file.includes(`${path.sep}api${path.sep}`))
    .map((file) => {
      const route = pageRouteFromFile(file);
      const groupMatch = file.match(/\(([^)]+)\)/g);
      const group = groupMatch ? groupMatch.join("/") : "-";
      return {
        route,
        file: path.relative(ROOT, file),
        group,
        tags: tagPageRoute(route),
      };
    })
    .sort((a, b) => a.route.localeCompare(b.route));

  const usage = extractFrontendApiUsage();

  const featurePatterns = {
    users: [/^\/api\/auth/, /^\/api\/users/, /^\/api\/profiles/, /^\/api\/me(\/|$)/, /^\/api\/social/],
    orgs: [/^\/api\/organizacao/, /^\/api\/organizations/],
    payments: [/^\/api\/payments/, /^\/api\/checkout/, /^\/api\/stripe/, /^\/api\/webhooks\/stripe/, /^\/api\/organizacao\/payouts/, /^\/api\/admin\/payments/, /^\/api\/admin\/payouts/, /^\/api\/organizacao\/finance/, /^\/api\/organizacao\/pagamentos/],
    tickets: [/^\/api\/tickets/, /^\/api\/eventos/, /^\/api\/public\/v1\/events/],
    store: [/^\/api\/store/, /^\/api\/me\/store/, /^\/api\/organizacao\/loja/],
    padel: [/^\/api\/padel/, /^\/api\/organizacao\/padel/, /^\/api\/tournaments/, /^\/api\/organizacao\/tournaments/],
    reservas: [/^\/api\/organizacao\/reservas/, /^\/api\/me\/reservas/, /^\/api\/servicos/, /^\/api\/agenda/],
    crm: [/^\/api\/organizacao\/crm/],
    ops_outbox: [/^\/api\/internal/, /^\/api\/cron/, /^\/api\/organizacao\/ops/],
    notifications: [/^\/api\/notifications/, /^\/api\/me\/notifications/],
  };

  const features = {};
  for (const key of Object.keys(featurePatterns)) {
    features[key] = { api: [], pages: [] };
  }

  for (const entry of apiEntries) {
    for (const [feature, patterns] of Object.entries(featurePatterns)) {
      if (patterns.some((pattern) => pattern.test(entry.route))) {
        features[feature].api.push(entry.route);
      }
    }
  }

  for (const page of pageEntries) {
    const route = page.route;
    if (/^\/me\b|^\/perfil\b|^\/login$|^\/signup$|^\/reset-password$/.test(route)) features.users.pages.push(route);
    if (/^\/organizacao\b/.test(route)) features.orgs.pages.push(route);
    if (/\/checkout/.test(route)) features.payments.pages.push(route);
    if (/\/bilhetes|\/eventos|\/tickets/.test(route)) features.tickets.pages.push(route);
    if (/\/loja\b/.test(route)) features.store.pages.push(route);
    if (/\/padel\b|\/torneios\b/.test(route)) features.padel.pages.push(route);
    if (/\/reservas\b|\/servicos\b/.test(route)) features.reservas.pages.push(route);
    if (/\/crm\b/.test(route)) features.crm.pages.push(route);
    if (/\/admin\b|\/ops\b/.test(route)) features.ops_outbox.pages.push(route);
    if (/\/notificacoes|\/notifications/.test(route)) features.notifications.pages.push(route);
  }

  // Parity report
  const apiRoutes = apiEntries.map((entry) => normalizeEndpoint(entry.route));
  const apiRoutesSet = new Set(apiRoutes);
  const missingApi = [];
  for (const endpoint of usage.keys()) {
    if (apiRoutesSet.has(endpoint)) continue;
    if (endpoint.includes("[param]")) {
      const matched = apiRoutes.some((candidate) => matchesEndpointPattern(endpoint, candidate));
      if (matched) continue;
    }
    missingApi.push(endpoint);
  }

  const unusedApi = apiEntries.filter((entry) => !usage.has(normalizeEndpoint(entry.route)));
  const legacyUsed = [];
  for (const entry of apiEntries) {
    if (entry.legacy.length === 0) continue;
    const endpoint = normalizeEndpoint(entry.route);
    if (usage.has(endpoint)) {
      legacyUsed.push({ endpoint, files: Array.from(usage.get(endpoint)) });
    }
  }

  writeFile(OUTPUTS.api, renderApiInventory(apiEntries));
  writeFile(OUTPUTS.pages, renderPagesInventory(pageEntries));
  writeFile(OUTPUTS.features, renderFeaturesInventory(features));
  writeFile(OUTPUTS.frontendApi, renderFrontendUsage(usage));
  writeFile(OUTPUTS.parity, renderParityReport({
    unusedApi: unusedApi.map((entry) => ({ route: entry.route, type: entry.type, legacy: entry.legacy.length > 0 })),
    missingApi: missingApi.sort(),
    legacyUsed,
  }));
}

main();
