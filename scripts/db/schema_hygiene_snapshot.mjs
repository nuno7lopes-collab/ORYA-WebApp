#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";

const SCHEMA_PATH = path.join(process.cwd(), "prisma", "schema.prisma");

function parseArgs(argv) {
  const args = { baselineOut: null, diffOut: null, authOut: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--baseline-out") args.baselineOut = argv[i + 1] ?? null;
    if (arg === "--diff-out") args.diffOut = argv[i + 1] ?? null;
    if (arg === "--auth-out") args.authOut = argv[i + 1] ?? null;
  }
  if (!args.baselineOut || !args.diffOut || !args.authOut) {
    throw new Error("Usage: node scripts/db/schema_hygiene_snapshot.mjs --baseline-out <file> --diff-out <file> --auth-out <file>");
  }
  return args;
}

function toSnakeCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

function parsePrismaModels(schemaText) {
  const models = [];
  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let match;
  while ((match = modelRegex.exec(schemaText))) {
    const modelName = match[1];
    const body = match[2];
    const schemaMatch = body.match(/@@schema\("([^"]+)"\)/);
    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    const schema = schemaMatch ? schemaMatch[1] : null;
    const table = mapMatch ? mapMatch[1] : toSnakeCase(modelName);

    let fieldCount = 0;
    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("//")) continue;
      if (trimmed.startsWith("@@")) continue;
      if (trimmed.startsWith("///")) continue;
      if (trimmed.startsWith("@")) continue;
      const first = trimmed.split(/\s+/)[0] ?? "";
      if (!first || first.startsWith("@")) continue;
      fieldCount += 1;
    }

    models.push({ modelName, schema, table, fieldCount });
  }
  return models;
}

function classifyAuthTable(tableName) {
  const managed = new Set([
    "audit_log_entries",
    "flow_state",
    "identities",
    "instances",
    "mfa_amr_claims",
    "mfa_challenges",
    "mfa_factors",
    "one_time_tokens",
    "refresh_tokens",
    "saml_providers",
    "saml_relay_states",
    "schema_migrations",
    "sessions",
    "sso_domains",
    "sso_providers",
    "users",
  ]);
  if (managed.has(tableName)) {
    return { category: "supabase_managed", risk: "low" };
  }
  return { category: "custom_or_unknown", risk: "review" };
}

function fmtRows(rows) {
  if (!rows.length) return "(none)";
  return rows.map((r) => `- ${r}`).join("\n");
}

