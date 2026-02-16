import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SSOT_PATH = path.join(ROOT, "docs", "ssot_registry_v1.md");
const NORMATIVE_MODE = process.env.SSOT_NORMATIVE_MODE ?? "DOMAIN_TRANSITION";
const AUXILIARY_TRACEABILITY_DOCS = [
  "docs/arbitration_service_spec.md",
  "docs/ws_handshake_and_jwt_claims.md",
  "docs/split_v2_ssot.md",
  "docs/SPLIT_V2.md",
  "docs/identity_merge_log_spec.md",
  "docs/identidade_auth_sessao_cookies_mobile_access.md",
  "docs/policies_organizacao_fechado.md",
  "docs/dashboard_org_decisions.md",
  "docs/calendario_motor_unico.md",
  "docs/reservas.md",
  "docs/padel.md",
  "docs/fecho_unificado_normativo.md",
  "docs/legacy_cut_plan.md",
  "docs/organizacoes_multiorg.md",
  "docs/identidade_auth_historico_pre_fecho.md",
];
const DOMAIN_AUTHORITY_DOCS = new Set([
  "docs/dashboard_org_decisions.md",
  "docs/calendario_motor_unico.md",
  "docs/organizacoes_multiorg.md",
  "docs/padel.md",
  "docs/reservas.md",
  "docs/identidade_auth_sessao_cookies_mobile_access.md",
  "docs/SPLIT_V2.md",
  "docs/split_v2_ssot.md",
]);
const PLANNING_DOC = "docs/planning_registry_v1.md";
const DOCS_DIR = path.join(ROOT, "docs");
const ENFORCE_SINGLE_DOC = process.env.SSOT_ENFORCE_SINGLE_DOC === "1";
const IS_DOMAIN_TRANSITION = NORMATIVE_MODE === "DOMAIN_TRANSITION";
const IS_SSOT_ONLY = NORMATIVE_MODE === "SSOT_ONLY";

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

for (const doc of AUXILIARY_TRACEABILITY_DOCS) {
  const full = path.join(ROOT, doc);
  if (!fs.existsSync(full)) {
    if (IS_DOMAIN_TRANSITION && DOMAIN_AUTHORITY_DOCS.has(doc)) {
      violations.push(`Missing required domain authority doc during DOMAIN_TRANSITION: ${doc}`);
    }
    continue;
  }

  const raw = fs.readFileSync(full, "utf8");
  const headerSample = raw.split(/\r?\n/).slice(0, 40).join("\n");
  const isDomainAuthorityDoc = DOMAIN_AUTHORITY_DOCS.has(doc);

  if (IS_SSOT_ONLY || !isDomainAuthorityDoc) {
    if (!/Estado documental:\s*`RASTREABILIDADE_TECNICA`\s*\(`NAO_NORMATIVO`\)/i.test(raw)) {
      violations.push(`${doc}: missing required non-normative traceability header.`);
    }

    if (/Autoridade\s+normativa\s+unica/i.test(headerSample)) {
      violations.push(`${doc}: must not declare normative authority in the auxiliary header.`);
    }

    if (/\(NORMATIVO\)/i.test(headerSample)) {
      violations.push(`${doc}: top header must not contain explicit normative markers.`);
    }

    if (/único\s+documento\s+normativo/i.test(raw) || /unico\s+documento\s+normativo/i.test(raw)) {
      violations.push(`${doc}: auxiliary docs must not claim to be normative authority.`);
    }
  }
}

if (fs.existsSync(DOCS_DIR)) {
  const docFiles = fs.readdirSync(DOCS_DIR).filter((file) => file.endsWith(".md"));

  if (IS_SSOT_ONLY) {
    for (const file of docFiles) {
      const rel = `docs/${file}`;
      if (rel === path.relative(ROOT, SSOT_PATH)) continue;
      if (rel === PLANNING_DOC) continue;

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
}

if (violations.length > 0) {
  fail(violations);
}

console.log(`SSOT normative gate: OK (${NORMATIVE_MODE})`);
