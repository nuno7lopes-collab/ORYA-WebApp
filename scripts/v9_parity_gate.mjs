import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const reportPath = path.join(ROOT, "docs", "v9_parity_report.md");

if (!fs.existsSync(reportPath)) {
  console.error("V9 parity gate: missing docs/v9_parity_report.md");
  process.exit(1);
}

const content = fs.readFileSync(reportPath, "utf8");

function sectionHasItems(title) {
  const marker = `## ${title}`;
  const idx = content.indexOf(marker);
  if (idx === -1) return false;
  const slice = content.slice(idx + marker.length);
  const nextIdx = slice.indexOf("\n## ");
  const section = nextIdx === -1 ? slice : slice.slice(0, nextIdx);
  return section
    .split("\n")
    .map((line) => line.trim())
    .some((line) => line.startsWith("- "));
}

const missingUsed = sectionHasItems("B) Frontend chama endpoint inexistente");
const legacyUsed = sectionHasItems("C) Frontend chama endpoint legacy/410");

if (missingUsed || legacyUsed) {
  console.error("V9 parity gate failed:");
  if (missingUsed) console.error("- Frontend calls non-existent endpoints");
  if (legacyUsed) console.error("- Frontend calls legacy/410 endpoints");
  process.exit(1);
}

console.log("V9 parity gate: OK");
