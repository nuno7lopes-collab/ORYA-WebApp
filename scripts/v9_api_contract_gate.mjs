import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const API_ROOT = path.join(ROOT, "app", "api");
const ROUTE_REGEX = /\/route\.(ts|tsx|js|jsx)$/;

function listFiles(dir) {
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

const files = fs.existsSync(API_ROOT) ? listFiles(API_ROOT).filter((f) => ROUTE_REGEX.test(f)) : [];

const missingEnvelope = [];
const nextResponseJson = [];
const rawResponse = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file);

  // Some routes are thin adapters that delegate directly to canonical handlers
  // where envelope helpers are enforced.
  const delegatesToCanonicalHandler = /from\s+["']@\/lib\/messages\/handlers\//.test(content);
  const delegatesViaApiReexport = /^export\s+\*\s+from\s+["']@\/app\/api\/.+\/route["'];?\s*$/m.test(content);

  const hasEnvelopeHelper =
    /withApiEnvelope\s*\(/.test(content) ||
    /respondOk\s*\(/.test(content) ||
    /respondError\s*\(/.test(content) ||
    /respondPlainText\s*\(/.test(content) ||
    /jsonWrap\s*\(/.test(content) ||
    delegatesToCanonicalHandler ||
    delegatesViaApiReexport;

  if (!hasEnvelopeHelper) {
    missingEnvelope.push(rel);
  }

  if (/NextResponse\.json\s*\(/.test(content)) {
    nextResponseJson.push(rel);
  }

  if (/new Response\s*\(/.test(content)) {
    rawResponse.push(rel);
  }
}

function report(label, items) {
  if (items.length === 0) return;
  console.error(`\n[${label}]`);
  for (const item of items) console.error(`- ${item}`);
}

const hasFailures = missingEnvelope.length || nextResponseJson.length || rawResponse.length;
if (hasFailures) {
  report("ROUTES WITHOUT ENVELOPE HELPERS", missingEnvelope);
  report("NextResponse.json USAGE", nextResponseJson);
  report("new Response USAGE", rawResponse);
  process.exit(1);
}

console.log("V9 API contract gate: OK");
