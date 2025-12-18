// lib/prisma.ts
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "@/lib/env";

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

// Pool e adapter para usar o client engine ("library") com Postgres
const pool = new Pool({
  connectionString: env.dbUrl,
  ssl:
    process.env.NODE_ENV === "production"
      ? undefined
      : { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: logLevels,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
