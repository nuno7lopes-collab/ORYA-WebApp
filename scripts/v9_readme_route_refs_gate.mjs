import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const README_PATH = path.join(ROOT, "README_v1.md");

if (!fs.existsSync(README_PATH)) {
  console.error("Missing README_v1.md");
  process.exit(1);
}

const content = fs.readFileSync(README_PATH, "utf8");
const routeRefMatches = content.match(/`(app\/api\/[^`]*\/route\.(?:ts|tsx|js|jsx))`/g) ?? [];
const refs = Array.from(
  new Set(routeRefMatches.map((entry) => entry.slice(1, -1))),
);

const missing = refs.filter((rel) => !fs.existsSync(path.join(ROOT, rel)));

if (missing.length > 0) {
  console.error("\n[README ROUTE REFS GATE] Missing route files referenced in README_v1.md:");
  for (const rel of missing) {
    console.error(`- ${rel}`);
  }
  process.exit(1);
}

console.log("V9 README route refs gate: OK");