function csvEscape(value) {
  if (value == null) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const schemaText = fs.readFileSync(SCHEMA_PATH, "utf8");
  const prismaModels = parsePrismaModels(schemaText).filter((m) => m.schema === "app_v3" || m.schema === "auth");
  const blockedMissingTables = new Set(["padel_tournament_roles"]);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const dbTablesResult = await client.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema IN ('app_v3','auth') AND table_type='BASE TABLE'
    ORDER BY table_schema, table_name
  `);
  const dbColumnsResult = await client.query(`
    SELECT table_schema, table_name, count(*)::int AS column_count
    FROM information_schema.columns
    WHERE table_schema IN ('app_v3','auth')
    GROUP BY table_schema, table_name
  `);
  const dbViewsResult = await client.query(`
    SELECT table_schema, table_name
    FROM information_schema.views
    WHERE table_schema IN ('app_v3','auth')
    ORDER BY table_schema, table_name
  `);
  const fnResult = await client.query(`
    SELECT n.nspname AS schema_name, p.proname AS function_name, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('app_v3','auth')
    ORDER BY n.nspname, p.proname
  `);
  const triggerResult = await client.query(`
    SELECT event_object_schema AS schema_name, event_object_table AS table_name, trigger_name
    FROM information_schema.triggers
    WHERE trigger_schema IN ('app_v3','auth')
    ORDER BY event_object_schema, event_object_table, trigger_name
  `);
  const enumResult = await client.query(`
    SELECT n.nspname AS schema_name, t.typname AS enum_name
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typtype='e' AND n.nspname IN ('app_v3','auth')
    ORDER BY n.nspname, t.typname
  `);

  await client.end();

  const dbTables = dbTablesResult.rows.map((r) => ({ schema: r.table_schema, table: r.table_name }));
  const dbTableSet = new Set(dbTables.map((r) => `${r.schema}.${r.table}`));
  const dbColumnCount = new Map(
    dbColumnsResult.rows.map((r) => [`${r.table_schema}.${r.table_name}`, Number(r.column_count) || 0]),
  );

  const modelKey = (schema, table) => `${schema}.${table}`;
  const modelByKey = new Map(prismaModels.map((m) => [modelKey(m.schema, m.table), m]));

  const appTables = dbTables.filter((t) => t.schema === "app_v3");
  const authTables = dbTables.filter((t) => t.schema === "auth");
  const appModels = prismaModels.filter((m) => m.schema === "app_v3");
  const authModels = prismaModels.filter((m) => m.schema === "auth");

  const matrixRows = [];
  matrixRows.push([
    "direction",
    "schema",
    "model_or_table",
    "mapped_name",
    "status",
    "db_columns",
    "prisma_fields",
    "notes",
  ]);

  for (const model of prismaModels) {
    const key = modelKey(model.schema, model.table);
    const exists = dbTableSet.has(key);
    const blockedMissing = model.schema === "app_v3" && blockedMissingTables.has(model.table) && !exists;
    const status = exists ? "present" : blockedMissing ? "blocked_missing" : "missing";
    const notes = blockedMissing ? "blocked_by_instruction_do_not_touch" : "";
    matrixRows.push([
      "model_to_table",
      model.schema,
      model.modelName,
      model.table,
      status,
      dbColumnCount.get(key) ?? 0,
      model.fieldCount,
      notes,
    ]);
  }

  for (const table of dbTables) {
    const key = modelKey(table.schema, table.table);
    const model = modelByKey.get(key) ?? null;
    matrixRows.push([
      "table_to_model",
      table.schema,
      table.table,
      model?.modelName ?? "",
      model ? "covered" : "orphan_table",
      dbColumnCount.get(key) ?? 0,
      model?.fieldCount ?? 0,
      model ? "" : "table_without_prisma_model",
    ]);
  }

  const matrixCsv = matrixRows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";

  const chatArtifacts = {
    tables: appTables.filter((t) => t.table.startsWith("chat_")).map((t) => t.table),
    functions: fnResult.rows
      .filter((r) => r.schema_name === "app_v3" && String(r.function_name).startsWith("chat_"))
      .map((r) => `${r.function_name}(${r.args})`),
    triggers: triggerResult.rows
      .filter((r) => r.schema_name === "app_v3" && String(r.trigger_name).startsWith("chat_"))
      .map((r) => `${r.table_name}.${r.trigger_name}`),
  };

  const nowIso = new Date().toISOString();
  const baselineMd = [
    "# Schema Baseline Snapshot",
    "",
    `- GeneratedAtUTC: ${nowIso}`,
    `- Schemas: app_v3, auth`,
    `- PrismaSchemaPath: prisma/schema.prisma`,
    "",
    "## Inventory Counts",
    "",
    `- app_v3 tables: ${appTables.length}`,
    `- auth tables: ${authTables.length}`,
    `- app_v3 prisma models: ${appModels.length}`,
    `- auth prisma models: ${authModels.length}`,
    `- app_v3 views: ${dbViewsResult.rows.filter((r) => r.table_schema === "app_v3").length}`,
    `- auth views: ${dbViewsResult.rows.filter((r) => r.table_schema === "auth").length}`,
    `- app_v3 functions: ${fnResult.rows.filter((r) => r.schema_name === "app_v3").length}`,
    `- auth functions: ${fnResult.rows.filter((r) => r.schema_name === "auth").length}`,
    `- app_v3 triggers: ${triggerResult.rows.filter((r) => r.schema_name === "app_v3").length}`,
    `- auth triggers: ${triggerResult.rows.filter((r) => r.schema_name === "auth").length}`,
    `- app_v3 enums: ${enumResult.rows.filter((r) => r.schema_name === "app_v3").length}`,
    `- auth enums: ${enumResult.rows.filter((r) => r.schema_name === "auth").length}`,
    "",
    "## Drift Summary",
    "",
    `- Prisma models missing in DB: ${matrixRows.filter((r, idx) => idx > 0 && r[0] === "model_to_table" && r[4] === "missing").length}`,
    `- Prisma models blocked missing (approved exceptions): ${matrixRows.filter((r, idx) => idx > 0 && r[0] === "model_to_table" && r[4] === "blocked_missing").length}`,
    `- DB tables without Prisma model: ${matrixRows.filter((r, idx) => idx > 0 && r[0] === "table_to_model" && r[4] === "orphan_table").length}`,
    "",
    "## app_v3 Chat Namespace Inventory",
    "",
    `- chat_* tables present: ${chatArtifacts.tables.length}`,
    fmtRows(chatArtifacts.tables),
    "",
    `- chat_* functions remaining: ${chatArtifacts.functions.length}`,
    fmtRows(chatArtifacts.functions),
    "",
    `- chat_* triggers remaining: ${chatArtifacts.triggers.length}`,
    fmtRows(chatArtifacts.triggers),
    "",
    "## auth Tables",
    "",
    ...authTables.map((t) => `- ${t.table}`),
    "",
    "## Notes",
    "",
    "- `blocked_missing` refers to explicit do-not-touch exceptions requested by product owner.",
    "- Full matrix is in the CSV artifact.",
    "",
  ].join("\n");

  const authRows = authTables.map((t) => {
    const cls = classifyAuthTable(t.table);
    return {
      table: t.table,
      category: cls.category,
      risk: cls.risk,
      columns: dbColumnCount.get(`auth.${t.table}`) ?? 0,
      prismaModeled: modelByKey.has(`auth.${t.table}`) ? "yes" : "no",
    };
  });

  const authAuditMd = [
    "# Auth Schema Audit (Read-Only)",
    "",
    `- GeneratedAtUTC: ${nowIso}`,
    "- Scope: inventory and risk classification only (no DDL executed)",
    "",
    "## Summary",
    "",
    `- auth tables: ${authTables.length}`,
    `- auth functions: ${fnResult.rows.filter((r) => r.schema_name === "auth").length}`,
    `- auth triggers: ${triggerResult.rows.filter((r) => r.schema_name === "auth").length}`,
    `- auth enums: ${enumResult.rows.filter((r) => r.schema_name === "auth").length}`,
    `- classified as supabase_managed: ${authRows.filter((r) => r.category === "supabase_managed").length}`,
    `- classified as custom_or_unknown: ${authRows.filter((r) => r.category === "custom_or_unknown").length}`,
    "",
    "## Table Classification",
    "",
    "| table | category | risk | columns | prisma_modeled |",
    "| --- | --- | --- | ---: | --- |",
    ...authRows.map((r) => `| ${r.table} | ${r.category} | ${r.risk} | ${r.columns} | ${r.prismaModeled} |`),
    "",
    "## Risk Notes",
    "",
    "- `supabase_managed`: expected Auth provider internals; avoid structural changes outside vendor guidance.",
    "- `custom_or_unknown`: requires explicit review before any DDL, but this execution remains read-only as requested.",
    "",
  ].join("\n");

  fs.mkdirSync(path.dirname(args.baselineOut), { recursive: true });
  fs.mkdirSync(path.dirname(args.diffOut), { recursive: true });
  fs.mkdirSync(path.dirname(args.authOut), { recursive: true });
  fs.writeFileSync(args.baselineOut, baselineMd, "utf8");
  fs.writeFileSync(args.diffOut, matrixCsv, "utf8");
  fs.writeFileSync(args.authOut, authAuditMd, "utf8");

  console.log(`[schema-hygiene] baseline: ${args.baselineOut}`);
  console.log(`[schema-hygiene] diff: ${args.diffOut}`);
  console.log(`[schema-hygiene] auth-audit: ${args.authOut}`);
}

main().catch((err) => {
  console.error("[schema-hygiene] failed", err);
  process.exitCode = 1;
});
