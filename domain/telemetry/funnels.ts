import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppEnv } from "@/lib/appEnv";
import { normalizeTelemetryEventNameToCatalog } from "@/domain/telemetry/catalog";
import { type TelemetryBucketUnit } from "@/domain/telemetry/constants";
import { logError } from "@/lib/observability/logger";

type TelemetryFunnelDefinitionDelegate = {
  findMany?: (args: unknown) => Promise<any[]>;
  findUnique?: (args: unknown) => Promise<any | null>;
  create?: (args: unknown) => Promise<any>;
  update?: (args: unknown) => Promise<any>;
};

type TelemetryFunnelResultDelegate = {
  findMany?: (args: unknown) => Promise<any[]>;
  deleteMany?: (args: unknown) => Promise<{ count: number }>;
  upsert?: (args: unknown) => Promise<any>;
};

function funnelDefinitionDelegate() {
  return (
    prisma as unknown as { telemetryFunnelDefinition?: TelemetryFunnelDefinitionDelegate }
  ).telemetryFunnelDefinition;
}

function funnelResultDelegate() {
  return (
    prisma as unknown as { telemetryFunnelResult?: TelemetryFunnelResultDelegate }
  ).telemetryFunnelResult;
}

function toNullableText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function toNullableInt(value: unknown, options?: { min?: number; max?: number }): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  if (typeof options?.min === "number" && parsed < options.min) return null;
  if (typeof options?.max === "number" && parsed > options.max) return null;
  return parsed;
}

function toNullableBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeOrganizationId(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function truncateToBucket(date: Date, bucketUnit: TelemetryBucketUnit): Date {
  const bucket = new Date(date);
  bucket.setUTCMinutes(0, 0, 0);
  if (bucketUnit === "DAY") {
    bucket.setUTCHours(0, 0, 0, 0);
  }
  return bucket;
}

export type TelemetryFunnelStep = {
  key: string;
  eventName: string;
  required: boolean;
  withinMinutes: number | null;
};

export type TelemetryFunnelDefinitionRecord = {
  id: string;
  organizationId: number | null;
  name: string;
  description: string | null;
  steps: TelemetryFunnelStep[];
  isActive: boolean;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TelemetryFunnelResultRecord = {
  id: number;
  funnelId: string;
  organizationId: number | null;
  bucketStart: Date;
  bucketUnit: TelemetryBucketUnit;
  stepKey: string;
  enteredCount: number;
  convertedCount: number;
  conversionRateBps: number;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeStep(raw: unknown): TelemetryFunnelStep | null {
  if (!isRecord(raw)) return null;
  const key = toNullableText(raw.key, 64)?.toLowerCase() ?? null;
  if (!key || !/^[a-z0-9][a-z0-9._:-]{1,63}$/.test(key)) return null;

  const normalizedEventName = normalizeTelemetryEventNameToCatalog(
    toNullableText(raw.eventName, 120) ?? "",
  );
  if (!normalizedEventName) return null;

  const required = toNullableBoolean(raw.required) ?? true;
  const withinMinutes =
    raw.withinMinutes === null || raw.withinMinutes === undefined
      ? null
      : toNullableInt(raw.withinMinutes, { min: 1, max: 7 * 24 * 60 });
  if (raw.withinMinutes !== null && raw.withinMinutes !== undefined && withinMinutes === null) {
    return null;
  }

  return {
    key,
    eventName: normalizedEventName,
    required,
    withinMinutes,
  };
}

function normalizeSteps(raw: unknown): TelemetryFunnelStep[] | null {
  if (!Array.isArray(raw)) return null;
  const items = raw.map(normalizeStep).filter((item): item is TelemetryFunnelStep => item !== null);
  if (items.length < 2 || items.length > 20) return null;
  const keys = new Set<string>();
  for (const item of items) {
    if (keys.has(item.key)) return null;
    keys.add(item.key);
  }
  return items;
}

function mapDefinition(row: any): TelemetryFunnelDefinitionRecord {
  const steps = normalizeSteps(row.steps) ?? [];
  return {
    id: String(row.id),
    organizationId: typeof row.organizationId === "number" ? row.organizationId : null,
    name: toNullableText(row.name, 160) ?? "",
    description: toNullableText(row.description, 500),
    steps,
    isActive: Boolean(row.isActive),
    createdByUserId: toNullableText(row.createdByUserId, 64),
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(),
  };
}

function mapResult(row: any): TelemetryFunnelResultRecord {
  return {
    id: Number(row.id ?? 0),
    funnelId: String(row.funnelId ?? ""),
    organizationId: typeof row.organizationId === "number" ? row.organizationId : null,
    bucketStart: row.bucketStart instanceof Date ? row.bucketStart : new Date(),
    bucketUnit: row.bucketUnit === "DAY" ? "DAY" : "HOUR",
    stepKey: toNullableText(row.stepKey, 64) ?? "",
    enteredCount: Number(row.enteredCount ?? 0),
    convertedCount: Number(row.convertedCount ?? 0),
    conversionRateBps: Number(row.conversionRateBps ?? 0),
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(),
  };
}

export type ListTelemetryFunnelDefinitionsParams = {
  organizationId?: number | null;
  includeGlobal?: boolean;
  activeOnly?: boolean;
  take?: number;
};

export async function listTelemetryFunnelDefinitions(
  params: ListTelemetryFunnelDefinitionsParams = {},
): Promise<TelemetryFunnelDefinitionRecord[]> {
  const delegate = funnelDefinitionDelegate();
  if (!delegate?.findMany) return [];

  const where: Record<string, unknown> = {
    env: getAppEnv(),
  };

  if (params.activeOnly) {
    where.isActive = true;
  }

  if (typeof params.organizationId === "number") {
    if (params.includeGlobal) {
      where.OR = [{ organizationId: params.organizationId }, { organizationId: null }];
    } else {
      where.organizationId = params.organizationId;
    }
  }

  const rows = await delegate.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take:
      typeof params.take === "number" && params.take > 0
        ? Math.min(Math.floor(params.take), 400)
        : 200,
    select: {
      id: true,
      organizationId: true,
      name: true,
      description: true,
      steps: true,
      isActive: true,
      createdByUserId: true,
      createdAt: true,
      updatedAt: true,
      env: true,
    },
  });

  const env = getAppEnv();
  return rows
    .filter((row) => String(row.env ?? "") === env)
    .map(mapDefinition);
}

export async function getTelemetryFunnelDefinitionById(
  funnelId: string,
): Promise<TelemetryFunnelDefinitionRecord | null> {
  const delegate = funnelDefinitionDelegate();
  if (!delegate?.findUnique) return null;

  const row = await delegate.findUnique({
    where: { id: funnelId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      description: true,
      steps: true,
      isActive: true,
      createdByUserId: true,
      createdAt: true,
      updatedAt: true,
      env: true,
    },
  });

  if (!row || String(row.env ?? "") !== getAppEnv()) return null;
  return mapDefinition(row);
}

export type CreateTelemetryFunnelDefinitionInput = {
  organizationId: number | null;
  name: string;
  description: string | null;
  steps: TelemetryFunnelStep[];
  isActive: boolean;
};

export async function createTelemetryFunnelDefinition(
  input: CreateTelemetryFunnelDefinitionInput,
  createdByUserId: string | null,
): Promise<TelemetryFunnelDefinitionRecord | null> {
  const delegate = funnelDefinitionDelegate();
  if (!delegate?.create) return null;

  const created = await delegate.create({
    data: {
      env: getAppEnv(),
      organizationId: input.organizationId,
      name: input.name,
      description: input.description,
      steps: input.steps,
      isActive: input.isActive,
      createdByUserId,
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      description: true,
      steps: true,
      isActive: true,
      createdByUserId: true,
      createdAt: true,
      updatedAt: true,
      env: true,
    },
  });

  if (String(created.env ?? "") !== getAppEnv()) return null;
  return mapDefinition(created);
}

export type UpdateTelemetryFunnelDefinitionInput = Partial<
  Omit<CreateTelemetryFunnelDefinitionInput, "organizationId">
>;

export async function updateTelemetryFunnelDefinition(
  funnelId: string,
  patch: UpdateTelemetryFunnelDefinitionInput,
): Promise<TelemetryFunnelDefinitionRecord | null> {
  const delegate = funnelDefinitionDelegate();
  if (!delegate?.update) return null;

  const existing = await getTelemetryFunnelDefinitionById(funnelId);
  if (!existing) return null;

  const updated = await delegate.update({
    where: { id: funnelId },
    data: {
      ...(typeof patch.name === "string" ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.steps ? { steps: patch.steps } : {}),
      ...(typeof patch.isActive === "boolean" ? { isActive: patch.isActive } : {}),
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      description: true,
      steps: true,
      isActive: true,
      createdByUserId: true,
      createdAt: true,
      updatedAt: true,
      env: true,
    },
  });

  if (String(updated.env ?? "") !== getAppEnv()) return null;
  return mapDefinition(updated);
}

export type ListTelemetryFunnelResultsParams = {
  organizationId?: number | null;
  funnelId?: string | null;
  bucketUnit?: TelemetryBucketUnit | null;
  take?: number;
};

export async function listTelemetryFunnelResults(
  params: ListTelemetryFunnelResultsParams = {},
): Promise<TelemetryFunnelResultRecord[]> {
  const delegate = funnelResultDelegate();
  if (!delegate?.findMany) return [];

  const where: Record<string, unknown> = {
    env: getAppEnv(),
    ...(typeof params.organizationId === "number" ? { organizationId: params.organizationId } : {}),
    ...(params.funnelId ? { funnelId: params.funnelId } : {}),
    ...(params.bucketUnit ? { bucketUnit: params.bucketUnit } : {}),
  };

  const rows = await delegate.findMany({
    where,
    orderBy: [{ bucketStart: "desc" }, { id: "desc" }],
    take:
      typeof params.take === "number" && params.take > 0
        ? Math.min(Math.floor(params.take), 500)
        : 200,
    select: {
      id: true,
      funnelId: true,
      organizationId: true,
      bucketStart: true,
      bucketUnit: true,
      stepKey: true,
      enteredCount: true,
      convertedCount: true,
      conversionRateBps: true,
      createdAt: true,
      updatedAt: true,
      env: true,
    },
  });

  const env = getAppEnv();
  return rows
    .filter((row) => String(row.env ?? "") === env)
    .map(mapResult);
}

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function parseTelemetryFunnelCreateInput(
  raw: unknown,
  options?: { forcedOrganizationId?: number | null },
): ParseResult<CreateTelemetryFunnelDefinitionInput> {
  if (!isRecord(raw)) {
    return { ok: false, error: "INVALID_PAYLOAD" };
  }

  const name = toNullableText(raw.name, 160);
  if (!name || name.length < 2) {
    return { ok: false, error: "INVALID_FUNNEL_NAME" };
  }

  const steps = normalizeSteps(raw.steps);
  if (!steps) {
    return { ok: false, error: "INVALID_FUNNEL_STEPS" };
  }

  const organizationId =
    options?.forcedOrganizationId !== undefined
      ? options.forcedOrganizationId
      : toNullableInt(raw.organizationId, { min: 1 });

  return {
    ok: true,
    value: {
      organizationId,
      name,
      description: toNullableText(raw.description, 500),
      steps,
      isActive: toNullableBoolean(raw.isActive) ?? true,
    },
  };
}

export function parseTelemetryFunnelPatchInput(
  raw: unknown,
): ParseResult<UpdateTelemetryFunnelDefinitionInput> {
  if (!isRecord(raw)) {
    return { ok: false, error: "INVALID_PAYLOAD" };
  }

  const patch: UpdateTelemetryFunnelDefinitionInput = {};

  if ("name" in raw) {
    const name = toNullableText(raw.name, 160);
    if (!name || name.length < 2) return { ok: false, error: "INVALID_FUNNEL_NAME" };
    patch.name = name;
  }

  if ("description" in raw) {
    patch.description = toNullableText(raw.description, 500);
  }

  if ("steps" in raw) {
    const steps = normalizeSteps(raw.steps);
    if (!steps) return { ok: false, error: "INVALID_FUNNEL_STEPS" };
    patch.steps = steps;
  }

  if ("isActive" in raw) {
    const isActive = toNullableBoolean(raw.isActive);
    if (isActive === null) return { ok: false, error: "INVALID_IS_ACTIVE" };
    patch.isActive = isActive;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "NO_FIELDS_TO_UPDATE" };
  }

  return { ok: true, value: patch };
}

