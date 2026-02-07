import fs from "fs";
import path from "path";
import { Pool } from "pg";
import "./load-env.js";

const OUTPUT_PATH = path.join(process.cwd(), "reports", "audit-db-stats.md");

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL or DIRECT_URL.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});

const QUERIES = [
  {
    title: "Top tables by live rows",
    sql: `
SELECT schemaname, relname, n_live_tup, n_dead_tup, last_autovacuum, last_analyze
FROM pg_stat_all_tables
WHERE schemaname = 'app_v3'
ORDER BY n_live_tup DESC
LIMIT 20;`,
  },
  {
    title: "Tables with most dead tuples",
    sql: `
SELECT schemaname, relname, n_live_tup, n_dead_tup, last_autovacuum, last_analyze
FROM pg_stat_all_tables
WHERE schemaname = 'app_v3'
ORDER BY n_dead_tup DESC NULLS LAST
LIMIT 20;`,
  },
  {
    title: "Unused indexes (idx_scan = 0)",
    sql: `
SELECT schemaname, relname, indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE schemaname = 'app_v3' AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 50;`,
  },
  {
    title: "High null fraction columns (possible legacy)",
    sql: `
SELECT schemaname, tablename, attname, null_frac, n_distinct
FROM pg_stats
WHERE schemaname = 'app_v3' AND null_frac > 0.98
ORDER BY null_frac DESC
LIMIT 50;`,
  },
  {
    title: "Low distinct columns (possible enums/flags, check usage)",
    sql: `
SELECT schemaname, tablename, attname, null_frac, n_distinct
FROM pg_stats
WHERE schemaname = 'app_v3' AND n_distinct BETWEEN -1 AND 5 AND null_frac < 0.5
ORDER BY n_distinct ASC
LIMIT 50;`,
  },
  {
    title: "Chat tables: high-null columns",
    sql: `
SELECT tablename, attname, null_frac, n_distinct
FROM pg_stats
WHERE schemaname = 'app_v3' AND tablename LIKE 'chat_%' AND null_frac > 0.9
ORDER BY null_frac DESC, tablename, attname
LIMIT 100;`,
  },
  {
    title: "Store tables: high-null columns",
    sql: `
SELECT tablename, attname, null_frac, n_distinct
FROM pg_stats
WHERE schemaname = 'app_v3' AND tablename LIKE 'store_%' AND null_frac > 0.9
ORDER BY null_frac DESC, tablename, attname
LIMIT 100;`,
  },
];

function escapeCell(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return str.replace(/\\|/g, "\\\\|");
}

function toMarkdownTable(rows) {
  if (!rows || rows.length === 0) return "_(no rows)_";
  const headers = Object.keys(rows[0]);
  const headerLine = `| ${headers.map(escapeCell).join(" | ")} |`;
  const sepLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((row) => `| ${headers.map((key) => escapeCell(row[key])).join(" | ")} |`)
    .join("\\n");
  return [headerLine, sepLine, body].join("\\n");
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY;");
    await client.query("SET statement_timeout = '5s';");
    await client.query("SET lock_timeout = '1s';");

    const sections = [];
    sections.push("# DB Read-only Profiling");
    sections.push("");
    sections.push(`_Generated: ${new Date().toISOString()}_`);
    sections.push("");
    sections.push("## SQL");
    sections.push("");
    sections.push("```sql");
    sections.push("BEGIN READ ONLY;");
    sections.push("SET statement_timeout = '5s';");
    sections.push("SET lock_timeout = '1s';");
    for (const q of QUERIES) {
      sections.push("");
      sections.push(`-- ${q.title}`);
      sections.push(q.sql.trim());
    }
    sections.push("");
    sections.push("COMMIT;");
    sections.push("```");
    sections.push("");
    sections.push("## Output");
    sections.push("");

    for (const q of QUERIES) {
      const res = await client.query(q.sql);
      sections.push(`### ${q.title}`);
      sections.push("");
      sections.push(toMarkdownTable(res.rows));
      sections.push("");
    }

    sections.push("_End of report._");

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, sections.join("\\n"), "utf8");
    console.log(`[audit-db-stats] Updated ${OUTPUT_PATH}`);
  } finally {
    await client.query("COMMIT;").catch(() => {});
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("[audit-db-stats] Failed:", err);
  process.exit(1);
});
