/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { padel_format } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type GenerateExistingPolicy = "skip" | "error" | "replace";
type ExecutionMode = "SYNC" | "ASYNC";
type PartialMode = "ALLOW_PARTIAL" | "REQUIRE_FULL";
type ScheduleStrategy = "BALANCED_BY_CATEGORY" | "GROUPS_FIRST" | "KNOCKOUT_FIRST";

type CliOptions = {
  orgUsername: string;
  runTag: string;
  baseUrl: string;
  dryRun: boolean;
  generateExistingPolicy: GenerateExistingPolicy;
  executionMode: ExecutionMode;
  partialMode: PartialMode;
  strategy: ScheduleStrategy;
  startFromNow: boolean;
  pollTimeoutMs: number;
  bypassHardBlockGenerate: boolean;
};

type SupabaseClients = {
  service: SupabaseClient;
  anon: SupabaseClient;
};

type EventSummary = {
  eventId: number;
  title: string;
  format: padel_format;
  categories: Array<{ categoryId: number; label: string }>;
  matchesBefore: {
    total: number;
    pendingUnscheduled: number;
    scheduledAny: number;
  };
  matchesAfterGenerate: {
    total: number;
    pendingUnscheduled: number;
    scheduledAny: number;
  };
  matchesAfterSchedule: {
    total: number;
    pendingUnscheduled: number;
    scheduledAny: number;
  };
  generatedByCategory: Array<{
    categoryId: number;
    label: string;
    status: "ok" | "error";
    stage?: string | null;
    error?: string;
  }>;
  autoSchedule: {
    status: "ok" | "noop" | "error";
    runId: string | null;
    runStatus: string | null;
    scheduledCount: number;
    skippedCount: number;
    unscheduledByReason: Record<string, number>;
    queued: boolean;
    applied: boolean;
    warningsCount: number;
    error?: string;
  };
  errors: string[];
};

type Report = {
  runTag: string;
  organization: { id: number; username: string | null; name: string | null };
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  options: Omit<CliOptions, "orgUsername" | "runTag" | "dryRun">;
  totals: {
    eventsTarget: number;
    eventsProcessed: number;
    generatedCallsOk: number;
    generatedCallsFailed: number;
    scheduledCount: number;
    skippedCount: number;
    errors: number;
  };
  events: EventSummary[];
};

class ApiError extends Error {
  path: string;
  status: number;
  code: string;

  constructor(params: { path: string; status: number; code: string; message: string }) {
    super(params.message);
    this.name = "ApiError";
    this.path = params.path;
    this.status = params.status;
    this.code = params.code;
  }
}

const DEFAULT_BASE_URL = "http://localhost:3000";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const pickNonEmpty = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
};

function loadEnvForScript() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./load-env.js");
  } catch {
    // no-op
  }
}