type FunnelEventRow = {
  event_name: string;
  occurred_at: Date;
  actor_key: string | null;
  actor_user_id: string | null;
  session_id: string | null;
};

type ActorEvent = {
  eventName: string;
  occurredAt: Date;
};

type FunnelBucketStats = {
  bucketStart: Date;
  enteredCounts: number[];
  convertedCounts: number[];
};

function resolveActorKey(row: FunnelEventRow): string | null {
  const actorKey = toNullableText(row.actor_key, 220);
  if (actorKey) return actorKey;

  const userId = toNullableText(row.actor_user_id, 96);
  if (userId) return `user:${userId}`;

  const sessionId = toNullableText(row.session_id, 220);
  if (sessionId) return `session:${sessionId}`;

  return null;
}

function matchFunnelStepsForActor(events: ActorEvent[], steps: TelemetryFunnelStep[]): Date[] {
  if (events.length === 0 || steps.length === 0) return [];

  const matches: Date[] = [];
  let pointer = 0;
  let minTimestamp = Number.NEGATIVE_INFINITY;

  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    const step = steps[stepIndex];
    let found: Date | null = null;

    while (pointer < events.length) {
      const candidate = events[pointer];
      pointer += 1;

      const candidateTs = candidate.occurredAt.getTime();
      if (candidateTs < minTimestamp) continue;
      if (candidate.eventName !== step.eventName) continue;

      if (stepIndex > 0 && typeof step.withinMinutes === "number") {
        const previousTs = matches[stepIndex - 1]?.getTime() ?? candidateTs;
        const maxDeltaMs = step.withinMinutes * 60 * 1000;
        if (candidateTs - previousTs > maxDeltaMs) {
          return matches;
        }
      }

      found = candidate.occurredAt;
      break;
    }

    if (!found) break;

    matches.push(found);
    minTimestamp = found.getTime();
  }

  return matches;
}

