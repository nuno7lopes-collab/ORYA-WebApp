#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL no ambiente.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error"] });

async function main() {
  const errors = [];
  const constraintRows = await prisma.$queryRaw`
    SELECT conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'app_v3'
      AND t.relname = 'tournaments'
      AND c.conname IN ('tournaments_event_id_key', 'tournaments_event_id_fkey');
  `;
  const present = new Set((constraintRows || []).map((row) => row.conname));
  if (!present.has("tournaments_event_id_key")) {
    errors.push("Constraint ausente: tournaments_event_id_key");
  }
  if (!present.has("tournaments_event_id_fkey")) {
    errors.push("Constraint ausente: tournaments_event_id_fkey");
  }

  const notNullRows = await prisma.$queryRaw`
    SELECT attnotnull
    FROM pg_attribute a
    JOIN pg_class t ON t.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'app_v3'
      AND t.relname = 'tournaments'
      AND a.attname = 'event_id'
      AND a.attnum > 0;
  `;
  if (!notNullRows?.length || !notNullRows[0].attnotnull) {
    errors.push("Constraint ausente: tournaments.event_id NOT NULL");
  }

  const invalidRows = await prisma.$queryRaw`
    SELECT t.id, t.event_id
    FROM app_v3.tournaments t
    LEFT JOIN app_v3.events e ON e.id = t.event_id
    WHERE t.event_id IS NULL OR e.id IS NULL
    ORDER BY t.id;
  `;

  if (invalidRows?.length) {
    const ids = invalidRows.map((row) => `${row.id}:${row.event_id ?? "NULL"}`);
    errors.push(
      `Dados invalidos em tournaments.event_id (NULL ou orfao). IDs: ${ids.join(", ")}`
    );
  }

  if (errors.length) {
    console.error("D1.2 FAIL - Corrigir manualmente antes de prosseguir:");
    errors.forEach((err) => console.error(`- ${err}`));
    console.error("Instrucao: corrigir event_id manualmente ou remover registos invalidos.");
    process.exit(1);
  }

  console.info("D1.2 OK - tournaments.event_id integro + constraints presentes.");
}

main()
  .catch((err) => {
    console.error("Erro ao verificar tournaments.event_id:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
    await pool.end().catch(() => null);
  });
