// lib/prisma.ts
import "server-only";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "@/lib/env";
import { getAppEnv } from "@/lib/appEnv";
import { type AppEnv } from "@/lib/appEnvShared";
import { ENV_MODELS } from "@/lib/envModels";

// Toggle de logs verbose (queries) via env: PRISMA_LOG_QUERIES=true
const enableQueryLog = process.env.PRISMA_LOG_QUERIES === "true";
const logLevels: (Prisma.LogLevel | Prisma.LogDefinition)[] =
  process.env.NODE_ENV === "development"
    ? enableQueryLog
      ? ["query", "error", "warn"]
      : ["error", "warn"]
    : ["error"];

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

function mergeEnvWhere(where: unknown, envValue: string) {
  if (!where || typeof where !== "object") return { env: envValue };
  const record = where as Record<string, unknown>;
  if ("AND" in record) {
    const existing = Array.isArray(record.AND) ? record.AND : [record.AND];
    return { ...record, AND: [...existing, { env: envValue }] };
  }
  return { ...record, env: envValue };
}

function withEnvData(data: unknown, envValue: string) {
  if (!data || typeof data !== "object") return { env: envValue };
  return { ...(data as Record<string, unknown>), env: envValue };
}

function applyEnvToCreateMany(data: unknown, envValue: string) {
  if (Array.isArray(data)) {
    return data.map((entry) => withEnvData(entry, envValue));
  }
  return withEnvData(data, envValue);
}

const envModels = ENV_MODELS;

function createEnvExtension(envValue: AppEnv, client: PrismaClient) {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !envModels.has(model)) {
            return query(args);
          }

          const delegate = (client as any)[model] as Record<string, (...input: any[]) => Promise<any>> | undefined;
          if (!delegate) return query(args);

          const safeArgs = (args ?? {}) as Record<string, unknown>;

          switch (operation) {
            case "findUnique":
            case "findUniqueOrThrow": {
              const where = mergeEnvWhere(safeArgs.where, envValue);
              const method = operation === "findUniqueOrThrow" ? "findFirstOrThrow" : "findFirst";
              return (delegate as any)[method]({ ...safeArgs, where });
            }
            case "findFirst":
            case "findFirstOrThrow":
            case "findMany":
            case "count":
            case "aggregate":
            case "groupBy": {
              const where = mergeEnvWhere(safeArgs.where, envValue);
              return (delegate as any)[operation]({ ...safeArgs, where });
            }
            case "create": {
              return (delegate as any)[operation]({
                ...safeArgs,
                data: withEnvData(safeArgs.data, envValue),
              });
            }
            case "createMany": {
              return (delegate as any)[operation]({
                ...safeArgs,
                data: applyEnvToCreateMany(safeArgs.data, envValue),
              });
            }
            case "update": {
              await (delegate as any).findFirstOrThrow({
                where: mergeEnvWhere(safeArgs.where, envValue),
              });
              return (delegate as any)[operation]({
                ...safeArgs,
                data: withEnvData(safeArgs.data, envValue),
              });
            }
            case "updateMany": {
              return (delegate as any)[operation]({
                ...safeArgs,
                where: mergeEnvWhere(safeArgs.where, envValue),
                data: withEnvData(safeArgs.data, envValue),
              });
            }
            case "delete": {
              await (delegate as any).findFirstOrThrow({
                where: mergeEnvWhere(safeArgs.where, envValue),
              });
              return (delegate as any)[operation](safeArgs);
            }
            case "deleteMany": {
              return (delegate as any)[operation]({
                ...safeArgs,
                where: mergeEnvWhere(safeArgs.where, envValue),
              });
            }
            case "upsert": {
              const existing = await (delegate as any).findFirst({
                where: mergeEnvWhere(safeArgs.where, envValue),
              });
              if (existing) {
                return (delegate as any).update({
                  where: safeArgs.where,
                  data: withEnvData(safeArgs.update, envValue),
                });
              }
              return (delegate as any).create({
                data: withEnvData(safeArgs.create, envValue),
              });
            }
            default:
              return query(args);
          }
        },
      },
    },
  });
}

type EnvClient = ReturnType<typeof createEnvExtension>;

// Evitar múltiplas instâncias em dev (hot reload)
const globalForPrisma = globalThis as unknown as {
  prismaProd?: EnvClient;
  prismaTest?: EnvClient;
};

function createClient(envValue: AppEnv) {
  const pool = new Pool({
    connectionString: env.dbUrl,
    ssl: resolvePgSsl(env.dbUrl),
  });
  pool.on("connect", (client) => {
    client.query("select set_config('app.env', $1, true)", [envValue]).catch(() => {});
  });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter, log: logLevels });
  return createEnvExtension(envValue, client);
}

const prismaProd = globalForPrisma.prismaProd ?? createClient("prod");
const prismaTest = globalForPrisma.prismaTest ?? createClient("test");

export const prisma = new Proxy(prismaProd as PrismaClient, {
  get(_target, prop) {
    const client = getAppEnv() === "test" ? prismaTest : prismaProd;
    const value = (client as any)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaProd = prismaProd;
  globalForPrisma.prismaTest = prismaTest;
}
