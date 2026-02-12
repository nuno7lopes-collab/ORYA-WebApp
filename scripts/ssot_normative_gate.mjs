import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SSOT_PATH = path.join(ROOT, "docs", "ssot_registry_v1.md");

function fail(lines) {
  console.error("SSOT normative gate failed:");
  for (const line of lines) {
    console.error(`- ${line}`);
  }
  process.exit(1);
}

if (!fs.existsSync(SSOT_PATH)) {
  fail([`Missing ${path.relative(ROOT, SSOT_PATH)}`]);
}

const text = fs.readFileSync(SSOT_PATH, "utf8");
const lines = text.split(/\r?\n/);
const violations = [];

const ambiguousPatterns = [
  { re: /\bFase\s+A\b/i, label: "Fase A" },
  { re: /\bFase\s+B\b/i, label: "Fase B" },
  { re: /\bFase\s+C\b/i, label: "Fase C" },
  { re: /\bmais\s+tarde\b/i, label: "mais tarde" },
];

lines.forEach((line, idx) => {
  const lineNo = idx + 1;
  const hasNonNormative = /n[aã]o[- ]?normativ/i.test(line);
  if (hasNonNormative && !line.includes("docs/planning_registry_v1.md")) {
    violations.push(`L${lineNo}: non-normative marker outside explicit planning reference.`);
  }

  for (const pattern of ambiguousPatterns) {
    if (pattern.re.test(line)) {
      violations.push(`L${lineNo}: ambiguous temporal marker "${pattern.label}" is forbidden in SSOT.`);
    }
  }
});

const entitlementHeadingMatches = text.match(/^7\.2 Entitlement states \(FECHADO\)$/gm) ?? [];
if (entitlementHeadingMatches.length !== 1) {
  violations.push(`Expected exactly one "7.2 Entitlement states (FECHADO)" heading, found ${entitlementHeadingMatches.length}.`);
}

const sourceTypeHeadingMatches = text.match(/^7\.5 sourceType canónico \(FECHADO\)$/gm) ?? [];
if (sourceTypeHeadingMatches.length !== 1) {
  violations.push(`Expected exactly one "7.5 sourceType canónico (FECHADO)" heading, found ${sourceTypeHeadingMatches.length}.`);
}

const sourceTypeSummary = text.match(/### 03\.2[\s\S]*?(?=### 03\.3|## 04)/m)?.[0] ?? "";
if (sourceTypeSummary) {
  if (!/ver\s+7\.5/i.test(sourceTypeSummary)) {
    violations.push('Section 03.2 must reference section 7.5.');
  }
  if (/`TICKET_ORDER`|`BOOKING`|`PADEL_REGISTRATION`|`STORE_ORDER`/.test(sourceTypeSummary)) {
    violations.push("Section 03.2 must not duplicate canonical sourceType enum values.");
  }
}

const entitlementSummary = text.match(/### 03\.3[\s\S]*?(?=### 03\.4|## 04)/m)?.[0] ?? "";
if (entitlementSummary) {
  if (!/ver\s+7\.2/i.test(entitlementSummary)) {
    violations.push('Section 03.3 must reference section 7.2.');
  }
  if (/PENDING\s*\|\s*ACTIVE\s*\|\s*REVOKED\s*\|\s*EXPIRED\s*\|\s*SUSPENDED/.test(entitlementSummary)) {
    violations.push("Section 03.3 must not duplicate canonical entitlement states.");
  }
}

if (violations.length > 0) {
  fail(violations);
}

console.log("SSOT normative gate: OK");