function computeBucketStats(rows: FunnelEventRow[], steps: TelemetryFunnelStep[], bucketUnit: TelemetryBucketUnit) {
  const eventsByActor = new Map<string, ActorEvent[]>();

  for (const row of rows) {
    const actorKey = resolveActorKey(row);
    if (!actorKey) continue;

    const list = eventsByActor.get(actorKey) ?? [];
    list.push({
      eventName: row.event_name,
      occurredAt: row.occurred_at instanceof Date ? row.occurred_at : new Date(row.occurred_at),
    });
    eventsByActor.set(actorKey, list);
  }

  const buckets = new Map<string, FunnelBucketStats>();

  for (const actorEvents of eventsByActor.values()) {
    actorEvents.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    const matches = matchFunnelStepsForActor(actorEvents, steps);
    if (matches.length === 0) continue;

    const bucketStart = truncateToBucket(matches[0], bucketUnit);
    const bucketKey = bucketStart.toISOString();

    const bucket =
      buckets.get(bucketKey) ?? {
        bucketStart,
        enteredCounts: Array.from({ length: steps.length }, () => 0),
        convertedCounts: Array.from({ length: steps.length }, () => 0),
      };

    for (let stepIndex = 0; stepIndex < matches.length; stepIndex += 1) {
      bucket.enteredCounts[stepIndex] += 1;

      const hasNext = stepIndex < steps.length - 1;
      const converted = hasNext ? Boolean(matches[stepIndex + 1]) : true;
      if (converted) {
        bucket.convertedCounts[stepIndex] += 1;
      }
    }

    buckets.set(bucketKey, bucket);
  }

  return buckets;
}

