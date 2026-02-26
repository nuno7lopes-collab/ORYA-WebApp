import fs from "node:fs";
import path from "node:path";

export const SNAPSHOT_REQUIRED_STATUSES = [
  "CONFIRMED",
  "COMPLETED",
  "NO_SHOW",
  "DISPUTED",
] as const;

const SNAPSHOT_REQUIRED_STATUS_PATTERN = SNAPSHOT_REQUIRED_STATUSES.join("|");
const BOOKING_MUTATION_CALL_RE =
  /\b(?:prisma|tx)\.booking\.(?:create|createMany|update|updateMany|upsert)\s*\(/g;
const BOOKING_WRITE_SQL_RE =
  /\b(?:INSERT\s+INTO|UPDATE)\s+(?:app_v3\.)?bookings\b[\s\S]*?(?:;|$)/gi;
const STATUS_ASSIGNMENT_RE = new RegExp(
  `\\bstatus\\s*:\\s*(?:BookingStatus\\.)?(?:["'])?(?:${SNAPSHOT_REQUIRED_STATUS_PATTERN})(?:["'])?\\b`,
  "i",
);
const STATUS_LITERAL_RE = new RegExp(
  `\\b(?:BookingStatus\\.)?(?:["'])?(?:${SNAPSHOT_REQUIRED_STATUS_PATTERN})(?:["'])?\\b`,
  "i",
);

const SNAPSHOT_SCRIPT_FIELDS = [
  "confirmationSnapshot",
  "confirmationSnapshotVersion",
  "confirmationSnapshotCreatedAt",
] as const;

const SNAPSHOT_SQL_FIELDS = [
  "confirmation_snapshot",
  "confirmation_snapshot_version",
  "confirmation_snapshot_created_at",
] as const;

const SCRIPT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".cjs", ".mjs", ".sh"]);
const SCANNED_SCRIPT_EXTENSIONS = new Set([...SCRIPT_EXTENSIONS, ".sql"]);

export type SeedIntegrityViolation = {
  file: string;
  line: number | null;
  rule: string;
  message: string;
  snippet: string;
};

export type SeedIntegrityReport = {
  generatedAt: string;
  scannedFiles: number;
  violations: SeedIntegrityViolation[];
};

function normalizeRelPath(filePath: string) {
  return filePath.replace(/\\/g, "/");
}

function lineAt(content: string, index: number) {
  if (!Number.isFinite(index) || index < 0) return null;
  return content.slice(0, index).split("\n").length;
}

function compactSnippet(source: string) {
  return source.replace(/\s+/g, " ").trim().slice(0, 240);
}

function hasAllSnapshotScriptFields(source: string) {
  return SNAPSHOT_SCRIPT_FIELDS.every((field) => source.includes(field));
}

function hasAllSnapshotSqlFields(source: string) {
  const lowered = source.toLowerCase();
  return SNAPSHOT_SQL_FIELDS.every((field) => lowered.includes(field));
}

function containsSnapshotRequiredStatus(source: string) {
  return STATUS_LITERAL_RE.test(source);
}

function analyzeBookingMutationsInScript(filePath: string, source: string) {
  const violations: SeedIntegrityViolation[] = [];

  BOOKING_MUTATION_CALL_RE.lastIndex = 0;
  for (const match of source.matchAll(BOOKING_MUTATION_CALL_RE)) {
    const start = match.index ?? 0;
    const window = source.slice(start, Math.min(source.length, start + 1800));
    if (!STATUS_ASSIGNMENT_RE.test(window)) continue;
    if (hasAllSnapshotScriptFields(window)) continue;

    const missing = SNAPSHOT_SCRIPT_FIELDS.filter((field) => !window.includes(field));
    violations.push({
      file: normalizeRelPath(filePath),
      line: lineAt(source, start),
      rule: "BOOKING_MUTATION_SNAPSHOT_FIELDS_MISSING",
      message: `Mutação de booking com status final sem snapshot completo (faltam: ${missing.join(", ")}).`,
      snippet: compactSnippet(window),
    });
  }

  const hasMutation = /\b(?:prisma|tx)\.booking\.(?:create|createMany|update|updateMany|upsert)\s*\(/.test(
    source,
  );
  if (hasMutation && containsSnapshotRequiredStatus(source) && !hasAllSnapshotScriptFields(source)) {
    violations.push({
      file: normalizeRelPath(filePath),
      line: null,
      rule: "BOOKING_MUTATION_SNAPSHOT_GUARD_MISSING_FILE_LEVEL",
      message:
        "Ficheiro muta bookings e referencia estados finais sem garantir snapshot completo no próprio payload.",
      snippet: compactSnippet(source),
    });
  }

  return violations;
}

type SqlStatement = { source: string; index: number };

function splitSqlStatements(source: string): SqlStatement[] {
  const statements: SqlStatement[] = [];
  let start = 0;
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] !== ";") continue;
    const chunk = source.slice(start, i + 1);
    if (chunk.trim().length > 0) {
      statements.push({ source: chunk, index: start });
    }
    start = i + 1;
  }

  const tail = source.slice(start);
  if (tail.trim().length > 0) {
    statements.push({ source: tail, index: start });
  }
  return statements;
}

