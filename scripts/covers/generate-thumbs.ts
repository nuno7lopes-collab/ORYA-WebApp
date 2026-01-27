#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const ROOT = process.cwd();
const SRC_DIR = path.resolve(ROOT, process.env.COVER_SRC || "public/covers/library");
const THUMBS_DIR = path.resolve(ROOT, process.env.COVER_THUMBS || "public/covers/library/thumbs");
const THUMB_SIZE = Number(process.env.COVER_THUMB_SIZE || "400");
const FORCE = process.argv.includes("--force");
const DRY_RUN = process.argv.includes("--dry-run");

const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const commandExists = (cmd: string) => spawnSync("which", [cmd], { stdio: "ignore" }).status === 0;
const HAS_SIPS = commandExists("sips");
const HAS_MAGICK = commandExists("magick");

const ensureDir = (dir: string) => fs.mkdirSync(dir, { recursive: true });

const walk = (dir: string): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
};

const toThumbPath = (rel: string) => {
  const relDir = path.dirname(rel);
  const base = path.basename(rel, path.extname(rel));
  return path.join(THUMBS_DIR, relDir, `${base}.thumb.jpg`);
};

const makeThumb = (inputPath: string, outputPath: string) => {
  if (DRY_RUN) return true;
  ensureDir(path.dirname(outputPath));
  const ext = path.extname(inputPath).toLowerCase();
  if (HAS_SIPS && ext !== ".webp") {
    const result = spawnSync("sips", ["-Z", String(THUMB_SIZE), inputPath, "--out", outputPath], {
      stdio: "ignore",
    });
    if (result.status === 0) return true;
  }

  if (HAS_MAGICK) {
    const result = spawnSync(
      "magick",
      [inputPath, "-resize", `${THUMB_SIZE}x${THUMB_SIZE}>`, outputPath],
      { stdio: "ignore" },
    );
    if (result.status === 0) return true;
  }

  fs.copyFileSync(inputPath, outputPath);
  return true;
};

const main = () => {
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

  if (!HAS_SIPS && !HAS_MAGICK && !DRY_RUN) {
    console.warn("Sem sips/magick. A copiar ficheiros sem resize.");
  }

  let created = 0;
  let skipped = 0;
  files.forEach((file) => {
    const rel = path.relative(SRC_DIR, file);
    const outPath = toThumbPath(rel);
    if (!FORCE && fs.existsSync(outPath)) {
      skipped += 1;
      return;
    }
    const ok = makeThumb(file, outPath);
    if (ok) {
      created += 1;
      return;
    }
    skipped += 1;
  });

  console.log(
    DRY_RUN
      ? `[dry-run] ${files.length} ficheiros analisados.`
      : `Thumbs prontos. Criados: ${created}. Ignorados: ${skipped}.`,
  );
};

main();