async function deleteFunnelResultsInRange(params: {
  funnelId: string;
  organizationId: number;
  bucketUnit: TelemetryBucketUnit;
  from: Date;
  to: Date;
}) {
  const delegate = funnelResultDelegate();
  if (!delegate?.deleteMany) return 0;

  const deleted = await delegate.deleteMany({
    where: {
      env: getAppEnv(),
      funnelId: params.funnelId,
      organizationId: params.organizationId,
      bucketUnit: params.bucketUnit,
      bucketStart: {
        gte: params.from,
        lt: params.to,
      },
    },
  });

  return Number(deleted?.count ?? 0);
}

async function upsertFunnelResultRow(params: {
  funnelId: string;
  organizationId: number;
  bucketStart: Date;
  bucketUnit: TelemetryBucketUnit;
  stepKey: string;
  enteredCount: number;
  convertedCount: number;
}) {
  const delegate = funnelResultDelegate();
  if (!delegate?.upsert) return false;

  const env = getAppEnv();
  const entered = Math.max(0, Math.floor(params.enteredCount));
  const converted = Math.min(entered, Math.max(0, Math.floor(params.convertedCount)));
  const conversionRateBps = entered > 0 ? Math.round((converted * 10_000) / entered) : 0;

  await delegate.upsert({
    where: {
      env_funnelId_organizationId_bucketStart_bucketUnit_stepKey: {
        env,
        funnelId: params.funnelId,
        organizationId: params.organizationId,
        bucketStart: params.bucketStart,
        bucketUnit: params.bucketUnit,
        stepKey: params.stepKey,
      },
    },
    create: {
      env,
      funnelId: params.funnelId,
      organizationId: params.organizationId,
      bucketStart: params.bucketStart,
      bucketUnit: params.bucketUnit,
      stepKey: params.stepKey,
      enteredCount: entered,
      convertedCount: converted,
      conversionRateBps,
    },
    update: {
      enteredCount: entered,
      convertedCount: converted,
      conversionRateBps,
      updatedAt: new Date(),
    },
  });

  return true;
}

async function fetchFunnelEvents(params: {
  organizationId: number;
  from: Date;
  to: Date;
  eventNames: string[];
}) {
  if (params.eventNames.length === 0) return [] as FunnelEventRow[];

  const env = getAppEnv();
  const rows = await prisma.$queryRaw<FunnelEventRow[]>(Prisma.sql`
    SELECT
      event_name,
      occurred_at,
      actor_key,
      actor_user_id::text AS actor_user_id,
      session_id
    FROM app_v3.telemetry_events
    WHERE env = ${env}
      AND organization_id = ${params.organizationId}
      AND occurred_at >= ${params.from}
      AND occurred_at < ${params.to}
      AND event_name IN (${Prisma.join(params.eventNames)})
      AND (actor_key IS NOT NULL OR actor_user_id IS NOT NULL OR session_id IS NOT NULL)
    ORDER BY COALESCE(actor_key, actor_user_id::text, session_id), occurred_at ASC
  `);

  return rows;
}

type OrganizationRow = {
  organization_id: number | bigint | null;
};

async function listOrganizationsForFunnelRecompute(params: {
  from: Date;
  to: Date;
  forcedOrganizationId: number | null;
}) {
  if (typeof params.forcedOrganizationId === "number") {
    return [params.forcedOrganizationId];
  }

  const env = getAppEnv();
  const rows = await prisma.$queryRaw<OrganizationRow[]>(Prisma.sql`
    SELECT DISTINCT organization_id
    FROM app_v3.telemetry_events
    WHERE env = ${env}
      AND organization_id IS NOT NULL
      AND occurred_at >= ${params.from}
      AND occurred_at < ${params.to}
    UNION
    SELECT DISTINCT organization_id
    FROM app_v3.telemetry_funnel_results
    WHERE env = ${env}
      AND organization_id IS NOT NULL
      AND bucket_start >= ${params.from}
      AND bucket_start < ${params.to}
  `);

  const organizationIds = new Set<number>();
  for (const row of rows) {
    const asNumber =
      typeof row.organization_id === "bigint"
        ? Number(row.organization_id)
        : typeof row.organization_id === "number"
          ? row.organization_id
          : null;
    if (typeof asNumber === "number" && Number.isInteger(asNumber) && asNumber > 0) {
      organizationIds.add(asNumber);
    }
  }

  return Array.from(organizationIds).sort((a, b) => a - b);
}

