import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const BASELINE_PATH = path.join(
  ROOT,
  "scripts",
  "manifests",
  "api_ui_orphan_baseline_v1.json",
);
const COVERAGE_CSV_PATH = path.join(ROOT, "reports", "api_ui_coverage_v1.csv");

const ORPHAN_API_ALLOWLIST = new Set([
  "/api/auth/clear",
  "/api/messages/attachments/presign",
  "/api/messages/blocks",
  "/api/messages/messages",
  "/api/messages/messages/[messageId]",
  "/api/messages/messages/[messageId]/pins",
  "/api/messages/messages/[messageId]/reactions",
  "/api/messages/messages/[messageId]/report",
  "/api/messages/search",
  "/api/livehub/[slug]",
]);

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  values.push(current);
  return values;
}

function normalizeEndpoint(raw) {
  let endpoint = String(raw ?? "").trim();
  endpoint = endpoint.split("?")[0];
  endpoint = endpoint.split("#")[0];
  endpoint = endpoint.replace(/\\/g, "/");
  endpoint = endpoint.replace(/\/+/g, "/");
  if (endpoint.length > 1 && endpoint.endsWith("/")) endpoint = endpoint.slice(0, -1);
  return endpoint;
}

function normalizeEndpointForCompare(raw) {
  let endpoint = String(raw ?? "").trim();
  endpoint = endpoint.split("?")[0];
  endpoint = endpoint.split("#")[0];
  endpoint = endpoint.replace(/\$\{[^}]+\}/g, "[param]");
  endpoint = endpoint.replace(/\[[^/]+\]/g, "[param]");
  endpoint = endpoint.replace(/([^/])\[param\]$/, "$1");
  endpoint = endpoint.replace(/\\/g, "/");
  endpoint = endpoint.replace(/\/+/g, "/");
  if (endpoint.length > 1 && endpoint.endsWith("/")) endpoint = endpoint.slice(0, -1);
  return endpoint;
}

function classifyDomain(route) {
  if (route.startsWith("/api/org/[orgId]/store/")) return "org.store";
  if (route.startsWith("/api/padel/")) return "padel.public";
  if (route.startsWith("/api/org/[orgId]/padel/")) return "org.padel";
  if (route.startsWith("/api/me/")) return "me";
  if (route.startsWith("/api/org/[orgId]/finance/")) return "org.finance";
  if (route.startsWith("/api/messages/")) return "messages";
  if (route.startsWith("/api/org-hub/")) return "org-hub";
  if (route.startsWith("/api/servicos/")) return "servicos";
  if (route.startsWith("/api/org/[orgId]/")) return "org.other";
  return "public";
}

function defaultsForDomain(domain) {
  switch (domain) {
    case "org.store":
      return { owner: "commerce-core", expiresAt: "2026-05-15", wave: "wave-1" };
    case "org.padel":
    case "padel.public":
      return { owner: "padel-core", expiresAt: "2026-05-30", wave: "wave-2" };
    case "org.finance":
      return { owner: "finance-core", expiresAt: "2026-04-30", wave: "wave-2" };
    case "messages":
      return { owner: "messaging-core", expiresAt: "2026-04-15", wave: "wave-3" };
    case "me":
      return { owner: "identity-core", expiresAt: "2026-04-15", wave: "wave-3" };
    case "org-hub":
      return { owner: "org-platform", expiresAt: "2026-04-30", wave: "wave-3" };
    case "servicos":
      return { owner: "reservas-core", expiresAt: "2026-05-15", wave: "wave-3" };
    case "org.other":
      return { owner: "org-platform", expiresAt: "2026-05-30", wave: "wave-3" };
    default:
      return { owner: "org-platform", expiresAt: "2026-05-30", wave: "wave-3" };
  }
}

function isKnownWave(value) {
  return value === "wave-1" || value === "wave-2" || value === "wave-3";
}

function readCurrentBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return { policy: {}, entries: [] };
  const parsed = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  const entries = Array.isArray(parsed?.entries)
    ? parsed.entries.filter((item) => item && typeof item === "object")
    : Array.isArray(parsed?.routes)
      ? parsed.routes.map((route) => ({ route }))
      : [];
  const policy = parsed?.policy && typeof parsed.policy === "object" ? parsed.policy : {};
  return { policy, entries };
}

