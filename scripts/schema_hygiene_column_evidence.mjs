#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PRISMA_SCHEMA = path.join(ROOT, "prisma", "schema.prisma");

function toSnakeCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

function parseArgs(argv) {
  const args = {
    input: "reports/schema_hygiene_columns_never_populated_2026-02-24.csv",
    output: "reports/schema_hygiene_column_evidence_2026-02-24.csv",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input") args.input = argv[i + 1] ?? args.input;
    if (arg === "--output") args.output = argv[i + 1] ?? args.output;
  }
  return args;
}

function parseCsvSimple(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

function csvEscape(value) {
  const str = value == null ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function parsePrismaMappings(schemaText) {
  const mappings = new Map(); // key: table.column -> { model, field }
  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let match;
  while ((match = modelRegex.exec(schemaText))) {
    const modelName = match[1];
    const body = match[2];
    const schemaMatch = body.match(/@@schema\("([^"]+)"\)/);
    if (!schemaMatch || schemaMatch[1] !== "app_v3") continue;
    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    const tableName = mapMatch ? mapMatch[1] : toSnakeCase(modelName);

    const lines = body.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//") || line.startsWith("///")) continue;
      if (line.startsWith("@@")) continue;
      if (line.startsWith("@")) continue;
      const parts = line.split(/\s+/);
      if (parts.length < 2) continue;
      const field = parts[0];
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field)) continue;

      const mapFieldMatch = line.match(/@map\("([^"]+)"\)/);
      const column = mapFieldMatch ? mapFieldMatch[1] : toSnakeCase(field);
      mappings.set(`${tableName}.${column}`, { model: modelName, field });
    }
  }
  return mappings;
}

function shouldSkipDir(name) {
  return (
    name === "node_modules" ||
    name === ".next" ||
    name === ".git" ||
    name === "dist" ||
    name === "build" ||
    name === "coverage" ||
    name === ".turbo"
  );
}

function shouldIncludeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return [
    ".ts",
    ".tsx",
    ".js",
    ".mjs",
    ".cjs",
    ".json",
    ".sql",
    ".md",
  ].includes(ext);
}

function collectFiles(rootDir) {
  const files = [];
  if (!fs.existsSync(rootDir)) return files;
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      const base = path.basename(current);
      if (shouldSkipDir(base)) continue;
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
    } else if (stat.isFile() && shouldIncludeFile(current)) {
      files.push(current);
    }
  }
  return files;
}

function buildText(files) {
  let out = "";
  for (const filePath of files) {
    try {
      out += fs.readFileSync(filePath, "utf8") + "\n";
    } catch {
      // ignore unreadable files
    }
  }
  return out;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countMatches(text, regex) {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function evidenceFor(text, field, column) {
  const escField = escapeRegex(field);
  const escColumn = escapeRegex(column);
  const fieldDot = countMatches(text, new RegExp(`\\.${escField}\\b`, "g"));
  const fieldKey = countMatches(text, new RegExp(`\\b${escField}\\s*:`, "g"));
  const fieldString = countMatches(text, new RegExp(`["']${escField}["']`, "g"));
  const columnRaw = countMatches(text, new RegExp(`\\b${escColumn}\\b`, "g"));
  const total = fieldDot + fieldKey + fieldString + columnRaw;
  return { total, fieldDot, fieldKey, fieldString, columnRaw };
}

function decide(row, runtime, scripts, tests) {
  const runtimeRefs = Number(row.runtime_refs || 0);
  const scriptsRefs = Number(row.scripts_refs || 0);
  const testsRefs = Number(row.tests_refs || 0);
  const dbRefSignal = runtimeRefs + scriptsRefs + testsRefs;
  const codeSignal = runtime + scripts + tests;
  if (codeSignal > 0 || dbRefSignal > 0) {
    return "KEEP_DEV_REVIEW";
  }
  return "CANDIDATE_DEPRECATE";
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(ROOT, args.input);
  const outputPath = path.resolve(ROOT, args.output);

  const rows = parseCsvSimple(inputPath);
  const schemaText = fs.readFileSync(PRISMA_SCHEMA, "utf8");
  const mappings = parsePrismaMappings(schemaText);

  const runtimeFiles = [
    ...collectFiles(path.join(ROOT, "app")),
    ...collectFiles(path.join(ROOT, "lib")),
    ...collectFiles(path.join(ROOT, "domain")),
    ...collectFiles(path.join(ROOT, "components")),
    ...collectFiles(path.join(ROOT, "apps")),
  ];
  const scriptsFiles = collectFiles(path.join(ROOT, "scripts"));
  const testsFiles = collectFiles(path.join(ROOT, "tests"));

  const runtimeText = buildText(runtimeFiles);
  const scriptsText = buildText(scriptsFiles);
  const testsText = buildText(testsFiles);

  const out = [
    [
      "table",
      "column",
      "model",
      "field",
      "runtime_signal",
      "scripts_signal",
      "tests_signal",
      "db_runtime_refs",
      "db_scripts_refs",
      "db_tests_refs",
      "decision",
    ].join(","),
  ];

  for (const row of rows) {
    const table = row.table;
    const column = row.column;
    const mapped = mappings.get(`${table}.${column}`) ?? { model: "", field: column };

    const runtime = evidenceFor(runtimeText, mapped.field, column).total;
    const scripts = evidenceFor(scriptsText, mapped.field, column).total;
    const tests = evidenceFor(testsText, mapped.field, column).total;
    const decision = decide(row, runtime, scripts, tests);

    out.push(
      [
        table,
        column,
        mapped.model,
        mapped.field,
        runtime,
        scripts,
        tests,
        Number(row.runtime_refs || 0),
        Number(row.scripts_refs || 0),
        Number(row.tests_refs || 0),
        decision,
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  fs.writeFileSync(outputPath, out.join("\n") + "\n", "utf8");
  console.log(`[schema-hygiene-column-evidence] input: ${args.input}`);
  console.log(`[schema-hygiene-column-evidence] output: ${args.output}`);
  console.log(`[schema-hygiene-column-evidence] rows: ${rows.length}`);
}

main();
