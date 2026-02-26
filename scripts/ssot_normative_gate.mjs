import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SSOT_PATH = path.join(ROOT, "docs", "ssot_registry_v1.md");
const DOCS_DIR = path.join(ROOT, "docs");
const NORMATIVE_MODE = process.env.SSOT_NORMATIVE_MODE ?? "SSOT_ONLY";
const ENFORCE_SINGLE_DOC = process.env.SSOT_ENFORCE_SINGLE_DOC === "1";
const IS_DOMAIN_TRANSITION = NORMATIVE_MODE === "DOMAIN_TRANSITION";
const IS_SSOT_ONLY = NORMATIVE_MODE === "SSOT_ONLY";
const FORBIDDEN_EXTERNAL_REFS = [
  "docs/planning_registry_v1.md",
  "docs/ssot_registry_v1_source_snapshot_2026-02-14.md",
  "docs/ssot_canonical_groups_mapping_v1.json",
];

function fail(lines) {
  console.error("SSOT normative gate failed:");
  for (const line of lines) {
    console.error(`- ${line}`);
  }
  process.exit(1);
}

function collectBacktickPathRefs(rawText) {
  const refs = new Set();
  const blocks = rawText.match(/`[^`]+`/g) ?? [];
  const tokenRegex =
    /(?:^|[\s,(])((?:app|docs|tests|domain|lib|apps|scripts|prisma|reports)\/[A-Za-z0-9_[\](){}./*\-]+(?::\d+(?::\d+)?)?)/g;

  for (const block of blocks) {
    const content = block.slice(1, -1);
    let match;
    while ((match = tokenRegex.exec(content)) !== null) {
      const token = match[1].replace(/[),.;]+$/, "");
      refs.add(token);
    }
  }

  return Array.from(refs).sort();
}

if (!fs.existsSync(SSOT_PATH)) {
  fail([`Missing ${path.relative(ROOT, SSOT_PATH)}`]);
}

if (!IS_DOMAIN_TRANSITION && !IS_SSOT_ONLY) {
  fail([
    `Invalid SSOT_NORMATIVE_MODE="${NORMATIVE_MODE}". Allowed values: DOMAIN_TRANSITION | SSOT_ONLY`,
  ]);
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
    violations.push("Section 03.2 must reference section 7.5.");
  }
  if (/`TICKET_ORDER`|`BOOKING`|`PADEL_REGISTRATION`|`STORE_ORDER`/.test(sourceTypeSummary)) {
    violations.push("Section 03.2 must not duplicate canonical sourceType enum values.");
  }
}

const entitlementSummary = text.match(/### 03\.3[\s\S]*?(?=### 03\.4|## 04)/m)?.[0] ?? "";
if (entitlementSummary) {
  if (!/ver\s+7\.2/i.test(entitlementSummary)) {
    violations.push("Section 03.3 must reference section 7.2.");
  }
  if (/PENDING\s*\|\s*ACTIVE\s*\|\s*REVOKED\s*\|\s*EXPIRED\s*\|\s*SUSPENDED/.test(entitlementSummary)) {
    violations.push("Section 03.3 must not duplicate canonical entitlement states.");
  }
}

if (!/### 00\.6\.2 Workflow de Decisão do Owner \(NORMATIVO\)/.test(text)) {
  violations.push("Missing section 00.6.2 Workflow de Decisão do Owner (NORMATIVO).");
}

if (!/## 104\) Quadro de Decisão do Owner \(Operacional\)/.test(text)) {
  violations.push("Missing section 104) Quadro de Decisão do Owner (Operacional).");
}

const section104 = text.match(/## 104\)[\s\S]*$/)?.[0] ?? "";
if (section104) {
  const hasPendingStatus = /`(PROPOSTA_OWNER|EM_REVISAO_OWNER)`/.test(section104);
  const hasDecisionRows = /^\|\s*`SSOT-[^`]+`\s*\|/gm.test(section104);
  const hasEmptyState = /Estado:\s*`SEM_DECISOES_PENDENTES`/.test(section104);

  if (!hasPendingStatus) {
    if (!hasEmptyState) {
      violations.push("Section 104 must declare `SEM_DECISOES_PENDENTES` when there are no pending decisions.");
    }
    if (hasDecisionRows) {
      violations.push("Section 104 must be empty (no decision rows) when there are no pending decisions.");
    }
  }
}

for (const forbidden of FORBIDDEN_EXTERNAL_REFS) {
  if (text.includes(forbidden)) {
    violations.push(`External governance reference is forbidden in SSOT single-doc mode: ${forbidden}`);
  }
}

const gapStateSection = text.match(/## 102\)[\s\S]*?(?=\n## \d{3}\)|\s*$)/)?.[0] ?? "";
if (gapStateSection) {
  const hasExpectedState =
    /Estado desta ronda:\s*`EM_VERIFICACAO_EXECUCAO`/.test(gapStateSection) ||
    /Estado desta ronda:\s*`SEM_GAPS_NORMATIVOS`/.test(gapStateSection);
  if (!hasExpectedState) {
    violations.push(
      "Section 102 must declare Estado desta ronda as `EM_VERIFICACAO_EXECUCAO` or `SEM_GAPS_NORMATIVOS`.",
    );
  }
}

const integrityMatch = text.match(/Integridade interna:\s*`(\d+)\/(\d+)`\s*IDs mapeados/i);
if (!integrityMatch) {
  violations.push("Section 00.7 must declare Integridade interna as `<n>/<n>` IDs mapeados.");
} else {
  const covered = Number.parseInt(integrityMatch[1], 10);
  const total = Number.parseInt(integrityMatch[2], 10);
  if (covered !== total) {
    violations.push("Section 00.7 Integridade interna must use identical covered/total values.");
  }

  const section99 = text.match(/## 99\)[\s\S]*?(?=\n## 100\))/)?.[0] ?? "";
  const section99Rows = (section99.match(/^\|\s*`[^`]+`\s*\|\s*`[^`]+`\s*\|\s*`[^`]+`\s*\|$/gm) ?? []).length;
  if (section99Rows > 0 && section99Rows !== total) {
    violations.push(`Section 00.7 Integridade interna (${covered}/${total}) must match Section 99 rows (${section99Rows}).`);
  }
}

for (const ref of collectBacktickPathRefs(text)) {
  const normalized = ref.replace(/:\d+(?::\d+)?$/, "");
  if (/[{}*?]/.test(normalized) || normalized.includes("...")) {
    continue;
  }
  const full = path.join(ROOT, normalized);
  if (!fs.existsSync(full)) {
    violations.push(`SSOT path reference missing in repository: ${normalized}`);
  }
}

if (fs.existsSync(DOCS_DIR) && IS_SSOT_ONLY) {
  const docFiles = fs.readdirSync(DOCS_DIR).filter((file) => file.endsWith(".md"));

  for (const file of docFiles) {
    const rel = `docs/${file}`;
    if (rel === path.relative(ROOT, SSOT_PATH)) continue;

    const full = path.join(DOCS_DIR, file);
    const raw = fs.readFileSync(full, "utf8");

    if (/Autoridade\s+normativa\s+(u[nn]ica|única|final|exclusiva)/i.test(raw)) {
      violations.push(`${rel}: SSOT-only mode forbids normative authority declarations outside SSOT.`);
    }

    if (/único\s+documento\s+normativo/i.test(raw) || /unico\s+documento\s+normativo/i.test(raw)) {
      violations.push(`${rel}: SSOT-only mode forbids normative authority claims outside SSOT.`);
    }
  }

  if (ENFORCE_SINGLE_DOC) {
    const allowed = new Set([path.basename(SSOT_PATH)]);
    const extra = docFiles.filter((file) => !allowed.has(file));
    if (extra.length > 0) {
      violations.push(
        `SSOT-only final mode requires docs/ to keep only ${path.basename(SSOT_PATH)}. Extra files: ${extra
          .map((file) => `docs/${file}`)
          .join(", ")}`,
      );
    }
  }
}

if (violations.length > 0) {
  fail(violations);
}

console.log(`SSOT normative gate: OK (${NORMATIVE_MODE})`);
