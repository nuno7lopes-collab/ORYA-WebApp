#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = process.cwd();
const SRC_DIR = path.resolve(ROOT, process.env.COVER_SRC || "public/covers/library");
const THUMBS_DIR = path.resolve(
  ROOT,
  process.env.COVER_THUMBS || "public/covers/library/thumbs"
);
const OUT_FILE = path.resolve(ROOT, "lib/coverLibrary.ts");
const THUMB_SIZE = Number(process.env.COVER_THUMB_SIZE || "400");
const FORCE = process.argv.includes("--force");
const NO_THUMBS = process.argv.includes("--no-thumbs");

const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const STOPWORDS = new Set([
  "cover",
  "event",
  "evento",
  "capa",
  "photo",
  "image",
  "img",
  "orya",
  "banner",
]);

const CATEGORY_MAP = {
  eventos: "EVENTOS",
  padel: "PADEL",
  reservas: "RESERVAS",
  geral: "GERAL",
};
const SCENARIO_MAP = {
  EVENTOS: "EVENT",
  PADEL: "TOURNAMENT",
  RESERVAS: "RESERVATION",
  GERAL: "GENERAL",
};
const USE_CASE_MAP = {
  EVENT: "cover:event",
  TOURNAMENT: "cover:tournament",
  RESERVATION: "cover:reservation",
  GENERAL: "cover:general",
};

function commandExists(cmd) {
  const result = spawnSync("which", [cmd], { stdio: "ignore" });
  return result.status === 0;
}

const HAS_SIPS = commandExists("sips");
const HAS_MAGICK = commandExists("magick");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

function toId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toLabel(name) {
  const words = name
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/);
  return words
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

function inferCategory(relPath) {
  const parts = relPath.split(path.sep);
  const first = parts[0] ? parts[0].toLowerCase() : "";
  return CATEGORY_MAP[first] || undefined;
}

function inferScenario(category) {
  return category ? SCENARIO_MAP[category] : undefined;
}

function inferUseCase(scenario) {
  return scenario ? USE_CASE_MAP[scenario] : undefined;
}

function inferPriority(name) {
  const match = name.match(/^(\d{1,3})/);
  if (!match) return 100;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, 100 - value);
}

function toUrl(relPath) {
  return `/covers/library/${relPath.split(path.sep).join("/")}`;
}

function tagsFromFilename(name) {
  const tokens = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t));
  const unique = [];
  for (const token of tokens) {
    if (!unique.includes(token)) unique.push(token);
  }
  return unique.slice(0, 6);
}

function makeThumb(inputPath, outputPath) {
  if (NO_THUMBS) return;
  if (!FORCE && fs.existsSync(outputPath)) return;
  ensureDir(path.dirname(outputPath));

  const ext = path.extname(inputPath).toLowerCase();
  if (HAS_SIPS && ext !== ".webp") {
    const result = spawnSync("sips", ["-Z", String(THUMB_SIZE), inputPath, "--out", outputPath], {
      stdio: "ignore",
    });
    if (result.status === 0) return;
  }

  if (HAS_MAGICK) {
    const result = spawnSync(
      "magick",
      [inputPath, "-resize", `${THUMB_SIZE}x${THUMB_SIZE}>`, outputPath],
      { stdio: "ignore" }
    );
    if (result.status === 0) return;
  }

  fs.copyFileSync(inputPath, outputPath);
}

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`Pasta nao encontrada: ${SRC_DIR}`);
    process.exit(1);
  }

  ensureDir(THUMBS_DIR);

  const files = walk(SRC_DIR)
    .filter((file) => EXTENSIONS.has(path.extname(file).toLowerCase()))
    .filter((file) => !path.relative(SRC_DIR, file).startsWith(`thumbs${path.sep}`));

  if (files.length === 0) {
    console.warn("Nenhuma imagem encontrada em public/covers/library.");
  }

  const entries = files.map((file) => {
    const rel = path.relative(SRC_DIR, file);
    const base = path.basename(file, path.extname(file));
    const id = toId(base);
    const label = toLabel(base) || id;
    const category = inferCategory(rel);
    const scenario = inferScenario(category);
    const useCase = inferUseCase(scenario);
    const imageUrl = toUrl(rel);
    const relDir = path.dirname(rel);
    const thumbRel = path.join("thumbs", relDir, `${base}.thumb.jpg`);
    const thumbUrl = toUrl(thumbRel);
    const thumbPath = path.join(THUMBS_DIR, relDir, `${base}.thumb.jpg`);
    makeThumb(file, thumbPath);
    const tags = tagsFromFilename(base);
    return {
      id,
      label,
      category,
      scenario,
      businessType: "GENERAL",
      useCase: useCase ? [useCase] : [],
      priority: inferPriority(base),
      active: true,
      tags,
      imageUrl,
      thumbUrl,
    };
  });

  entries.sort((a, b) => {
    const catA = a.category || "";
    const catB = b.category || "";
    if (catA !== catB) return catA.localeCompare(catB);
    return a.label.localeCompare(b.label);
  });

  const lines = [];
  lines.push("export type CoverLibraryEntry = {");
  lines.push("  id: string;");
  lines.push("  label: string;");
  lines.push("  imageUrl: string;");
  lines.push("  thumbUrl?: string;");
  lines.push('  category?: "EVENTOS" | "PADEL" | "RESERVAS" | "GERAL";');
  lines.push('  scenario?: "TOURNAMENT" | "EVENT" | "RESERVATION" | "GENERAL";');
  lines.push('  businessType?: "CLUB" | "BAR" | "RESTAURANT" | "HOTEL" | "ACADEMY" | "GENERAL";');
  lines.push("  useCase?: string[];");
  lines.push("  tags?: string[];");
  lines.push("  priority?: number;");
  lines.push("  active?: boolean;");
  lines.push("};");
  lines.push("");
  lines.push("export const REAL_COVER_LIBRARY: CoverLibraryEntry[] = [");
  for (const entry of entries) {
    const fields = [
      `id: "${entry.id}"`,
      `label: "${entry.label}"`,
      entry.category ? `category: "${entry.category}"` : null,
      entry.scenario ? `scenario: "${entry.scenario}"` : null,
      entry.businessType ? `businessType: "${entry.businessType}"` : null,
      entry.useCase && entry.useCase.length > 0 ? `useCase: ${JSON.stringify(entry.useCase)}` : null,
      typeof entry.priority === "number" ? `priority: ${entry.priority}` : null,
      entry.active === false ? "active: false" : "active: true",
      `imageUrl: "${entry.imageUrl}"`,
      entry.thumbUrl ? `thumbUrl: "${entry.thumbUrl}"` : null,
      entry.tags && entry.tags.length > 0 ? `tags: ${JSON.stringify(entry.tags)}` : null,
    ].filter(Boolean);
    lines.push(`  { ${fields.join(", ")} },`);
  }
  lines.push("];");
  lines.push("");

  fs.writeFileSync(OUT_FILE, lines.join("\n"), "utf8");
  console.log(`Catalogo gerado: ${OUT_FILE}`);
  if (!NO_THUMBS) {
    console.log(`Thumbs: ${THUMBS_DIR}`);
  }
}

main();
