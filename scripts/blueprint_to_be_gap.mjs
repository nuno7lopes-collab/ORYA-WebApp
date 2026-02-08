import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, "reports");
const INVENTORY_CSV = path.join(REPORT_DIR, "blueprint_to_be_inventory.csv");
const OUT_REPORT = path.join(REPORT_DIR, "blueprint_to_be_gap.md");
const OUT_DOC = path.join(ROOT, "docs", "blueprint_to_be_gap.md");

const SEARCH_GLOBS = [
  "app/**",
  "apps/**",
  "domain/**",
  "lib/**",
  "prisma/**",
  "components/**",
  "packages/**",
  "docs/**",
];

const IGNORE_GLOBS = [
  "!node_modules/**",
  "!.next/**",
  "!.expo/**",
  "!dist/**",
  "!build/**",
  "!coverage/**",
  "!reports/**",
  "!backups/**",
  "!ios/**",
  "!android/**",
  "!docs/blueprint.md",
  "!docs/orya_blueprint_v9_final.md",
  "!docs/blueprint_to_be_gap.md",
];

const STOPWORDS = new Set([
  "para",
  "com",
  "como",
  "sem",
  "uma",
  "umas",
  "uns",
  "um",
  "uma",
  "dos",
  "das",
  "del",
  "dela",
  "dele",
  "que",
  "e",
  "ou",
  "de",
  "do",
  "da",
  "no",
  "na",
  "nos",
  "nas",
  "por",
  "em",
  "ao",
  "aos",
  "as",
  "os",
  "se",
  "ser",
  "sao",
  "são",
  "nao",
  "não",
  "mais",
  "menos",
  "onde",
  "quando",
  "qual",
  "quais",
  "seu",
  "sua",
  "seus",
  "suas",
  "the",
  "and",
  "with",
  "from",
  "into",
  "over",
  "under",
  "this",
  "that",
  "these",
  "those",
  "to",
  "be",
  "v1",
  "v2",
  "v3",
  "orya",
  "to-be",
  "tobe",
]);

const STRONG_TERM_SCORE = 9;

const EXTERNAL_HINTS = [
  "stripe",
  "apple",
  "maps",
  "webhook",
  "payout",
  "payouts",
  "supabase",
  "email",
  "push",
  "sms",
  "twilio",
  "payment",
  "pagamento",
  "checkout",
  "ledger",
];

const CRITICAL_TERMS = [
  "payment",
  "pagamento",
  "checkout",
  "ledger",
  "entitlement",
  "check-in",
  "checkin",
  "security",
  "segurança",
  "auth",
  "tenancy",
  "outbox",
  "payout",
  "refund",
  "reembolso",
  "stripe",
  "address",
];

function csvParseLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
    return `"${str.replace(/\"/g, '""')}"`;
  }
  return str;
}

function shQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function extractBackticks(text) {
  const matches = [];
  const re = /`([^`]+)`/g;
  let m;
  while ((m = re.exec(text))) {
    const term = m[1].trim();
    if (term) matches.push(term);
  }
  return matches;
}

function scoreToken(token) {
  let score = token.length;
  if (/[A-Z]/.test(token) && /[a-z]/.test(token)) score += 3;
  if (/[_.\/:-]/.test(token)) score += 4;
  if (/\d/.test(token)) score += 2;
  return score;
}

function extractTokens(text) {
  const tokens = new Set();
  const matches = text.match(/[\p{L}\p{N}_./-]{4,}/gu) || [];
  for (const raw of matches) {
    const cleaned = raw.replace(/^[-./]+|[-./]+$/g, "");
    if (!cleaned) continue;
    const lower = cleaned.toLowerCase();
    if (STOPWORDS.has(lower)) continue;
    if (/^\d+$/.test(cleaned)) continue;
    tokens.add(cleaned);
  }
  return Array.from(tokens);
}

function extractSearchTerms(text) {
  const backticks = extractBackticks(text);
  const backtickSet = new Set(backticks);
  const tokens = extractTokens(text);
  tokens.sort((a, b) => scoreToken(b) - scoreToken(a));
  const combined = [...backticks, ...tokens];
  const unique = [];
  const seen = new Set();
  for (const term of combined) {
    if (seen.has(term)) continue;
    seen.add(term);
    unique.push(term);
  }
  return { terms: unique.slice(0, 4), strongTerms: backtickSet };
}

function rgFiles(term) {
  const globArgs = [...SEARCH_GLOBS, ...IGNORE_GLOBS].map((glob) => `--glob ${shQuote(glob)}`).join(" ");
  const cmd = `rg -F --files-with-matches ${globArgs} ${shQuote(term)}`;
  try {
    const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    if (!out) return [];
    return out
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter(
        (file) =>
          file !== "docs/blueprint.md" &&
          file !== "docs/orya_blueprint_v9_final.md" &&
          file !== "docs/blueprint_to_be_gap.md",
      );
  } catch {
    return [];
  }
}

function isExternal(text) {
  const lower = text.toLowerCase();
  return EXTERNAL_HINTS.some((hint) => lower.includes(hint));
}

function criticalScore(text) {
  const lower = text.toLowerCase();
  let score = 0;
  for (const term of CRITICAL_TERMS) {
    if (lower.includes(term)) score += 1;
  }
  return score;
}

function shorten(text, limit = 160) {
  if (!text) return text;
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

if (!fs.existsSync(INVENTORY_CSV)) {
  console.error("Missing reports/blueprint_to_be_inventory.csv. Run blueprint_to_be_inventory.mjs first.");
  process.exit(1);
}

const csvText = fs.readFileSync(INVENTORY_CSV, "utf8");
const lines = csvText.split(/\r?\n/).filter(Boolean);
const header = lines.shift();
if (!header) {
  console.error("Empty inventory CSV");
  process.exit(1);
}

const items = lines.map((line) => {
  const [sectionPath, lineNo, kind, text] = csvParseLine(line);
  return {
    sectionPath,
    lineNo: Number(lineNo),
    kind,
    text,
  };
});

const analyzable = items.filter((item) => item.kind !== "heading" && item.kind !== "table");
const results = [];

for (const item of analyzable) {
  const { terms, strongTerms } = extractSearchTerms(item.text);
  const evidenceSet = new Set();
  const evidence = [];
  let hasCodeEvidence = false;
  let hasStrongCodeEvidence = false;

  for (const term of terms) {
    const termScore = strongTerms.has(term) ? STRONG_TERM_SCORE : scoreToken(term);
    const matches = rgFiles(term);
    for (const file of matches) {
      if (evidenceSet.has(file)) continue;
      evidenceSet.add(file);
      evidence.push(file);
      if (!file.startsWith("docs/") && !file.startsWith("reports/")) {
        hasCodeEvidence = true;
        if (termScore >= STRONG_TERM_SCORE) {
          hasStrongCodeEvidence = true;
        }
      }
      if (evidence.length >= 3) break;
    }
    if (evidence.length >= 3) break;
  }

  let status = "Missing";
  let note = "Sem evidência encontrada.";
  if (evidence.length > 0) {
    if (hasStrongCodeEvidence) {
      status = "Implemented";
      note = "Evidência encontrada em código/schema.";
    } else if (hasCodeEvidence) {
      status = "Partial";
      note = "Evidência fraca em código (termos pouco específicos).";
    } else {
      status = "Partial";
      note = "Evidência apenas em docs (ou indireta).";
    }
  } else if (isExternal(item.text)) {
    status = "Unknown";
    note = "Provável dependência externa/runtime; requer validação manual.";
  }

  results.push({
    ...item,
    status,
    note,
    evidence,
    terms,
  });
}

const counts = results.reduce((acc, item) => {
  acc[item.status] = (acc[item.status] || 0) + 1;
  return acc;
}, {});

const now = new Date().toISOString();
const reportLines = [
  "# Blueprint TO-BE Gap Report",
  "",
  `Generated: ${now}`,
  "",
  "## Summary",
  `- Implemented: ${counts.Implemented || 0}`,
  `- Partial: ${counts.Partial || 0}`,
  `- Missing: ${counts.Missing || 0}`,
  `- Unknown: ${counts.Unknown || 0}`,
  "",
  "## Items",
];

for (const item of results) {
  reportLines.push(
    `- [${item.status}] L${item.lineNo} | ${item.sectionPath} | ${item.text}`,
  );
  reportLines.push(`Evidence: ${item.evidence.length ? item.evidence.join(", ") : "none"}`);
  reportLines.push(`Search terms: ${item.terms.length ? item.terms.join(", ") : "none"}`);
  reportLines.push(`Note: ${item.note}`);
  reportLines.push("");
}

fs.writeFileSync(OUT_REPORT, reportLines.join("\n"), "utf8");

const gaps = results.filter(
  (item) =>
    item.status === "Missing" || item.status === "Unknown" || item.status === "Partial",
);
const implemented = results.filter((item) => item.status === "Implemented");

gaps.sort((a, b) => {
  const diff = criticalScore(b.text) - criticalScore(a.text);
  if (diff !== 0) return diff;
  return a.lineNo - b.lineNo;
});

implemented.sort((a, b) => {
  const diff = criticalScore(b.text) - criticalScore(a.text);
  if (diff !== 0) return diff;
  return a.lineNo - b.lineNo;
});

const topGaps = gaps.slice(0, 5);
const topImplemented = implemented.slice(0, 5);

const docLines = [
  "# Blueprint TO-BE — Gap Summary",
  "",
  `Generated: ${now}`,
  "",
  "## Resumo",
  `- Implemented: ${counts.Implemented || 0}`,
  `- Partial: ${counts.Partial || 0}`,
  `- Missing: ${counts.Missing || 0}`,
  `- Unknown: ${counts.Unknown || 0}`,
  "",
  "## Top 5 gaps críticos",
  ...(topGaps.length
    ? topGaps.map(
        (item) =>
          `- [${item.status}] L${item.lineNo} | ${item.sectionPath} | ${shorten(item.text)}`,
      )
    : ["- none"]),
  "",
  "## Implementados relevantes",
  ...(topImplemented.length
    ? topImplemented.map(
        (item) =>
          `- [${item.status}] L${item.lineNo} | ${item.sectionPath} | ${shorten(item.text)}`,
      )
    : ["- none"]),
  "",
  "## Limitações",
  "- Classificação baseada em heurística e busca textual; não substitui validação manual.",
  "- Itens com dependências externas/runtime podem aparecer como Unknown ou Partial.",
  `- Report completo em ${path.relative(ROOT, OUT_REPORT)}.`,
];

fs.writeFileSync(OUT_DOC, docLines.join("\n"), "utf8");

console.log("Blueprint TO-BE gap report: OK");
