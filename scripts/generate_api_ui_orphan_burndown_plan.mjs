import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const BASELINE_PATH = path.join(ROOT, "scripts", "manifests", "api_ui_orphan_baseline_v1.json");
const OUT_PATH = path.join(ROOT, "reports", "api_ui_orphan_burndown_plan_v1.md");

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(BASELINE_PATH)) {
  fail("Missing scripts/manifests/api_ui_orphan_baseline_v1.json");
}

let parsed;
try {
  parsed = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
} catch (error) {
  fail(`Invalid baseline JSON: ${error instanceof Error ? error.message : String(error)}`);
}

const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
if (entries.length === 0) {
  fail("Baseline entries are empty.");
}

const waves = ["wave-1", "wave-2", "wave-3"];
const byWave = new Map();
for (const wave of waves) byWave.set(wave, []);

for (const entry of entries) {
  if (!entry || typeof entry !== "object") continue;
  const wave = typeof entry.wave === "string" ? entry.wave.trim() : "";
  if (!byWave.has(wave)) continue;
  byWave.get(wave).push(entry);
}

const now = new Date().toISOString();
const lines = [];
lines.push("# API/UI Orphan Burn-down Plan");
lines.push("");
lines.push(`Generated: ${now}`);
lines.push(`Source: ${path.relative(ROOT, BASELINE_PATH)}`);
lines.push("");
lines.push(`Total baseline órfãos: ${entries.length}`);
lines.push("");

for (const wave of waves) {
  const list = byWave.get(wave) ?? [];
  const byDomain = new Map();
  const byOwner = new Map();
  let minExpiry = null;
  let maxExpiry = null;
  for (const entry of list) {
    const domain = typeof entry.domain === "string" && entry.domain.trim() ? entry.domain.trim() : "unknown";
    const owner = typeof entry.owner === "string" && entry.owner.trim() ? entry.owner.trim() : "unknown";
    const expiry = typeof entry.expiresAt === "string" ? entry.expiresAt.trim() : "";
    byDomain.set(domain, (byDomain.get(domain) ?? 0) + 1);
    byOwner.set(owner, (byOwner.get(owner) ?? 0) + 1);
    if (/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
      minExpiry = minExpiry === null || expiry < minExpiry ? expiry : minExpiry;
      maxExpiry = maxExpiry === null || expiry > maxExpiry ? expiry : maxExpiry;
    }
  }

  lines.push(`## ${wave}`);
  lines.push("");
  lines.push(`- Entradas: ${list.length}`);
  lines.push(`- Janela alvo (expiresAt): ${minExpiry ?? "-"} -> ${maxExpiry ?? "-"}`);
  lines.push("");
  lines.push("### Domínios");
  if (byDomain.size === 0) {
    lines.push("- none");
  } else {
    for (const [domain, count] of Array.from(byDomain.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
      lines.push(`- ${domain}: ${count}`);
    }
  }
  lines.push("");
  lines.push("### Owners");
  if (byOwner.size === 0) {
    lines.push("- none");
  } else {
    for (const [owner, count] of Array.from(byOwner.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
      lines.push(`- ${owner}: ${count}`);
    }
  }
  lines.push("");
  lines.push("### Endpoints");
  if (list.length === 0) {
    lines.push("- none");
  } else {
    for (const entry of list
      .map((item) => String(item.route ?? "").trim())
      .filter((route) => route.startsWith("/api/"))
      .sort((a, b) => a.localeCompare(b))) {
      lines.push(`- ${entry}`);
    }
  }
  lines.push("");
}

lines.push("## Regra operacional");
lines.push("- Cada endpoint deve terminar com decisão `adopt`, `merge` ou `remove` antes da data de `expiresAt`.");
lines.push("- Novos órfãos só podem entrar na baseline com owner, wave e data de saída.");
lines.push("");

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, `${lines.join("\n")}\n`, "utf8");
console.log(`API/UI orphan burn-down plan: ${path.relative(ROOT, OUT_PATH)}`);
