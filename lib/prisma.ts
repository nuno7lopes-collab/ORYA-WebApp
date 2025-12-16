// lib/prisma.ts
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "@/lib/env";

// Pool para ligar ao Postgres do Supabase
const pool = new Pool({
  connectionString: env.dbUrl, // usa a chave que já tens no env.ts
  ssl:
    process.env.NODE_ENV === "production"
      ? undefined // em produção usas SSL normal (já tens sslmode=require na connection string)
      : { rejectUnauthorized: false }, // em dev ignoras o certificado (já estavas a fazer)
});

const adapter = new PrismaPg(pool);

// Toggle de logs verbose (queries) via env: PRISMA_LOG_QUERIES=true
const enableQueryLog = process.env.PRISMA_LOG_QUERIES === "true";
const logLevels: (Prisma.LogLevel | Prisma.LogDefinition)[] =
  process.env.NODE_ENV === "development"
    ? enableQueryLog
      ? ["query", "error", "warn"]
      : ["error", "warn"]
    : ["error"];

// Evitar múltiplas instâncias em dev (hot reload)
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: logLevels,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
