import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const TARGETS = [
  "app/api",
  "lib/http",
  "lib/security",
  "domain/finance",
  "domain/outbox",
  "domain/ops",
  "lib/checkoutSchemas.ts",
  "lib/stripe",
];

const ALLOWED_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const TODO_RE = /\b(TODO|FIXME)\b/i;

function listFiles(entry) {
  const full = path.join(ROOT, entry);
  if (!fs.existsSync(full)) return [];
  const stat = fs.statSync(full);
  if (stat.isFile()) return [full];
  const items = fs.readdirSync(full, { withFileTypes: true });
  const files = [];
  for (const item of items) {
    if (item.name.startsWith(".")) continue;
    const child = path.join(full, item.name);
    if (item.isDirectory()) {
      files.push(...listFiles(path.relative(ROOT, child)));
    } else if (ALLOWED_EXTS.has(path.extname(item.name))) {
      files.push(child);
    }
  }
  return files;
}

const matches = [];
for (const target of TARGETS) {
  for (const file of listFiles(target)) {
    const rel = path.relative(ROOT, file);
    const content = fs.readFileSync(file, "utf8");
    if (!TODO_RE.test(content)) continue;
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (TODO_RE.test(line)) {
        matches.push(`${rel}:${idx + 1} ${line.trim()}`);
      }
    });
  }
}

if (matches.length > 0) {
  console.error("V9 TODO/FIXME gate failed:");
  for (const match of matches) console.error(`- ${match}`);
  process.exit(1);
}

console.log("V9 TODO/FIXME gate: OK");