if (!fs.existsSync(COVERAGE_CSV_PATH)) {
  console.error("Missing reports/api_ui_coverage_v1.csv. Run gate:api-ui-coverage first.");
  process.exit(1);
}

const csvLines = fs.readFileSync(COVERAGE_CSV_PATH, "utf8").trim().split(/\r?\n/);
const rows = csvLines.slice(1).map(parseCsvLine);
const orphanRoutes = new Set();
for (const row of rows) {
  const [route, , , uiStatus] = row;
  if (uiStatus !== "orphan") continue;
  const canonicalRoute = normalizeEndpoint(route);
  const normalizedCompare = normalizeEndpointForCompare(canonicalRoute);
  const allowlisted =
    ORPHAN_API_ALLOWLIST.has(canonicalRoute) ||
    ORPHAN_API_ALLOWLIST.has(normalizedCompare);
  if (allowlisted) continue;
  orphanRoutes.add(canonicalRoute);
}

const { policy: currentPolicy, entries: currentEntries } = readCurrentBaseline();
const currentByRoute = new Map();
for (const entry of currentEntries) {
  const route = normalizeEndpoint(entry.route);
  if (!route.startsWith("/api/")) continue;
  currentByRoute.set(route, entry);
  currentByRoute.set(normalizeEndpointForCompare(route), entry);
}

const nextEntries = Array.from(orphanRoutes)
  .sort((a, b) => a.localeCompare(b))
  .map((route) => {
    const current =
      currentByRoute.get(route) ??
      currentByRoute.get(normalizeEndpointForCompare(route)) ??
      {};
    const domain = typeof current.domain === "string" && current.domain
      ? current.domain
      : classifyDomain(route);
    const defaults = defaultsForDomain(domain);
    const policyOwner =
      typeof currentPolicy.owner === "string" && currentPolicy.owner.trim()
        ? currentPolicy.owner.trim()
        : "platform-architecture";
    const policyExpiresAt =
      typeof currentPolicy.expiresAt === "string" && currentPolicy.expiresAt.trim()
        ? currentPolicy.expiresAt.trim()
        : "2026-06-30";
    const currentOwner =
      typeof current.owner === "string" && current.owner.trim()
        ? current.owner.trim()
        : "";
    const currentExpiresAt =
      typeof current.expiresAt === "string" && current.expiresAt.trim()
        ? current.expiresAt.trim()
        : "";
    const shouldReplaceGenericOwner = !currentOwner || currentOwner === policyOwner;
    const shouldReplaceGenericExpiry = !currentExpiresAt || currentExpiresAt === policyExpiresAt;
    const currentWave =
      typeof current.wave === "string" && current.wave.trim()
        ? current.wave.trim()
        : "";
    return {
      route,
      domain,
      owner: shouldReplaceGenericOwner ? defaults.owner : currentOwner,
      reason:
        typeof current.reason === "string" && current.reason.trim()
          ? current.reason.trim()
          : "baseline_preexisting_orphan",
      expiresAt: shouldReplaceGenericExpiry ? defaults.expiresAt : currentExpiresAt,
      wave: isKnownWave(currentWave) ? currentWave : defaults.wave,
    };
  });

const next = {
  version: 2,
  description: "Baseline de órfãos API<->UI para o gate falhar apenas em regressões novas.",
  policy: {
    owner:
      typeof currentPolicy.owner === "string" && currentPolicy.owner.trim()
        ? currentPolicy.owner.trim()
        : "platform-architecture",
    reason:
      typeof currentPolicy.reason === "string" && currentPolicy.reason.trim()
        ? currentPolicy.reason.trim()
        : "baseline_preexisting_orphan",
    expiresAt:
      typeof currentPolicy.expiresAt === "string" && currentPolicy.expiresAt.trim()
        ? currentPolicy.expiresAt.trim()
        : "2026-06-30",
  },
  entries: nextEntries,
};

fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
console.log(`Synced baseline entries: ${nextEntries.length}`);
