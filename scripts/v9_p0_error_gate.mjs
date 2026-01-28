import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const PLAN_PATH = path.join(ROOT, "docs", "v9_close_plan.md");

const ALLOW_PLAIN_TEXT = new Set([
  "app/api/stripe/webhook/route.ts",
  "app/api/webhooks/stripe/route.ts",
  "app/api/organizacao/payouts/webhook/route.ts",
]);

function extractP0Routes(planText) {
  const lines = planText.split(/\r?\n/);
  const paths = new Set();
  let inSection = false;

  for (const line of lines) {
    if (line.includes("P0 endpoints")) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith("**Jobs/cron/internal**")) break;
    if (!inSection) continue;
    const matches = line.matchAll(/app\/api\/[^\s`]+\/route\.ts/g);
    for (const match of matches) {
      paths.add(match[0]);
    }
  }
  return Array.from(paths.values());
}

function extractJsonWrapObjects(content) {
  const objects = [];
  let idx = 0;
  while (idx < content.length) {
    const callIdx = content.indexOf("jsonWrap(", idx);
    if (callIdx === -1) break;
    const braceIdx = content.indexOf("{", callIdx);
    if (braceIdx === -1) {
      idx = callIdx + 1;
      continue;
    }
    let depth = 0;
    let inString = null;
    let escaped = false;
    let endIdx = -1;
    for (let i = braceIdx; i < content.length; i += 1) {
      const ch = content[i];
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === inString) {
          inString = null;
        }
        continue;
      }
      if (ch === "\"" || ch === "'" || ch === "`") {
        inString = ch;
        continue;
      }
      if (ch === "{") depth += 1;
      if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    if (endIdx !== -1) {
      objects.push(content.slice(braceIdx, endIdx + 1));
      idx = endIdx + 1;
    } else {
      idx = callIdx + 1;
    }
  }
  return objects;
}

function objectHasErrorFields(objText) {
  if (/\.\.\./.test(objText)) return true;
  return /errorCode\s*:|error\s*:|code\s*:|message\s*:/.test(objText);
}

if (!fs.existsSync(PLAN_PATH)) {
  console.error("Missing docs/v9_close_plan.md");
  process.exit(1);
}

const planText = fs.readFileSync(PLAN_PATH, "utf8");
const p0Paths = extractP0Routes(planText);

const violations = [];
const missingFiles = [];

for (const relPath of p0Paths) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    missingFiles.push(relPath);
    continue;
  }
  if (ALLOW_PLAIN_TEXT.has(relPath)) continue;
  const content = fs.readFileSync(absPath, "utf8");
  const objects = extractJsonWrapObjects(content);
  for (const objText of objects) {
    if (!/ok\s*:\s*false/.test(objText)) continue;
    if (!objectHasErrorFields(objText)) {
      violations.push(relPath);
      break;
    }
  }
}

if (missingFiles.length > 0) {
  console.warn("\n[P0 ROUTES MISSING ON DISK]");
  missingFiles.forEach((file) => console.warn(`- ${file}`));
}

if (violations.length > 0) {
  console.error("\n[P0 ROUTES WITH ok:false WITHOUT errorCode/message]");
  violations.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

console.log("V9 P0 error envelope gate: OK");
