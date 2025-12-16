import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";

const OUT_DIR = "exports";
const MAX_BYTES = 300_000;

// Excluir lixo/segredos/binaries
const EXCLUDE_PREFIXES = [
  ".next/", "node_modules/", ".git/", "dist/", "build/", "coverage/",
  ".turbo/", ".vercel/", ".cache/", ".vscode/",
  "public/", // no teu caso: muitos uploads/imagens -> ruído para análise de código
];

const EXCLUDE_EXACT = new Set([
  ".env", ".env.local", ".env.development", ".env.production", ".env.test",
  ".DS_Store", "tsconfig.tsbuildinfo",
]);

const SKIP_EXT = new Set([
  ".png",".jpg",".jpeg",".gif",".webp",".ico",".pdf",
  ".zip",".gz",".rar",".7z",".mp4",".mov",".mp3",".wav",
  ".woff",".woff2",".ttf",".otf",".db",
]);

function isExcluded(file) {
  if (EXCLUDE_EXACT.has(file)) return true;
  if (file.startsWith(".env.")) return true;
  if (EXCLUDE_PREFIXES.some((p) => file.startsWith(p))) return true;
  if (SKIP_EXT.has(path.extname(file).toLowerCase())) return true;
  return false;
}

function langFromExt(file) {
  const ext = path.extname(file).toLowerCase();
  const map = {
    ".ts": "ts", ".tsx": "tsx", ".js": "js", ".jsx": "jsx",
    ".json": "json", ".css": "css", ".scss": "scss",
    ".md": "md", ".sql": "sql", ".yml": "yaml", ".yaml": "yaml",
    ".prisma": "prisma", ".sh": "bash", ".mjs": "js",
    ".txt": "",
  };
  return map[ext] ?? "";
}

function safeRead(file) {
  const s = statSync(file);
  if (s.size > MAX_BYTES) return `// [SKIPPED: ${s.size} bytes > ${MAX_BYTES}]`;
  return readFileSync(file, "utf8");
}

const ROOT_CONFIG_FILES = new Set([
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "tsconfig.json",
  "eslint.config.mjs",
  "postcss.config.mjs",
  "vercel.json",
  "middleware.ts",
  "next-env.d.ts",
  ".gitignore",
  "README.md",
  "prisma.config.ts",
  "routes-tree.txt",
  "app_v3_schema.sql",
  "diff_app_v3_vs_repo.sql",
  "orya_supabase_schema.sql",
]);

// Lista só ficheiros versionados (ideal)
const allFiles = execSync("git ls-files", { encoding: "utf8" })
  .split("\n")
  .map((f) => f.trim())
  .filter(Boolean)
  .filter((f) => !isExcluded(f))
  .sort((a, b) => a.localeCompare(b));

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

function writeBundle(name, title, files) {
  let out = `# ${title}\n\n`;
  out += `Gerado em: ${new Date().toISOString()}\n\n`;
  out += `Total de ficheiros: ${files.length}\n\n---\n\n`;

  for (const file of files) {
    const lang = langFromExt(file);
    out += `## ${file}\n\n`;
    out += "```" + lang + "\n";
    out += safeRead(file).replace(/\r\n/g, "\n");
    out += "\n```\n\n---\n\n";
  }

  const outFile = path.join(OUT_DIR, `${name}.md`);
  writeFileSync(outFile, out, "utf8");
  console.log(`✅ ${outFile} (${files.length} ficheiros)`);
}

const bundles = [
  {
    name: "01_app_public_user",
    title: "01 — App (público + utilizador) — sem API e sem dashboards",
    pick: (f) =>
      f.startsWith("app/") &&
      !f.startsWith("app/api/") &&
      !f.startsWith("app/admin/") &&
      !f.startsWith("app/organizador/") &&
      !f.startsWith("app/staff/"),
  },
  {
    name: "02_app_dashboards",
    title: "02 — App (dashboards: admin + organizador + staff + monitor)",
    pick: (f) =>
      f.startsWith("app/admin/") ||
      f.startsWith("app/organizador/") ||
      f.startsWith("app/staff/") ||
      f.startsWith("app/live/"),
  },
  {
    name: "03_ui_components",
    title: "03 — Componentes UI (app/components + components/)",
    pick: (f) => f.startsWith("app/components/") || f.startsWith("components/"),
  },
  {
    name: "04_api_identity_social",
    title: "04 — API (auth/perfil/social/notificações/upload/username/me/email/ownership)",
    pick: (f) =>
      f.startsWith("app/api/auth/") ||
      f.startsWith("app/api/profiles/") ||
      f.startsWith("app/api/social/") ||
      f.startsWith("app/api/notifications/") ||
      f.startsWith("app/api/me/") ||
      f.startsWith("app/api/email/") ||
      f.startsWith("app/api/username/") ||
      f.startsWith("app/api/upload/") ||
      f.startsWith("app/api/ownership/"),
  },
  {
    name: "05_api_core_commerce",
    title: "05 — API (eventos/experiências/explorar/checkout/payments/stripe/tickets/promo/qr/guests/cron-reservations)",
    pick: (f) =>
      f.startsWith("app/api/eventos/") ||
      f.startsWith("app/api/experiencias/") ||
      f.startsWith("app/api/explorar/") ||
      f.startsWith("app/api/checkout/") ||
      f.startsWith("app/api/payments/") ||
      f.startsWith("app/api/stripe/") ||
      f.startsWith("app/api/tickets/") ||
      f.startsWith("app/api/promo/") ||
      f.startsWith("app/api/platform/") ||
      f.startsWith("app/api/qr/") ||
      f.startsWith("app/api/guests/") ||
      f.startsWith("app/api/cron/reservations/"),
  },
  {
    name: "06_api_admin_org_padel",
    title: "06 — API (admin/organizador/staff/padel/tournaments/cron-padel)",
    pick: (f) =>
      f.startsWith("app/api/admin/") ||
      f.startsWith("app/api/organizador/") ||
      f.startsWith("app/api/staff/") ||
      f.startsWith("app/api/padel/") ||
      f.startsWith("app/api/tournaments/") ||
      f.startsWith("app/api/cron/padel/"),
  },
  {
    name: "07_core_domain_lib",
    title: "07 — Core backend (domain + lib + config + data + types)",
    pick: (f) =>
      f.startsWith("domain/") ||
      f.startsWith("lib/") ||
      f.startsWith("config/") ||
      f.startsWith("data/") ||
      f.startsWith("types/"),
  },
  {
    name: "08_db_ops_docs_configs",
    title: "08 — DB + Ops + Docs + Config raiz (prisma + scripts + tests + docs + root configs + sql)",
    pick: (f) =>
      f.startsWith("prisma/") ||
      f.startsWith("scripts/") ||
      f.startsWith("tests/") ||
      f.startsWith("docs/") ||
      ROOT_CONFIG_FILES.has(f) ||
      f.endsWith(".sql"),
  },
];

for (const b of bundles) {
  const files = allFiles.filter(b.pick);
  writeBundle(b.name, b.title, files);
}

console.log("\n🎯 Feito: abre os .md em exports/ e exporta para PDF no VS Code.");