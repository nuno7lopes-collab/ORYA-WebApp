// scripts/export-repo-core-onepdf.mjs
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "exports-core");
const OUT_MD = path.join(OUT_DIR, "ORYA_REPO_CORE.md");

// ✅ Pastas “importantes” (ajusta se quiseres, mas isto já cobre quase tudo do core)
const INCLUDE_PREFIXES = [
  "app/",
  "lib/",
  "prisma/",
  "docs/",
  "domain/",
  "components/",
  "types/",
  "scripts/",
];

// ✅ Ficheiros importantes na raiz
const INCLUDE_FILES = [
  "package.json",
  "tsconfig.json",
  "next.config.js",
  "next.config.mjs",
  "proxy.ts",
  "README.md",
  ".env.example",
];

// ❌ Tipos que não fazem sentido em PDF (assets pesados/binaries)
const SKIP_EXT = new Set([
  ".png",".jpg",".jpeg",".webp",".gif",".ico",".pdf",
  ".zip",".mp4",".mov",".mp3",".wav",".woff",".woff2",".ttf",".eot",
]);

// Evita blowups (ajusta se precisares)
const MAX_BYTES = 300_000; // 300KB por ficheiro

function langFromExt(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".ts" || ext === ".tsx") return "ts";
  if (ext === ".js" || ext === ".mjs" || ext === ".cjs") return "js";
  if (ext === ".json") return "json";
  if (ext === ".sql") return "sql";
  if (ext === ".md") return "md";
  if (ext === ".prisma") return "prisma";
  if (ext === ".yml" || ext === ".yaml") return "yaml";
  return "";
}

function isEligible(file) {
  const ext = path.extname(file).toLowerCase();
  if (SKIP_EXT.has(ext)) return false;
  const full = path.join(ROOT, file);
  try {
    const st = fs.statSync(full);
    if (!st.isFile()) return false;
    if (st.size > MAX_BYTES) return false;
    return true;
  } catch {
    return false;
  }
}

function renderFile(file) {
  const full = path.join(ROOT, file);
  const content = fs.readFileSync(full, "utf8").replace(/\r\n/g, "\n");
  const lang = langFromExt(file);
  return [
    `\n\n---\n## ${file}\n`,
    "```" + lang + "\n",
    content,
    "\n```\n",
  ].join("");
}

fs.mkdirSync(OUT_DIR, { recursive: true });

// Pega só no que está versionado (garante que .next/node_modules nunca entram)
const tracked = execSync("git ls-files", { encoding: "utf8" })
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

const selected = tracked
  .filter((f) => INCLUDE_PREFIXES.some((p) => f.startsWith(p)) || INCLUDE_FILES.includes(f))
  .filter(isEligible)
  .sort((a, b) => a.localeCompare(b, "en"));

let out = "";
out += `# ORYA — Repo Core (Export para PDF)\n`;
out += `\nGerado em: ${new Date().toISOString()}\n`;
out += `\nTotal de ficheiros incluídos: ${selected.length}\n`;

for (const f of selected) out += renderFile(f);

fs.writeFileSync(OUT_MD, out, "utf8");
console.log(`✅ Gerado: ${path.relative(ROOT, OUT_MD)} (${selected.length} ficheiros)`);

console.log("\n🎯 Próximo passo: abre o Markdown e exporta para PDF no VS Code.");
console.log("   Ficheiro: exports-core/ORYA_REPO_CORE.md");