export type RecomputeTelemetryFunnelResultsParams = {
  from?: Date;
  to?: Date;
  bucketUnit?: TelemetryBucketUnit;
  organizationId?: number | null;
  maxFunnelsPerOrganization?: number;
};

export type RecomputeTelemetryFunnelResultsResult = {
  from: Date;
  to: Date;
  bucketUnit: TelemetryBucketUnit;
  organizations: number;
  funnels: number;
  buckets: number;
  rowsDeleted: number;
  rowsWritten: number;
  skippedFunnels: number;
  errors: number;
};

export async function recomputeTelemetryFunnelResults(
  params: RecomputeTelemetryFunnelResultsParams = {},
): Promise<RecomputeTelemetryFunnelResultsResult> {
  const bucketUnit = params.bucketUnit === "DAY" ? "DAY" : "HOUR";
  const to = params.to ?? new Date();
  const from =
    params.from ??
    new Date(to.getTime() - (bucketUnit === "HOUR" ? 24 : 14 * 24) * 60 * 60 * 1000);
  const forcedOrganizationId = normalizeOrganizationId(params.organizationId);

  const organizationIds = await listOrganizationsForFunnelRecompute({
    from,
    to,
    forcedOrganizationId,
  });

  let funnels = 0;
  let buckets = 0;
  let rowsDeleted = 0;
  let rowsWritten = 0;
  let skippedFunnels = 0;
  let errors = 0;

  const maxFunnelsPerOrganization =
    typeof params.maxFunnelsPerOrganization === "number" && params.maxFunnelsPerOrganization > 0
      ? Math.min(Math.floor(params.maxFunnelsPerOrganization), 500)
      : 300;

  for (const organizationId of organizationIds) {
    const definitions = await listTelemetryFunnelDefinitions({
      organizationId,
      includeGlobal: true,
      activeOnly: true,
      take: maxFunnelsPerOrganization,
    });

    for (const definition of definitions) {
      if (definition.steps.length < 2) {
        skippedFunnels += 1;
        continue;
      }

      try {
        const eventNames = Array.from(new Set(definition.steps.map((step) => step.eventName)));
        const eventRows = await fetchFunnelEvents({
          organizationId,
          from,
          to,
          eventNames,
        });

        const bucketStats = computeBucketStats(eventRows, definition.steps, bucketUnit);

        rowsDeleted += await deleteFunnelResultsInRange({
          funnelId: definition.id,
          organizationId,
          bucketUnit,
          from,
          to,
        });

        for (const bucket of bucketStats.values()) {
          for (let stepIndex = 0; stepIndex < definition.steps.length; stepIndex += 1) {
            const enteredCount = bucket.enteredCounts[stepIndex] ?? 0;
            if (enteredCount <= 0) continue;

            const step = definition.steps[stepIndex];
            const convertedCount = bucket.convertedCounts[stepIndex] ?? 0;
            const wrote = await upsertFunnelResultRow({
              funnelId: definition.id,
              organizationId,
              bucketStart: bucket.bucketStart,
              bucketUnit,
              stepKey: step.key,
              enteredCount,
              convertedCount,
            });
            if (wrote) rowsWritten += 1;
          }
        }

        funnels += 1;
        buckets += bucketStats.size;
      } catch (err) {
        errors += 1;
        logError("telemetry.funnels.recompute_failed", err, {
          organizationId,
          funnelId: definition.id,
        });
      }
    }
  }

  return {
    from,
    to,
    bucketUnit,
    organizations: organizationIds.length,
    funnels,
    buckets,
    rowsDeleted,
    rowsWritten,
    skippedFunnels,
    errors,
  };
}
