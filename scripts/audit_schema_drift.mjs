import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SCHEMA_PATH = path.join(ROOT, "prisma", "schema.prisma");
const MIGRATIONS_DIR = path.join(ROOT, "prisma", "migrations");
const OUTPUT_PATH = path.join(ROOT, "reports", "audit-schema-drift.md");

const SCALAR_TYPES = new Set([
  "String",
  "Int",
  "Boolean",
  "DateTime",
  "Json",
  "Decimal",
  "Float",
  "BigInt",
  "Bytes",
]);

function readFileSafe(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function parseEnums(schema) {
  const enums = new Set();
  const enumRegex = /enum\\s+(\\w+)\\s*\\{/g;
  let match;
  while ((match = enumRegex.exec(schema))) {
    enums.add(match[1]);
  }
  return enums;
}

function parseModels(schema, enumNames) {
  const models = [];
  const modelRegex = /model\\s+(\\w+)\\s*\\{/g;
  let match;
  while ((match = modelRegex.exec(schema))) {
    const name = match[1];
    const start = match.index;
    const braceStart = schema.indexOf("{", start);
    if (braceStart === -1) continue;
    let depth = 0;
    let end = -1;
    for (let i = braceStart; i < schema.length; i++) {
      const ch = schema[i];
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue;
    const body = schema.slice(braceStart + 1, end);
    const lines = body.split(/\\r?\\n/);
    let table = name;
    let schemaName = null;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("@@map(")) {
        const m = trimmed.match(/@@map\\(\"([^\"]+)\"\\)/);
        if (m) table = m[1];
      }
      if (trimmed.startsWith("@@schema(")) {
        const m = trimmed.match(/@@schema\\(\"([^\"]+)\"\\)/);
        if (m) schemaName = m[1];
      }
    }

    const fields = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("///")) continue;
      if (trimmed.startsWith("@@")) continue;
      const fieldMatch = trimmed.match(/^(\\w+)\\s+([\\w\\[\\]\\?]+)\\s*(.*)$/);
      if (!fieldMatch) continue;
      const fieldName = fieldMatch[1];
      let fieldType = fieldMatch[2];
      const attributes = fieldMatch[3] ?? "";
      if (attributes.includes("@relation")) continue;
      fieldType = fieldType.replace("?", "").replace("[]", "");
      if (!SCALAR_TYPES.has(fieldType) && !enumNames.has(fieldType)) continue;
      let column = fieldName;
      const mapMatch = attributes.match(/@map\\(\"([^\"]+)\"\\)/);
      if (mapMatch) column = mapMatch[1];
      fields.push({ fieldName, column });
    }

    models.push({ name, table, schema: schemaName, fields });
  }
  return models;
}

function normalizeIdentifier(raw) {
  if (!raw) return null;
  return raw.replace(/\"/g, "").trim();
}

function parseMigrations() {
  const columns = new Map(); // key: schema.table, value: Set of columns
  if (!fs.existsSync(MIGRATIONS_DIR)) return columns;
  const migrations = fs.readdirSync(MIGRATIONS_DIR);
  for (const entry of migrations) {
    const sqlPath = path.join(MIGRATIONS_DIR, entry, "migration.sql");
    if (!fs.existsSync(sqlPath)) continue;
    const content = readFileSafe(sqlPath);

    const createRegex = /CREATE TABLE\s+(IF NOT EXISTS\s+)?([^\s(]+)\s*\(/gi;
    let match;
    while ((match = createRegex.exec(content))) {
      const rawTable = match[2];
      const tableIdent = normalizeIdentifier(rawTable);
      if (!tableIdent) continue;
      const tableParts = tableIdent.split(".");
      const tableName = tableParts.pop();
      const schemaName = tableParts.length ? tableParts.pop() : null;
      const key = `${schemaName ?? "public"}.${tableName}`;
      if (!columns.has(key)) columns.set(key, new Set());
      const start = match.index + match[0].length;
      let depth = 1;
      let end = -1;
      for (let i = start; i < content.length; i++) {
        const ch = content[i];
        if (ch === "(") depth += 1;
        else if (ch === ")") {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end === -1) continue;
      const block = content.slice(start, end);
      const lines = block.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("--")) continue;
        if (/^(CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|CHECK)\b/i.test(trimmed)) continue;
        const colMatch = trimmed.match(/^\"?([\w-]+)\"?\s+/);
        if (!colMatch) continue;
        columns.get(key).add(colMatch[1]);
      }
    }

    const alterRegex = /ALTER TABLE\s+([^\s]+)\s+ADD COLUMN\s+(IF NOT EXISTS\s+)?\"?([\w-]+)\"?/gi;
    while ((match = alterRegex.exec(content))) {
      const rawTable = match[1];
      const tableIdent = normalizeIdentifier(rawTable);
      if (!tableIdent) continue;
      const tableParts = tableIdent.split(".");
      const tableName = tableParts.pop();
      const schemaName = tableParts.length ? tableParts.pop() : null;
      const key = `${schemaName ?? "public"}.${tableName}`;
      if (!columns.has(key)) columns.set(key, new Set());
      const column = match[3];
      columns.get(key).add(column);
    }
  }
  return columns;
}

function writeReport(models, migrationColumns) {
  const schemaColumns = new Map();
  for (const model of models) {
    const schemaName = model.schema ?? "public";
    const key = `${schemaName}.${model.table}`;
    if (!schemaColumns.has(key)) schemaColumns.set(key, new Set());
    for (const field of model.fields) {
      schemaColumns.get(key).add(field.column);
    }
  }

  const inMigrationsNotSchema = [];
  for (const [key, cols] of migrationColumns.entries()) {
    const schemaCols = schemaColumns.get(key) ?? new Set();
    for (const col of cols) {
      if (!schemaCols.has(col)) {
        const [schemaName, table] = key.split(".");
        inMigrationsNotSchema.push(`${schemaName}.${table}.${col}`);
      }
    }
  }

  const inSchemaNotMigrations = [];
  for (const [key, cols] of schemaColumns.entries()) {
    const migrationCols = migrationColumns.get(key) ?? new Set();
    for (const col of cols) {
      if (!migrationCols.has(col)) {
        const [schemaName, table] = key.split(".");
        inSchemaNotMigrations.push(`${schemaName}.${table}.${col}`);
      }
    }
  }

  inMigrationsNotSchema.sort();
  inSchemaNotMigrations.sort();

  const lines = [];
  lines.push("# Schema Drift (migrations vs Prisma)");
  lines.push("");
  lines.push("## In migrations but not in Prisma schema (possible legacy / dropped fields)");
  lines.push("");
  lines.push("```");
  lines.push(inMigrationsNotSchema.length ? inMigrationsNotSchema.join("\n") : "(none)");
  lines.push("```");
  lines.push("");
  lines.push("## In Prisma schema but not in migrations (possible missing migrations)");
  lines.push("");
  lines.push("```");
  lines.push(inSchemaNotMigrations.length ? inSchemaNotMigrations.join("\n") : "(none)");
  lines.push("```");
  lines.push("");

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, lines.join("\n"), "utf8");
}

function main() {
  const schema = readFileSafe(SCHEMA_PATH);
  const enums = parseEnums(schema);
  const models = parseModels(schema, enums);
  const migrationColumns = parseMigrations();
  writeReport(models, migrationColumns);
  console.log(`[audit-schema-drift] Updated ${OUTPUT_PATH}`);
}

main();
