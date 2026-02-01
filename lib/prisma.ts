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
function stripUnsupportedParams(raw: string) {
  try {
    const parsed = new URL(raw);
    const keys = ["options"];
    let changed = false;
    for (const key of keys) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) return parsed.toString();
  } catch {
    // ignore parse errors, return raw
  }
  return raw;
}

function stripSslOptions(raw: string) {
  try {
    const parsed = new URL(raw);
    const keys = ["sslmode", "ssl", "sslrootcert", "sslcert", "sslkey"];
    let changed = false;
    for (const key of keys) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) return parsed.toString();
  } catch {
    // ignore parse errors, return raw
  }
  return raw;
}

function resolvePgSsl(url: string): { ssl: false | { rejectUnauthorized: false } | undefined; connectionString: string } {
  const sanitized = stripUnsupportedParams(url);
  let sslMode: string | null = null;
  let host = "";
  try {
    const parsed = new URL(sanitized);
    sslMode = parsed.searchParams.get("sslmode");
    host = parsed.hostname;
  } catch {
    // ignore parse errors
  }

  const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const forceDisable =
    process.env.PGSSL_DISABLE === "true" ||
    process.env.PGSSLMODE === "disable" ||
    sslMode === "disable" ||
    isLocalHost;
  if (forceDisable) {
    return { ssl: false, connectionString: stripSslOptions(sanitized) };
  }

  const allowSelfSigned =
    process.env.PGSSL_ALLOW_SELF_SIGNED === "true" ||
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0";
  if (process.env.NODE_ENV !== "production" || allowSelfSigned) {
    return { ssl: { rejectUnauthorized: false }, connectionString: stripSslOptions(sanitized) };
  }

  return { ssl: undefined, connectionString: sanitized };
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

function stripEnvFromWhere(where: unknown): Record<string, unknown> | null {
  if (!where || typeof where !== "object") return null;
  const record = where as Record<string, unknown>;
  if (!("env" in record)) return record;
  const { env: _env, ...rest } = record;
  return rest;
}

function expandCompositeWhere(where: unknown): Record<string, unknown> | null {
  if (!where || typeof where !== "object") return null;
  const record = where as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  let changed = false;

  const expandNode = (node: unknown) => {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) {
      return node.map((item) => expandCompositeWhere(item) ?? item);
    }
    return expandCompositeWhere(node) ?? node;
  };

  for (const [key, value] of Object.entries(record)) {
    if (key === "AND" || key === "OR" || key === "NOT") {
      next[key] = expandNode(value);
      if (next[key] !== value) changed = true;
      continue;
    }

    const isCompositeCandidate = key.includes("_");
    if (isCompositeCandidate && value && typeof value === "object" && !Array.isArray(value)) {
      const valueRecord = value as Record<string, unknown>;
      const expectedKeys = key.split("_");
      const hasAllKeys = expectedKeys.every((entryKey) => entryKey in valueRecord);
      if (hasAllKeys) {
        for (const entryKey of expectedKeys) {
          if (!(entryKey in next)) {
            next[entryKey] = valueRecord[entryKey];
          }
        }
        changed = true;
        continue;
      }
    }

    next[key] = expandNode(value);
    if (next[key] !== value) changed = true;
  }

  return changed ? next : record;
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
              const normalized = expandCompositeWhere(safeArgs.where) ?? safeArgs.where;
              const where = mergeEnvWhere(normalized, envValue);
              const method = operation === "findUniqueOrThrow" ? "findFirstOrThrow" : "findFirst";
              return (delegate as any)[method]({ ...safeArgs, where });
            }
            case "findFirst":
            case "findFirstOrThrow":
            case "findMany":
            case "count":
            case "aggregate":
            case "groupBy": {
              const normalized = expandCompositeWhere(safeArgs.where) ?? safeArgs.where;
              const where = mergeEnvWhere(normalized, envValue);
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
              const normalized = expandCompositeWhere(safeArgs.where) ?? safeArgs.where;
              await (delegate as any).findFirstOrThrow({
                where: mergeEnvWhere(normalized, envValue),
              });
              const where = stripEnvFromWhere(normalized) ?? normalized;
              return (delegate as any)[operation]({
                ...safeArgs,
                where,
                data: withEnvData(safeArgs.data, envValue),
              });
            }
            case "updateMany": {
              const normalized = expandCompositeWhere(safeArgs.where) ?? safeArgs.where;
              return (delegate as any)[operation]({
                ...safeArgs,
                where: mergeEnvWhere(normalized, envValue),
                data: withEnvData(safeArgs.data, envValue),
              });
            }
            case "delete": {
              const normalized = expandCompositeWhere(safeArgs.where) ?? safeArgs.where;
              await (delegate as any).findFirstOrThrow({
                where: mergeEnvWhere(normalized, envValue),
              });
              const where = stripEnvFromWhere(normalized) ?? normalized;
              return (delegate as any)[operation]({ ...safeArgs, where });
            }
            case "deleteMany": {
              const normalized = expandCompositeWhere(safeArgs.where) ?? safeArgs.where;
              return (delegate as any)[operation]({
                ...safeArgs,
                where: mergeEnvWhere(normalized, envValue),
              });
            }
            case "upsert": {
              const normalized = expandCompositeWhere(safeArgs.where) ?? safeArgs.where;
              const lookupWhere = mergeEnvWhere(normalized, envValue);
              const existing = await (delegate as any).findFirst({ where: lookupWhere });
              if (existing) {
                const where = stripEnvFromWhere(normalized) ?? normalized;
                return (delegate as any).update({
                  where,
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
  const pg = resolvePgSsl(env.dbUrl);
  const pool = new Pool({
    connectionString: pg.connectionString,
    ssl: pg.ssl,
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
