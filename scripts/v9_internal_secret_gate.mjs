import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const TARGET_DIRS = [
  path.join(ROOT, "app", "api", "internal"),
  path.join(ROOT, "app", "api", "cron"),
];
const ROUTE_REGEX = /\/route\.(ts|tsx|js|jsx)$/;

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
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

const routeFiles = TARGET_DIRS.flatMap((dir) => listFiles(dir).filter((f) => ROUTE_REGEX.test(f)));
const missingSecretGuard = [];

for (const file of routeFiles) {
  const content = fs.readFileSync(file, "utf8");
  if (!/requireInternalSecret/.test(content)) {
    missingSecretGuard.push(path.relative(ROOT, file));
  }
}

if (missingSecretGuard.length > 0) {
  console.error("\n[INTERNAL/CRON ROUTES WITHOUT requireInternalSecret]");
  missingSecretGuard.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

console.log("V9 internal secret gate: OK");
