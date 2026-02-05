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

const EVENT_SCHEMA_SAFE_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  type: true,
  templateType: true,
  liveHubVisibility: true,
  organizationId: true,
  startsAt: true,
  endsAt: true,
  locationName: true,
  locationCity: true,
  address: true,
  locationSource: true,
  locationProviderId: true,
  locationFormattedAddress: true,
  locationComponents: true,
  locationOverrides: true,
  latitude: true,
  longitude: true,
  pricingMode: true,
  isFree: true,
  inviteOnly: true,
  publicAccessMode: true,
  participantAccessMode: true,
  publicTicketTypeIds: true,
  participantTicketTypeIds: true,
  status: true,
  timezone: true,
  coverImageUrl: true,
  liveStreamUrl: true,
  createdAt: true,
  updatedAt: true,
  ownerUserId: true,
  deletedAt: true,
  isDeleted: true,
  resaleMode: true,
  fee_mode_override: true,
  platform_fee_bps_override: true,
  platform_fee_fixed_cents_override: true,
  feeMode: true,
  payoutMode: true,
} satisfies Prisma.EventSelect;

type DmmfModel = (typeof Prisma.dmmf.datamodel.models)[number];
type DmmfField = DmmfModel["fields"][number];

const DEFAULT_DB_SCHEMA = "app_v3";
const MODEL_META_CACHE = new Map<string, { tableName: string; fields: Map<string, DmmfField> }>();
const MODEL_COLUMNS_CACHE = new Map<string, Promise<Set<string> | null>>();
const EVENT_BASELINE_COLUMNS = new Set([
  "id",
  "slug",
  "title",
  "description",
  "type",
  "template_type",
  "organization_id",
  "starts_at",
  "ends_at",
  "location_name",
  "location_city",
  "address",
  "lat",
  "lng",
  "is_free",
  "status",
  "timezone",
  "cover_image_url",
  "created_at",
  "updated_at",
  "owner_user_id",
  "deleted_at",
  "is_deleted",
  "resale_mode",
  "fee_mode_override",
  "platform_fee_bps_override",
  "platform_fee_fixed_cents_override",
  "fee_mode",
  "payout_mode",
  "invite_only",
  "live_stream_url",
  "public_access_mode",
  "participant_access_mode",
  "public_ticket_type_ids",
  "participant_ticket_type_ids",
  "live_hub_visibility",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getModelMeta(modelName: string) {
  const cached = MODEL_META_CACHE.get(modelName);
  if (cached) return cached;
  const model = Prisma.dmmf.datamodel.models.find((entry) => entry.name === modelName);
  if (!model) return null;
  const fields = new Map<string, DmmfField>();
  for (const field of model.fields) {
    fields.set(field.name, field);
  }
  const meta = { tableName: model.dbName ?? model.name, fields };
  MODEL_META_CACHE.set(modelName, meta);
  return meta;
}

async function getModelColumns(client: PrismaClient, modelName: string) {
  const cached = MODEL_COLUMNS_CACHE.get(modelName);
  if (cached) return cached;

  const meta = getModelMeta(modelName);
  if (!meta) {
    const fallback = Promise.resolve(null);
    MODEL_COLUMNS_CACHE.set(modelName, fallback);
    return fallback;
  }

  const promise = client
    .$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = ${DEFAULT_DB_SCHEMA}
        AND table_name = ${meta.tableName}
    `
    .then((rows) => new Set(rows.map((row) => row.column_name)))
    .catch(() => null);

  MODEL_COLUMNS_CACHE.set(modelName, promise);
  return promise;
}

async function resolveModelColumns(client: PrismaClient, modelName: string) {
  const columns = await getModelColumns(client, modelName);
  if (columns && columns.size > 0) return columns;
  if (modelName === "Event") return EVENT_BASELINE_COLUMNS;
  return columns;
}

function buildRelationFkCandidates(fieldName: string) {
  const candidates = [`${fieldName}Id`, `${fieldName}Ids`];
  if (fieldName.endsWith("Ref")) {
    const base = fieldName.slice(0, -3);
    if (base) candidates.push(`${base}Id`);
  }
  if (fieldName.endsWith("Refs")) {
    const base = fieldName.slice(0, -4);
    if (base) candidates.push(`${base}Ids`);
  }
  return candidates;
}

async function canIncludeRelation(
  client: PrismaClient,
  modelName: string,
  meta: { tableName: string; fields: Map<string, DmmfField> },
  columns: Set<string>,
  relationField: DmmfField,
) {
  const localCandidates = buildRelationFkCandidates(relationField.name);
  for (const candidate of localCandidates) {
    const fkField = meta.fields.get(candidate);
    if (fkField && fkField.kind !== "object") {
      const fkColumn = fkField.dbName ?? fkField.name;
      return columns.has(fkColumn);
    }
  }

  const relatedMeta = getModelMeta(relationField.type);
  if (!relatedMeta) return true;
  const relatedColumns = await resolveModelColumns(client, relationField.type);
  if (!relatedColumns) return true;
  const parentIdCandidate = `${modelName.charAt(0).toLowerCase()}${modelName.slice(1)}Id`;
  const relatedFkField = relatedMeta.fields.get(parentIdCandidate);
  if (relatedFkField && relatedFkField.kind !== "object") {
    const fkColumn = relatedFkField.dbName ?? relatedFkField.name;
    return relatedColumns.has(fkColumn);
  }
  return true;
}

async function filterWhereForModel(
  client: PrismaClient,
  modelName: string,
  where: Record<string, unknown>,
) {
  const meta = getModelMeta(modelName);
  if (!meta) return where;
  const columns = await resolveModelColumns(client, modelName);
  if (!columns) return where;

  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(where)) {
    if (key === "AND" || key === "OR" || key === "NOT") {
      if (Array.isArray(value)) {
        next[key] = await Promise.all(
          value.map((entry) => (isRecord(entry) ? filterWhereForModel(client, modelName, entry) : entry)),
        );
      } else if (isRecord(value)) {
        next[key] = await filterWhereForModel(client, modelName, value);
      } else {
        next[key] = value;
      }
      continue;
    }

    const field = meta.fields.get(key);
    if (!field) {
      next[key] = value;
      continue;
    }

    if (field.kind === "object") {
      if (isRecord(value)) {
        const relationMeta = getModelMeta(field.type);
        if (relationMeta) {
          const relationArgs: Record<string, unknown> = { ...value };
          for (const relKey of ["some", "none", "every", "is", "isNot"]) {
            const relValue = relationArgs[relKey];
            if (isRecord(relValue)) {
              relationArgs[relKey] = await filterWhereForModel(client, field.type, relValue);
            }
          }
          next[key] = relationArgs;
        } else {
          next[key] = value;
        }
      } else {
        next[key] = value;
      }
      continue;
    }

    const columnName = field.dbName ?? field.name;
    if (columns.has(columnName)) {
      next[key] = value;
    }
  }

  return next;
}

async function filterOrderByForModel(
  client: PrismaClient,
  modelName: string,
  orderBy: unknown,
): Promise<unknown> {
  const meta = getModelMeta(modelName);
  if (!meta) return orderBy;
  const columns = await resolveModelColumns(client, modelName);
  if (!columns) return orderBy;

  if (Array.isArray(orderBy)) {
    const filtered = await Promise.all(orderBy.map((entry) => filterOrderByForModel(client, modelName, entry)));
    return filtered.filter((entry) => entry !== null);
  }

  if (!isRecord(orderBy)) return orderBy;

  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(orderBy)) {
    const field = meta.fields.get(key);
    if (!field) {
      next[key] = value;
      continue;
    }

    if (field.kind === "object") {
      if (isRecord(value)) {
        next[key] = await filterOrderByForModel(client, field.type, value);
      } else {
        next[key] = value;
      }
      continue;
    }

    const columnName = field.dbName ?? field.name;
    if (columns.has(columnName)) {
      next[key] = value;
    }
  }

  return Object.keys(next).length > 0 ? next : null;
}

async function filterSelectionForModel(
  client: PrismaClient,
  modelName: string,
  selection: Record<string, unknown>,
  mode: "select" | "include",
) {
  const meta = getModelMeta(modelName);
  if (!meta) return selection;
  const columns = await resolveModelColumns(client, modelName);
  if (!columns) return selection;

  const next: Record<string, unknown> = {};
  const entries = Object.entries(selection);

  for (const [key, value] of entries) {
    if (key === "_count") {
      next[key] = value;
      continue;
    }

    const field = meta.fields.get(key);
    if (!field) continue;

    if (field.kind === "object") {
      if (!(await canIncludeRelation(client, modelName, meta, columns, field))) {
        continue;
      }
      if (value === true) {
        next[key] = true;
        continue;
      }
      if (isRecord(value)) {
        const relationArgs: Record<string, unknown> = { ...value };
        if ("select" in relationArgs && isRecord(relationArgs.select)) {
          relationArgs.select = await filterSelectionForModel(
            client,
            field.type,
            relationArgs.select,
            "select",
          );
        }
        if ("include" in relationArgs && isRecord(relationArgs.include)) {
          relationArgs.include = await filterSelectionForModel(
            client,
            field.type,
            relationArgs.include,
            "include",
          );
        }
        if ("where" in relationArgs && isRecord(relationArgs.where)) {
          relationArgs.where = await filterWhereForModel(client, field.type, relationArgs.where);
        }
        if ("orderBy" in relationArgs) {
          relationArgs.orderBy = await filterOrderByForModel(client, field.type, relationArgs.orderBy);
          if (relationArgs.orderBy === null) {
            delete relationArgs.orderBy;
          }
        }
        next[key] = relationArgs;
      } else {
        next[key] = value;
      }
      continue;
    }

    if (mode === "include") {
      continue;
    }

    const columnName = field.dbName ?? field.name;
    if (columns.has(columnName)) {
      next[key] = value;
    }
  }

  if (mode === "select") {
    const hasScalarSelection = Object.keys(next).some((key) => {
      const field = meta.fields.get(key);
      return field && field.kind !== "object";
    });
    if (!hasScalarSelection) {
      const idField = meta.fields.get("id");
      const idColumn = idField?.dbName ?? "id";
      if (columns.has(idColumn)) {
        next.id = true;
      }
    }
  }

  return next;
}

function isMissingColumnError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022";
}

function canApplyEventReadFallback(_args: Record<string, unknown>) {
  return true;
}

async function withEventSafeReadSelect(args: Record<string, unknown>, client: PrismaClient) {
  const nextArgs: Record<string, unknown> = { ...args };
  const include = nextArgs.include;

  if (isRecord(nextArgs.select)) {
    nextArgs.select = await filterSelectionForModel(client, "Event", nextArgs.select, "select");
    if (isRecord(nextArgs.where)) {
      nextArgs.where = await filterWhereForModel(client, "Event", nextArgs.where);
    }
    if ("orderBy" in nextArgs) {
      nextArgs.orderBy = await filterOrderByForModel(client, "Event", nextArgs.orderBy);
      if (nextArgs.orderBy === null) {
        delete nextArgs.orderBy;
      }
    }
    return nextArgs;
  }

  if (isRecord(include)) {
    const safeBase = await filterSelectionForModel(client, "Event", EVENT_SCHEMA_SAFE_SELECT, "select");
    const safeInclude = await filterSelectionForModel(client, "Event", include, "include");
    delete nextArgs.include;
    nextArgs.select = { ...safeBase, ...safeInclude };
    if (isRecord(nextArgs.where)) {
      nextArgs.where = await filterWhereForModel(client, "Event", nextArgs.where);
    }
    if ("orderBy" in nextArgs) {
      nextArgs.orderBy = await filterOrderByForModel(client, "Event", nextArgs.orderBy);
      if (nextArgs.orderBy === null) {
        delete nextArgs.orderBy;
      }
    }
    return nextArgs;
  }

  nextArgs.select = await filterSelectionForModel(client, "Event", EVENT_SCHEMA_SAFE_SELECT, "select");
  if (isRecord(nextArgs.where)) {
    nextArgs.where = await filterWhereForModel(client, "Event", nextArgs.where);
  }
  if ("orderBy" in nextArgs) {
    nextArgs.orderBy = await filterOrderByForModel(client, "Event", nextArgs.orderBy);
    if (nextArgs.orderBy === null) {
      delete nextArgs.orderBy;
    }
  }
  return nextArgs;
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
          const executeReadWithEventFallback = async (
            operationArgs: Record<string, unknown>,
            run: (finalArgs: Record<string, unknown>) => Promise<unknown>,
          ) => {
            try {
              return await run(operationArgs);
            } catch (error) {
              if (model !== "Event" || !isMissingColumnError(error) || !canApplyEventReadFallback(operationArgs)) {
                throw error;
              }
              const fallbackArgs = await withEventSafeReadSelect(operationArgs, client);
              return run(fallbackArgs);
            }
          };

          switch (operation) {
            case "findUnique":
            case "findUniqueOrThrow": {
              const normalized = expandCompositeWhere(safeArgs.where) ?? safeArgs.where;
              const where = mergeEnvWhere(normalized, envValue);
              const method = operation === "findUniqueOrThrow" ? "findFirstOrThrow" : "findFirst";
              const operationArgs = { ...safeArgs, where };
              return executeReadWithEventFallback(operationArgs, (finalArgs) =>
                (delegate as any)[method](finalArgs),
              );
            }
            case "findFirst":
            case "findFirstOrThrow":
            case "findMany":
            case "count":
            case "aggregate":
            case "groupBy": {
              const normalized = expandCompositeWhere(safeArgs.where) ?? safeArgs.where;
              const where = mergeEnvWhere(normalized, envValue);
              const operationArgs = { ...safeArgs, where };
              if (operation === "findFirst" || operation === "findFirstOrThrow" || operation === "findMany") {
                return executeReadWithEventFallback(operationArgs, (finalArgs) =>
                  (delegate as any)[operation](finalArgs),
                );
              }
              return (delegate as any)[operation](operationArgs);
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
              const guardArgs: Record<string, unknown> = {
                where: mergeEnvWhere(normalized, envValue),
              };
              if (model === "Event") {
                guardArgs.select = { id: true };
              }
              await (delegate as any).findFirstOrThrow(guardArgs);
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
              const guardArgs: Record<string, unknown> = {
                where: mergeEnvWhere(normalized, envValue),
              };
              if (model === "Event") {
                guardArgs.select = { id: true };
              }
              await (delegate as any).findFirstOrThrow(guardArgs);
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
              const existing = await (delegate as any).findFirst(
                model === "Event"
                  ? { where: lookupWhere, select: { id: true } }
                  : { where: lookupWhere },
              );
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
