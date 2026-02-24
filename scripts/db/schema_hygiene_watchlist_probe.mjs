#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

function parseArgs(argv) {
  const args = {
    watchlist: "reports/schema_hygiene_dev_watchlist_columns_2026-02-24.csv",
    out: "reports/schema_hygiene_watchlist_probe_2026-02-24.json",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--watchlist") args.watchlist = argv[i + 1] ?? args.watchlist;
    if (arg === "--out") args.out = argv[i + 1] ?? args.out;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const watchlistPath = path.resolve(process.cwd(), args.watchlist);
  const outPath = path.resolve(process.cwd(), args.out);
  const watchlist = parseCsvSimple(watchlistPath);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const probe = [];
  for (const item of watchlist) {
    const table = item.table;
    const column = item.column;

    const query = `
      SELECT
        COUNT(*)::int AS total_rows,
        COUNT(*) FILTER (WHERE ${column} IS NOT NULL)::int AS not_null_rows
      FROM app_v3.${table};
    `;
    const result = await client.query(query);
    probe.push({
      table,
      column,
      status: item.status,
      totalRows: Number(result.rows[0]?.total_rows ?? 0),
      notNullRows: Number(result.rows[0]?.not_null_rows ?? 0),
    });
  }

  await client.end();

  const payload = {
    generatedAt: new Date().toISOString(),
    watchlistFile: args.watchlist,
    totalColumns: probe.length,
    activeColumns: probe.filter((p) => p.notNullRows > 0).length,
    items: probe,
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`[schema-hygiene-watchlist-probe] watchlist: ${args.watchlist}`);
  console.log(`[schema-hygiene-watchlist-probe] out: ${args.out}`);
  console.log(`[schema-hygiene-watchlist-probe] columns: ${probe.length}`);
}

main().catch((error) => {
  console.error("[schema-hygiene-watchlist-probe] failed", error);
  process.exit(1);
});