function parsePositiveInt(raw: string | null | undefined, fallback: number) {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

const parseFlagMap = (argv: string[]) => {
  const flags = new Map<string, string | boolean>();
  for (let idx = 0; idx < argv.length; idx += 1) {
    const key = argv[idx];
    if (!key || !key.startsWith("--")) continue;
    const value = argv[idx + 1];
    if (!value || value.startsWith("--")) {
      flags.set(key, true);
      continue;
    }
    flags.set(key, value);
    idx += 1;
  }
  return flags;
};

export function parseGenerateScheduleArgs(argv: string[]): CliOptions {
  const flags = parseFlagMap(argv);

  const orgUsername = String(flags.get("--org-username") || "top_padel").trim();
  const runTag = String(flags.get("--run-tag") || "").trim();
  if (!runTag) throw new Error("Missing --run-tag");

  const baseUrl =
    pickNonEmpty(
      flags.get("--base-url") as string | undefined,
      process.env.APP_BASE_URL,
      process.env.NEXT_PUBLIC_BASE_URL,
      DEFAULT_BASE_URL,
    ) || DEFAULT_BASE_URL;

  const existingPolicyRaw = String(flags.get("--generate-existing-policy") || "skip").trim().toLowerCase();
  if (existingPolicyRaw !== "skip" && existingPolicyRaw !== "error" && existingPolicyRaw !== "replace") {
    throw new Error("Invalid --generate-existing-policy (use skip|error|replace)");
  }

  const executionModeRaw = String(flags.get("--execution-mode") || "sync").trim().toUpperCase();
  if (executionModeRaw !== "SYNC" && executionModeRaw !== "ASYNC") {
    throw new Error("Invalid --execution-mode (use sync|async)");
  }

  const partialModeRaw = String(flags.get("--partial-mode") || "allow_partial").trim().toUpperCase();
  if (partialModeRaw !== "ALLOW_PARTIAL" && partialModeRaw !== "REQUIRE_FULL") {
    throw new Error("Invalid --partial-mode (use allow_partial|require_full)");
  }

  const strategyRaw = String(flags.get("--strategy") || "balanced_by_category").trim().toUpperCase();
  if (strategyRaw !== "BALANCED_BY_CATEGORY" && strategyRaw !== "GROUPS_FIRST" && strategyRaw !== "KNOCKOUT_FIRST") {
    throw new Error("Invalid --strategy (use balanced_by_category|groups_first|knockout_first)");
  }

  return {
    orgUsername,
    runTag,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    dryRun: flags.has("--dry-run"),
    generateExistingPolicy: existingPolicyRaw as GenerateExistingPolicy,
    executionMode: executionModeRaw as ExecutionMode,
    partialMode: partialModeRaw as PartialMode,
    strategy: strategyRaw as ScheduleStrategy,
    startFromNow: flags.has("--start-from-now"),
    pollTimeoutMs: parsePositiveInt(flags.get("--poll-timeout-ms") as string | undefined, 90_000),
    bypassHardBlockGenerate: !flags.has("--no-hardblock-bypass"),
  };
}

const unwrapPayload = (raw: Record<string, unknown>) => {
  const payload = (raw.result ?? raw.data ?? raw) as Record<string, unknown>;
  const isOk = raw.ok !== false && payload.ok !== false;
  return { payload, isOk };
};

async function postJson<T = Record<string, unknown>>(params: {
  baseUrl: string;
  path: string;
  bearer?: string | null;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(params.headers ?? {}),
  };
  if (params.bearer) headers.Authorization = `Bearer ${params.bearer}`;

  const response = await fetch(`${params.baseUrl}${params.path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(params.body),
  });
  const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const { payload, isOk } = unwrapPayload(raw);
  if (!response.ok || !isOk) {
    const code = String(payload.errorCode ?? raw.errorCode ?? payload.error ?? raw.error ?? "REQUEST_FAILED");
    const message = String(payload.message ?? raw.message ?? code);
    throw new ApiError({
      path: params.path,
      status: response.status,
      code,
      message: `${params.path} -> ${response.status} ${code}: ${message}`,
    });
  }
  return payload as T;
}

async function getJson<T = Record<string, unknown>>(params: {
  baseUrl: string;
  path: string;
  bearer?: string | null;
  headers?: Record<string, string>;
}): Promise<T> {
  const headers: Record<string, string> = {
    ...(params.headers ?? {}),
  };
  if (params.bearer) headers.Authorization = `Bearer ${params.bearer}`;
  const response = await fetch(`${params.baseUrl}${params.path}`, {
    method: "GET",
    headers,
  });
  const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const { payload, isOk } = unwrapPayload(raw);
  if (!response.ok || !isOk) {
    const code = String(payload.errorCode ?? raw.errorCode ?? payload.error ?? raw.error ?? "REQUEST_FAILED");
    const message = String(payload.message ?? raw.message ?? code);
    throw new ApiError({
      path: params.path,
      status: response.status,
      code,
      message: `${params.path} -> ${response.status} ${code}: ${message}`,
    });
  }
  return payload as T;
}

async function getSupabaseClients(baseUrl: string): Promise<SupabaseClients> {
  const supabaseUrl = pickNonEmpty(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = pickNonEmpty(process.env.SUPABASE_ANON_KEY, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const serviceRole = pickNonEmpty(process.env.SUPABASE_SERVICE_ROLE);
  if (!supabaseUrl || !supabaseAnonKey || !serviceRole) {
    throw new Error("SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE are required");
  }
  const service = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await service.auth.signOut().catch(() => {});
  await anon.auth.signOut().catch(() => {});
  if (!/^https?:\/\//i.test(baseUrl)) throw new Error("Invalid base URL");
  return { service, anon };
}

async function mintTokenForEmail(params: {
  email: string;
  baseUrl: string;
  clients: SupabaseClients;
}): Promise<string> {
  const redirectTo = `${params.baseUrl}/auth/callback`;
  const generated = await params.clients.service.auth.admin.generateLink({
    type: "magiclink",
    email: params.email,
    options: { redirectTo },
  });
  if (generated.error) {
    throw new Error(`generateLink failed for ${params.email}: ${generated.error.message}`);
  }

  const payload = generated.data as any;
  const properties = payload?.properties ?? {};
  const emailOtp = typeof properties.email_otp === "string" ? properties.email_otp : null;
  const directTokenHash =
    typeof properties.hashed_token === "string"
      ? properties.hashed_token
      : typeof properties.token_hash === "string"
        ? properties.token_hash
        : null;
  const actionLink =
    typeof properties.action_link === "string"
      ? properties.action_link
      : typeof payload?.action_link === "string"
        ? payload.action_link
        : null;
  const parsedLink = actionLink && actionLink.startsWith("http") ? new URL(actionLink) : null;
  const linkTokenHash = parsedLink?.searchParams.get("token_hash");
  const linkType = parsedLink?.searchParams.get("type");

  const attempts: Array<Promise<any>> = [];
  if (emailOtp) {
    attempts.push(
      params.clients.anon.auth.verifyOtp({ email: params.email, token: emailOtp, type: "email" } as any),
      params.clients.anon.auth.verifyOtp({ email: params.email, token: emailOtp, type: "magiclink" } as any),
    );
  }
  if (directTokenHash) {
    attempts.push(
      params.clients.anon.auth.verifyOtp({
        email: params.email,
        token_hash: directTokenHash,
        type: "magiclink",
      } as any),
    );
  }
  if (linkTokenHash) {
    attempts.push(
      params.clients.anon.auth.verifyOtp({
        email: params.email,
        token_hash: linkTokenHash,
        type: linkType || "magiclink",
      } as any),
    );
  }

  for (const attempt of attempts) {
    // eslint-disable-next-line no-await-in-loop
    const result = await attempt.catch(() => null);
    const token = result?.data?.session?.access_token;
    if (typeof token === "string" && token.length > 20) return token;
  }
  throw new Error(`verifyOtp failed for ${params.email}`);
}

async function resolveAdminBearer(params: {
  baseUrl: string;
  orgGroupId: number;
  clients: SupabaseClients;
}): Promise<string> {
  const envBearer = pickNonEmpty(process.env.E2E_ADMIN_BEARER, process.env.E2E_USER_BEARER);
  if (envBearer) return envBearer;

  const owner = await prisma.organizationGroup.findUnique({
    where: { id: params.orgGroupId },
    select: {
      owner: {
        select: {
          users: {
            select: { email: true },
          },
        },
      },
    },
  });
  const ownerEmail = owner?.owner?.users?.email?.trim().toLowerCase() ?? null;
  if (!ownerEmail) {
    throw new Error("Missing E2E_ADMIN_BEARER and could not resolve organization owner email");
  }
  return mintTokenForEmail({
    email: ownerEmail,
    baseUrl: params.baseUrl,
    clients: params.clients,
  });
}

async function getMatchCounts(eventId: number) {
  const [total, pendingUnscheduled, scheduledAny] = await Promise.all([
    prisma.eventMatchSlot.count({
      where: { eventId },
    }),
    prisma.eventMatchSlot.count({
      where: {
        eventId,
        status: "PENDING",
        plannedStartAt: null,
        startTime: null,
      },
    }),
    prisma.eventMatchSlot.count({
      where: {
        eventId,
        OR: [{ plannedStartAt: { not: null } }, { startTime: { not: null } }],
      },
    }),
  ]);
  return { total, pendingUnscheduled, scheduledAny };
}

async function disableHardBlockGenerate(eventId: number) {
  const config = await prisma.padelTournamentConfig.findUnique({
    where: { eventId },
    select: { advancedSettings: true },
  });
  if (!config) return false;
  const advanced =
    config.advancedSettings && typeof config.advancedSettings === "object"
      ? (config.advancedSettings as Record<string, unknown>)
      : {};
  const capacityPolicy =
    advanced.capacityPolicy && typeof advanced.capacityPolicy === "object"
      ? ({ ...(advanced.capacityPolicy as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  if (capacityPolicy.hardBlockGenerate === false) return false;
  capacityPolicy.hardBlockGenerate = false;

  await prisma.padelTournamentConfig.update({
    where: { eventId },
    data: {
      advancedSettings: {
        ...advanced,
        capacityPolicy,
      } as any,
    },
  });
  return true;
}

async function waitForRunDone(params: {
  baseUrl: string;
  bearer: string;
  organizationId: number;
  runId: string;
  timeoutMs: number;
}) {
  const deadline = Date.now() + params.timeoutMs;
  while (Date.now() <= deadline) {
    // eslint-disable-next-line no-await-in-loop
    const result = await getJson<{ run?: { status?: string | null } }>({
      baseUrl: params.baseUrl,
      path: `/api/padel/calendar/auto-schedule/runs/${params.runId}?organizationId=${params.organizationId}`,
      bearer: params.bearer,
    }).catch(() => null);
    const status = typeof result?.run?.status === "string" ? result.run.status : null;
    if (status === "DONE" || status === "FAILED") return status;
    // eslint-disable-next-line no-await-in-loop
    await sleep(1200);
  }
  return "TIMEOUT";
}

async function main() {
  loadEnvForScript();
  const options = parseGenerateScheduleArgs(process.argv.slice(2));
  const startedAt = new Date();

  const organization = await prisma.organization.findFirst({
    where: { username: options.orgUsername },
    select: { id: true, groupId: true, username: true, publicName: true },
  });
  if (!organization) throw new Error(`Organization not found for username=${options.orgUsername}`);

  const clients = await getSupabaseClients(options.baseUrl);
  const adminBearer = await resolveAdminBearer({
    baseUrl: options.baseUrl,
    orgGroupId: organization.groupId,
    clients,
  });

  const events = await prisma.event.findMany({
    where: {
      organizationId: organization.id,
      templateType: "PADEL",
      isDeleted: false,
      title: { contains: `[seed:${options.runTag}]` },
    },
    select: {
      id: true,
      title: true,
      padelTournamentConfig: {
        select: { format: true },
      },
    },
    orderBy: { id: "asc" },
  });
  if (events.length === 0) {
    throw new Error(`No active seed events found for runTag=${options.runTag}`);
  }

  const report: Report = {
    runTag: options.runTag,
    organization: {
      id: organization.id,
      username: organization.username ?? null,
      name: organization.publicName ?? null,
    },
    startedAt: startedAt.toISOString(),
    finishedAt: startedAt.toISOString(),
    dryRun: options.dryRun,
    options: {
      baseUrl: options.baseUrl,
      generateExistingPolicy: options.generateExistingPolicy,
      executionMode: options.executionMode,
      partialMode: options.partialMode,
      strategy: options.strategy,
      startFromNow: options.startFromNow,
      pollTimeoutMs: options.pollTimeoutMs,
      bypassHardBlockGenerate: options.bypassHardBlockGenerate,
    },
    totals: {
      eventsTarget: events.length,
      eventsProcessed: 0,
      generatedCallsOk: 0,
      generatedCallsFailed: 0,
      scheduledCount: 0,
      skippedCount: 0,
      errors: 0,
    },
    events: [],
  };

  for (const event of events) {
    const format = event.padelTournamentConfig?.format;
    if (!format) continue;

    const links = await prisma.padelEventCategoryLink.findMany({
      where: { eventId: event.id, isEnabled: true },
      select: {
        padelCategoryId: true,
        category: { select: { label: true } },
      },
      orderBy: { id: "asc" },
    });

    const summary: EventSummary = {
      eventId: event.id,
      title: event.title ?? `event:${event.id}`,
      format,
      categories: links.map((link) => ({
        categoryId: link.padelCategoryId,
        label: link.category?.label ?? String(link.padelCategoryId),
      })),
      matchesBefore: await getMatchCounts(event.id),
      matchesAfterGenerate: { total: 0, pendingUnscheduled: 0, scheduledAny: 0 },
      matchesAfterSchedule: { total: 0, pendingUnscheduled: 0, scheduledAny: 0 },
      generatedByCategory: [],
      autoSchedule: {
        status: "noop",
        runId: null,
        runStatus: null,
        scheduledCount: 0,
        skippedCount: 0,
        unscheduledByReason: {},
        queued: false,
        applied: false,
        warningsCount: 0,
      },
      errors: [],
    };
    report.events.push(summary);

    try {
      for (const category of summary.categories) {
        const body: Record<string, unknown> = {
          eventId: event.id,
          categoryId: category.categoryId,
          format,
          existingPolicy: options.generateExistingPolicy,
        };
        if (options.generateExistingPolicy === "replace") {
          body.confirmReplaceExisting = true;
        }
        if (format === "GRUPOS_ELIMINATORIAS") {
          body.phase = "GROUPS";
        }

        try {
          const result = await postJson<Record<string, unknown>>({
            baseUrl: options.baseUrl,
            path: "/api/padel/matches/generate",
            bearer: adminBearer,
            body,
          });
          report.totals.generatedCallsOk += 1;
          summary.generatedByCategory.push({
            categoryId: category.categoryId,
            label: category.label,
            status: "ok",
            stage: typeof result.stage === "string" ? result.stage : null,
          });
        } catch (error) {
          if (
            options.bypassHardBlockGenerate &&
            error instanceof ApiError &&
            error.code === "GENERATION_PLAN_INFEASIBLE"
          ) {
            const bypassed = await disableHardBlockGenerate(event.id);
            if (bypassed) {
              try {
                const retried = await postJson<Record<string, unknown>>({
                  baseUrl: options.baseUrl,
                  path: "/api/padel/matches/generate",
                  bearer: adminBearer,
                  body,
                });
                report.totals.generatedCallsOk += 1;
                summary.generatedByCategory.push({
                  categoryId: category.categoryId,
                  label: category.label,
                  status: "ok",
                  stage: typeof retried.stage === "string" ? retried.stage : null,
                });
                continue;
              } catch (retryError) {
                report.totals.generatedCallsFailed += 1;
                const retryMessage =
                  retryError instanceof ApiError
                    ? `${retryError.status}:${retryError.code}`
                    : retryError instanceof Error
                      ? retryError.message
                      : String(retryError);
                summary.generatedByCategory.push({
                  categoryId: category.categoryId,
                  label: category.label,
                  status: "error",
                  error: `${retryMessage} (after_hardblock_bypass)`,
                });
                summary.errors.push(`GENERATE:${category.categoryId}:${retryMessage}:after_hardblock_bypass`);
                continue;
              }
            }
          }

          report.totals.generatedCallsFailed += 1;
          const message =
            error instanceof ApiError
              ? `${error.status}:${error.code}`
              : error instanceof Error
                ? error.message
                : String(error);
          summary.generatedByCategory.push({
            categoryId: category.categoryId,
            label: category.label,
            status: "error",
            error: message,
          });
          summary.errors.push(`GENERATE:${category.categoryId}:${message}`);
        }
      }

      if (format === "NON_STOP") {
        const needPairingsFailures = summary.generatedByCategory.filter(
          (entry) => entry.status === "error" && typeof entry.error === "string" && entry.error.includes("NEED_PAIRINGS"),
        );
        const hasCategoryGenerationOk = summary.generatedByCategory.some((entry) => entry.status === "ok");
        if (needPairingsFailures.length > 0 && !hasCategoryGenerationOk) {
          const globalBody: Record<string, unknown> = {
            eventId: event.id,
            format,
            existingPolicy: options.generateExistingPolicy,
          };
          if (options.generateExistingPolicy === "replace") {
            globalBody.confirmReplaceExisting = true;
          }
          try {
            const globalResult = await postJson<Record<string, unknown>>({
              baseUrl: options.baseUrl,
              path: "/api/padel/matches/generate",
              bearer: adminBearer,
              body: globalBody,
            });
            report.totals.generatedCallsOk += 1;
            report.totals.generatedCallsFailed = Math.max(
              0,
              report.totals.generatedCallsFailed - needPairingsFailures.length,
            );
            summary.generatedByCategory = summary.generatedByCategory.map((entry) => {
              if (
                entry.status === "error" &&
                typeof entry.error === "string" &&
                entry.error.includes("NEED_PAIRINGS")
              ) {
                return {
                  categoryId: entry.categoryId,
                  label: entry.label,
                  status: "ok" as const,
                  stage: `GLOBAL_FALLBACK:${typeof globalResult.stage === "string" ? globalResult.stage : "OK"}`,
                };
              }
              return entry;
            });
            summary.errors = summary.errors.filter((entry) => !entry.includes("NEED_PAIRINGS"));
          } catch (globalError) {
            const globalMessage =
              globalError instanceof ApiError
                ? `${globalError.status}:${globalError.code}`
                : globalError instanceof Error
                  ? globalError.message
                  : String(globalError);
            summary.errors.push(`GENERATE_GLOBAL_NON_STOP:${globalMessage}`);
          }
        }
      }

      summary.matchesAfterGenerate = await getMatchCounts(event.id);
      if (summary.matchesAfterGenerate.pendingUnscheduled <= 0) {
        summary.autoSchedule.status = "noop";
        summary.matchesAfterSchedule = summary.matchesAfterGenerate;
      } else {
        try {
          const result = await postJson<{
            runId?: string | null;
            scheduledCount?: number;
            skippedCount?: number;
            unscheduledByReason?: Record<string, number>;
            queued?: boolean;
            applied?: boolean;
            warnings?: unknown[];
          }>({
            baseUrl: options.baseUrl,
            path: `/api/padel/calendar/auto-schedule?organizationId=${organization.id}`,
            bearer: adminBearer,
            body: {
              eventId: event.id,
              dryRun: options.dryRun,
              partialMode: options.partialMode,
              executionMode: options.executionMode,
              strategy: options.strategy,
              startFromNow: options.startFromNow,
            },
          });

          const runId = typeof result.runId === "string" ? result.runId : null;
          let runStatus: string | null = null;
          if (!options.dryRun && options.executionMode === "ASYNC" && runId) {
            runStatus = await waitForRunDone({
              baseUrl: options.baseUrl,
              bearer: adminBearer,
              organizationId: organization.id,
              runId,
              timeoutMs: options.pollTimeoutMs,
            });
          }

          summary.autoSchedule = {
            status: "ok",
            runId,
            runStatus,
            scheduledCount: Number(result.scheduledCount ?? 0) || 0,
            skippedCount: Number(result.skippedCount ?? 0) || 0,
            unscheduledByReason:
              result.unscheduledByReason && typeof result.unscheduledByReason === "object"
                ? (result.unscheduledByReason as Record<string, number>)
                : {},
            queued: result.queued === true,
            applied: result.applied === true,
            warningsCount: Array.isArray(result.warnings) ? result.warnings.length : 0,
          };
          report.totals.scheduledCount += summary.autoSchedule.scheduledCount;
          report.totals.skippedCount += summary.autoSchedule.skippedCount;
        } catch (error) {
          const message =
            error instanceof ApiError
              ? `${error.status}:${error.code}`
              : error instanceof Error
                ? error.message
                : String(error);
          summary.autoSchedule = {
            status: "error",
            runId: null,
            runStatus: null,
            scheduledCount: 0,
            skippedCount: 0,
            unscheduledByReason: {},
            queued: false,
            applied: false,
            warningsCount: 0,
            error: message,
          };
          summary.errors.push(`AUTO_SCHEDULE:${message}`);
        }
        summary.matchesAfterSchedule = await getMatchCounts(event.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.errors.push(`EVENT:${message}`);
    } finally {
      report.totals.eventsProcessed += 1;
      report.totals.errors += summary.errors.length;
    }
  }

  report.finishedAt = new Date().toISOString();
  console.log(JSON.stringify(report, null, 2));
  if (report.totals.errors > 0) process.exitCode = 1;
}

function shouldRunAsCli() {
  if (require.main === module) return true;
  const argv1 = process.argv[1] ?? "";
  const argv2 = process.argv[2] ?? "";
  return argv1.endsWith("scripts/run-ts.cjs") && argv2.includes("padel_generate_autoschedule_top_paddel.ts");
}

if (shouldRunAsCli()) {
  main()
    .catch((error) => {
      console.error("[padel_generate_autoschedule_top_paddel] failed", error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma?.$disconnect?.().catch(() => {});
    });
}