function analyzeSqlStatement(filePath: string, fullSource: string, statement: SqlStatement) {
  const normalizedStatement = statement.source.toLowerCase();
  const touchesBookings =
    /\binsert\s+into\s+(?:app_v3\.)?bookings\b/i.test(statement.source) ||
    /\bupdate\s+(?:app_v3\.)?bookings\b/i.test(statement.source);
  if (!touchesBookings) return null;

  const referencesFinalStatus = containsSnapshotRequiredStatus(statement.source);
  if (!referencesFinalStatus) return null;

  if (hasAllSnapshotSqlFields(statement.source)) return null;

  const missing = SNAPSHOT_SQL_FIELDS.filter((field) => !normalizedStatement.includes(field));
  return {
    file: normalizeRelPath(filePath),
    line: lineAt(fullSource, statement.index),
    rule: "BOOKING_SQL_SNAPSHOT_FIELDS_MISSING",
    message: `SQL de escrita em bookings com status final sem colunas de snapshot completas (faltam: ${missing.join(", ")}).`,
    snippet: compactSnippet(statement.source),
  } satisfies SeedIntegrityViolation;
}

function analyzeBookingWritesInSql(filePath: string, source: string) {
  const violations: SeedIntegrityViolation[] = [];
  for (const statement of splitSqlStatements(source)) {
    const violation = analyzeSqlStatement(filePath, source, statement);
    if (violation) {
      violations.push(violation);
    }
  }
  return violations;
}

function analyzeInlineSqlInScript(filePath: string, source: string) {
  const violations: SeedIntegrityViolation[] = [];
  BOOKING_WRITE_SQL_RE.lastIndex = 0;
  for (const match of source.matchAll(BOOKING_WRITE_SQL_RE)) {
    const snippet = match[0];
    if (!containsSnapshotRequiredStatus(snippet)) continue;
    if (hasAllSnapshotSqlFields(snippet)) continue;

    const lowered = snippet.toLowerCase();
    const missing = SNAPSHOT_SQL_FIELDS.filter((field) => !lowered.includes(field));
    violations.push({
      file: normalizeRelPath(filePath),
      line: lineAt(source, match.index ?? 0),
      rule: "BOOKING_INLINE_SQL_SNAPSHOT_FIELDS_MISSING",
      message: `SQL inline de escrita em bookings com status final sem colunas de snapshot completas (faltam: ${missing.join(", ")}).`,
      snippet: compactSnippet(snippet),
    });
  }
  return violations;
}

export function analyzeSeedIntegritySource(filePath: string, source: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".sql") {
    return analyzeBookingWritesInSql(filePath, source);
  }
  if (!SCRIPT_EXTENSIONS.has(extension)) return [];

  return [
    ...analyzeBookingMutationsInScript(filePath, source),
    ...analyzeInlineSqlInScript(filePath, source),
  ];
}

function uniqueSorted(items: string[]) {
  return Array.from(new Set(items.map(normalizeRelPath))).sort();
}

function collectSqlFiles(rootDir: string, relDir: string): string[] {
  const absoluteDir = path.join(rootDir, relDir);
  if (!fs.existsSync(absoluteDir)) return [];

  const stack = [absoluteDir];
  const collected: string[] = [];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absPath);
        continue;
      }
      if (path.extname(entry.name).toLowerCase() !== ".sql") continue;
      collected.push(path.relative(rootDir, absPath));
    }
  }
  return collected;
}

function collectScriptTreeFiles(rootDir: string, relDir: string): string[] {
  const absoluteDir = path.join(rootDir, relDir);
  if (!fs.existsSync(absoluteDir)) return [];

  const stack = [absoluteDir];
  const collected: string[] = [];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absPath);
        continue;
      }
      if (!SCANNED_SCRIPT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      collected.push(path.relative(rootDir, absPath));
    }
  }
  return collected;
}

export function collectSeedIntegrityCandidates(rootDir: string) {
  const allowlistPath = path.join(rootDir, "scripts", "manifests", "operational_scripts_allowlist_v1.json");
  if (!fs.existsSync(allowlistPath)) {
    throw new Error("Missing scripts/manifests/operational_scripts_allowlist_v1.json");
  }

  const manifest = JSON.parse(fs.readFileSync(allowlistPath, "utf8")) as {
    scriptsByEnvironment?: Record<string, unknown>;
    discovery?: { extraOperationalPaths?: unknown };
  };

  const candidates: string[] = [];
  const scriptsByEnvironment = manifest.scriptsByEnvironment ?? {};
  for (const values of Object.values(scriptsByEnvironment)) {
    if (!Array.isArray(values)) continue;
    for (const scriptPath of values) {
      if (typeof scriptPath === "string") {
        candidates.push(scriptPath);
      }
    }
  }

  const extraOperationalPaths = manifest.discovery?.extraOperationalPaths;
  if (Array.isArray(extraOperationalPaths)) {
    for (const scriptPath of extraOperationalPaths) {
      if (typeof scriptPath === "string") {
        candidates.push(scriptPath);
      }
    }
  }

  candidates.push(...collectSqlFiles(rootDir, "scripts/db"));
  candidates.push(...collectScriptTreeFiles(rootDir, "scripts"));
  return uniqueSorted(candidates);
}

export function runSeedIntegrityGate(rootDir: string): SeedIntegrityReport {
  const candidates = collectSeedIntegrityCandidates(rootDir);
  const violations: SeedIntegrityViolation[] = [];

  for (const relPath of candidates) {
    const absPath = path.join(rootDir, relPath);
    if (!fs.existsSync(absPath)) {
      violations.push({
        file: relPath,
        line: null,
        rule: "FILE_MISSING",
        message: "Ficheiro listado no catálogo operacional não existe.",
        snippet: relPath,
      });
      continue;
    }
    const source = fs.readFileSync(absPath, "utf8");
    violations.push(...analyzeSeedIntegritySource(relPath, source));
  }

  return {
    generatedAt: new Date().toISOString(),
    scannedFiles: candidates.length,
    violations,
  };
}
