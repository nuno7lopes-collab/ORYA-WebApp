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
function resolvePgSsl(url: string) {
  if (process.env.NODE_ENV === "production") return undefined;
  try {
    const parsed = new URL(url);
    const sslMode = parsed.searchParams.get("sslmode");
    const host = parsed.hostname;
    const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (sslMode === "disable" || isLocalHost) return false;
  } catch {
    // fall through to non-production default
  }
  return { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: env.dbUrl,
  ssl: resolvePgSsl(env.dbUrl),
});

const adapter = new PrismaPg(pool);

const baseClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: logLevels,
  });

export const prisma = baseClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
