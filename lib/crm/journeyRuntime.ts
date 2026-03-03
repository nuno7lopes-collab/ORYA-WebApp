import {
  CrmCampaignDeliveryChannel,
  CrmDeliveryStatus,
  CrmInteractionType,
  CrmJourneyRunLifecycleStatus,
  CrmJourneyStatus,
  CrmJourneyStepLogStatus,
  CrmJourneyStepType,
  NotificationType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveSegmentContactIds } from "@/lib/crm/segmentQuery";
import { ensureCrmPolicy, policyToConfig, type CrmConfig } from "@/lib/crm/policy";
import { createNotification } from "@/lib/notifications";
import { sendCrmCampaignEmail } from "@/lib/emailSender";
import { getPlatformOfficialEmail } from "@/lib/platformSettings";
import { normalizeOfficialEmail } from "@/lib/organizationOfficialEmailUtils";
import {
  normalizeCrmAbTestConfig,
  resolveCrmAbAssignment,
  resolveCrmAbMessage,
  type CrmAbAssignment,
} from "@/lib/crm/abTesting";
import { isCrmPadelJourneyTriggerToken } from "@/lib/crm/padelInteractionTypes";

const DEFAULT_JOURNEY_LIMIT = 20;
const MAX_JOURNEY_LIMIT = 100;
const DEFAULT_ENROLLMENTS_PER_JOURNEY = 200;
const MAX_ENROLLMENTS_PER_JOURNEY = 1000;
const DEFAULT_RUNS_PER_JOURNEY = 200;
const MAX_RUNS_PER_JOURNEY = 1000;
const SEGMENT_REENTRY_LOOKBACK_DAYS = 7;
const MAX_ACTION_ATTEMPTS = 3;
const MAX_CONDITION_ATTEMPTS = 2;
const ACTION_RETRY_BACKOFF_MINUTES = [5, 15, 60];

const SENT_LIKE_STATUSES: CrmDeliveryStatus[] = [
  CrmDeliveryStatus.SENT,
  CrmDeliveryStatus.OPENED,
  CrmDeliveryStatus.CLICKED,
];

type RuntimeOptions = {
  now?: Date;
  journeyLimit?: number;
  enrollmentsPerJourney?: number;
  runsPerJourney?: number;
};

export type CrmJourneyRuntimeResult = {
  generatedAt: string;
  journeysScanned: number;
  runsEnrolled: number;
  runsProcessed: number;
  runsCompleted: number;
  runsSkipped: number;
  runsFailed: number;
  runsWaiting: number;
  stepLogsCreated: number;
  stepLogsCompleted: number;
  stepLogsSkipped: number;
  stepLogsFailed: number;
  warnings: Array<{ journeyId?: string; runId?: string; message: string }>;
};

type RunProcessCounters = {
  created: number;
  completed: number;
  skipped: number;
  failed: number;
};

type RunProcessStatus = "noop" | "waiting" | "completed" | "skipped" | "failed";

type RunProcessResult = {
  status: RunProcessStatus;
  counters: RunProcessCounters;
  warning?: string;
};

type JourneyConditionSnapshot = {
  lastActivityAt: Date | null;
  totalSpentCents: number;
  marketingOptIn: boolean;
  contactType: string;
  tags: string[];
  churnRiskScore: number | null;
  reactivationPropensityScore: number | null;
  padelActivityStatus: string | null;
};

type ConditionEvalResult = {
  matched: boolean;
  detail: string;
};

type ActionOutcome =
  | { state: "COMPLETED"; detail: string; channel: CrmCampaignDeliveryChannel; abTest: CrmAbAssignment | null }
  | { state: "SKIPPED"; detail: string; abTest: CrmAbAssignment | null }
  | { state: "DEFERRED"; detail: string; scheduledFor: Date; abTest: CrmAbAssignment | null }
  | { state: "FAILED"; detail: string; code: string; abTest: CrmAbAssignment | null };

type StepExecutionTicket =
  | { kind: "ready"; logId: string; attempt: number }
  | { kind: "waiting" }
  | { kind: "already_done" }
  | { kind: "exhausted"; attempts: number };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function parseLimit(value: number | undefined, fallback: number, max: number) {
  if (!Number.isFinite(value ?? NaN)) return fallback;
  return clamp(Math.trunc(value as number), 1, max);
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parsePositiveInt(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.trunc(parsed);
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const token = value.trim().toLowerCase();
    if (token === "true") return true;
    if (token === "false") return false;
  }
  return null;
}

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDaysToken(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  if (typeof value !== "string") return null;
  const match = value.trim().toLowerCase().match(/^(\d+)\s*d$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function compareNumbers(current: number, target: number, op: string) {
  switch (op) {
    case "gt":
      return current > target;
    case "gte":
      return current >= target;
    case "lt":
      return current < target;
    case "lte":
      return current <= target;
    case "neq":
    case "not_eq":
      return current !== target;
    default:
      return current === target;
  }
}

function compareStrings(current: string, expected: string, op: string) {
  if (op === "neq" || op === "not_eq") return current !== expected;
  return current === expected;
}

function nextBackoffMinutes(attempt: number) {
  const idx = clamp(attempt - 1, 0, ACTION_RETRY_BACKOFF_MINUTES.length - 1);
  return ACTION_RETRY_BACKOFF_MINUTES[idx];
}

function minuteInTimezone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function isInQuietHours(minute: number, startMinute: number, endMinute: number) {
  if (startMinute === endMinute) return false;
  if (startMinute < endMinute) {
    return minute >= startMinute && minute < endMinute;
  }
  return minute >= startMinute || minute < endMinute;
}

export function resolveQuietHoursDeferral(params: {
  now: Date;
  timezone: string;
  startMinute: number;
  endMinute: number;
}): Date | null {
  const minute = minuteInTimezone(params.now, params.timezone);
  if (!isInQuietHours(minute, params.startMinute, params.endMinute)) return null;

  const shifted = new Date(params.now);
  if (params.startMinute < params.endMinute) {
    shifted.setHours(Math.floor(params.endMinute / 60), params.endMinute % 60, 0, 0);
    if (shifted <= params.now) shifted.setDate(shifted.getDate() + 1);
    return shifted;
  }

  if (minute >= params.startMinute) {
    shifted.setDate(shifted.getDate() + 1);
  }
  shifted.setHours(Math.floor(params.endMinute / 60), params.endMinute % 60, 0, 0);
  return shifted;
}

export function evaluateJourneyCondition(params: {
  field: string;
  op: string;
  value: unknown;
  windowDays?: number | null;
  snapshot: JourneyConditionSnapshot;
  now?: Date;
}): ConditionEvalResult {
  const now = params.now ?? new Date();
  const field = params.field.trim();
  const op = params.op.trim().toLowerCase() || "eq";
  const value = params.value;

  if (field === "lastActivityAt") {
    const since = params.snapshot.lastActivityAt;
    if (!since) return { matched: false, detail: "Contacto sem última atividade." };

    const forcedWindow =
      typeof params.windowDays === "number" && Number.isFinite(params.windowDays) && params.windowDays > 0
        ? Math.trunc(params.windowDays)
        : null;
    const tokenDays = parseDaysToken(value);

    if (forcedWindow || tokenDays) {
      const threshold = forcedWindow ?? tokenDays ?? 0;
      const daysSince = Math.floor((now.getTime() - since.getTime()) / (24 * 60 * 60 * 1000));
      let matched = false;
      if (op === "gte") matched = daysSince <= threshold;
      else if (op === "lte") matched = daysSince >= threshold;
      else matched = daysSince === threshold;
      return {
        matched,
        detail: matched
          ? `Última atividade dentro da janela de ${threshold} dia(s).`
          : `Última atividade fora da janela de ${threshold} dia(s).`,
      };
    }

    const expectedDate = parseDate(value);
    if (!expectedDate) {
      return { matched: false, detail: "Condição de data inválida." };
    }

    const currentMs = since.getTime();
    const expectedMs = expectedDate.getTime();
    let matched = false;
    if (op === "gt") matched = currentMs > expectedMs;
    else if (op === "gte") matched = currentMs >= expectedMs;
    else if (op === "lt") matched = currentMs < expectedMs;
    else if (op === "lte") matched = currentMs <= expectedMs;
    else if (op === "neq" || op === "not_eq") matched = currentMs !== expectedMs;
    else matched = currentMs === expectedMs;
    return { matched, detail: matched ? "Condição de atividade satisfeita." : "Condição de atividade não satisfeita." };
  }

  if (field === "totalSpentCents") {
    const target = Number(value);
    if (!Number.isFinite(target)) return { matched: false, detail: "Valor de gasto inválido." };
    const matched = compareNumbers(params.snapshot.totalSpentCents, target, op);
    return {
      matched,
      detail: matched ? "Condição de gasto satisfeita." : "Condição de gasto não satisfeita.",
    };
  }

  if (field === "marketingOptIn") {
    const expected = parseBoolean(value);
    if (expected === null) return { matched: false, detail: "Condição de consentimento inválida." };
    const matched = params.snapshot.marketingOptIn === expected;
    return {
      matched,
      detail: matched ? "Consentimento compatível." : "Consentimento incompatível.",
    };
  }

  if (field === "contactType") {
    const current = params.snapshot.contactType.trim().toLowerCase();
    const values = parseStringList(value);
    if (!values.length) return { matched: false, detail: "Condição de tipo de contacto inválida." };
    let matched = false;
    if (op === "in") matched = values.includes(current);
    else if (op === "not_in") matched = !values.includes(current);
    else matched = compareStrings(current, values[0], op);
    return {
      matched,
      detail: matched ? "Tipo de contacto compatível." : "Tipo de contacto incompatível.",
    };
  }

  if (field === "churnRiskScore" || field === "reactivationPropensityScore") {
    const target = Number(value);
    if (!Number.isFinite(target)) return { matched: false, detail: "Valor numérico inválido." };
    const current =
      field === "churnRiskScore"
        ? (params.snapshot.churnRiskScore ?? Number.NaN)
        : (params.snapshot.reactivationPropensityScore ?? Number.NaN);
    if (!Number.isFinite(current)) {
      return { matched: false, detail: "Sem score disponível para o contacto." };
    }
    const matched = compareNumbers(current, target, op);
    return {
      matched,
      detail: matched ? "Score compatível." : "Score incompatível.",
    };
  }

  if (field === "padelActivityStatus") {
    const current = (params.snapshot.padelActivityStatus ?? "").trim().toLowerCase();
    const values = parseStringList(value);
    if (!values.length) return { matched: false, detail: "Estado de atividade inválido." };
    let matched = false;
    if (op === "in") matched = values.includes(current);
    else if (op === "not_in") matched = !values.includes(current);
    else matched = compareStrings(current, values[0], op);
    return {
      matched,
      detail: matched ? "Estado de atividade compatível." : "Estado de atividade incompatível.",
    };
  }

  if (field === "tag") {
    const contactTags = params.snapshot.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
    const expectedTags = parseStringList(value);
    if (!expectedTags.length) return { matched: false, detail: "Tag inválida." };
    const anyMatch = expectedTags.some((tag) => contactTags.includes(tag));
    const matched = op === "not_in" ? !anyMatch : anyMatch;
    return {
      matched,
      detail: matched ? "Tags compatíveis." : "Tags incompatíveis.",
    };
  }

  return { matched: false, detail: `Campo não suportado: ${field}.` };
}

async function loadContactExposureCounts(params: {
  organizationId: number;
  contactId: string;
  now: Date;
}) {
  const daySince = new Date(params.now.getTime() - 24 * 60 * 60 * 1000);
  const weekSince = new Date(params.now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthSince = new Date(params.now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [campaignDay, campaignWeek, campaignMonth, journeyDay, journeyWeek, journeyMonth] = await Promise.all([
    prisma.crmCampaignDelivery.count({
      where: {
        organizationId: params.organizationId,
        contactId: params.contactId,
        status: { in: SENT_LIKE_STATUSES },
        sentAt: { gte: daySince },
      },
    }),
    prisma.crmCampaignDelivery.count({
      where: {
        organizationId: params.organizationId,
        contactId: params.contactId,
        status: { in: SENT_LIKE_STATUSES },
        sentAt: { gte: weekSince },
      },
    }),
    prisma.crmCampaignDelivery.count({
      where: {
        organizationId: params.organizationId,
        contactId: params.contactId,
        status: { in: SENT_LIKE_STATUSES },
        sentAt: { gte: monthSince },
      },
    }),
    prisma.crmJourneyStepLog.count({
      where: {
        organizationId: params.organizationId,
        stepType: CrmJourneyStepType.ACTION,
        status: CrmJourneyStepLogStatus.COMPLETED,
        executedAt: { gte: daySince },
        journeyRun: { contactId: params.contactId },
      },
    }),
    prisma.crmJourneyStepLog.count({
      where: {
        organizationId: params.organizationId,
        stepType: CrmJourneyStepType.ACTION,
        status: CrmJourneyStepLogStatus.COMPLETED,
        executedAt: { gte: weekSince },
        journeyRun: { contactId: params.contactId },
      },
    }),
    prisma.crmJourneyStepLog.count({
      where: {
        organizationId: params.organizationId,
        stepType: CrmJourneyStepType.ACTION,
        status: CrmJourneyStepLogStatus.COMPLETED,
        executedAt: { gte: monthSince },
        journeyRun: { contactId: params.contactId },
      },
    }),
  ]);

  return {
    day: campaignDay + journeyDay,
    week: campaignWeek + journeyWeek,
    month: campaignMonth + journeyMonth,
  };
}

async function resolveStepExecutionTicket(params: {
  runId: string;
  organizationId: number;
  stepId: string;
  stepKey: string;
  stepType: CrmJourneyStepType;
  now: Date;
  maxAttempts: number;
}): Promise<StepExecutionTicket> {
  const lastLog = await prisma.crmJourneyStepLog.findFirst({
    where: {
      journeyRunId: params.runId,
      stepKey: params.stepKey,
    },
    orderBy: [{ attempt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      attempt: true,
      scheduledFor: true,
      createdAt: true,
    },
  });

  if (lastLog && (lastLog.status === CrmJourneyStepLogStatus.COMPLETED || lastLog.status === CrmJourneyStepLogStatus.SKIPPED)) {
    return { kind: "already_done" };
  }

  if (lastLog?.status === CrmJourneyStepLogStatus.PENDING) {
    if (lastLog.scheduledFor && lastLog.scheduledFor > params.now) {
      return { kind: "waiting" };
    }
    const update = await prisma.crmJourneyStepLog.updateMany({
      where: {
        id: lastLog.id,
        status: CrmJourneyStepLogStatus.PENDING,
      },
      data: {
        status: CrmJourneyStepLogStatus.RUNNING,
        errorCode: null,
        errorMessage: null,
      },
    });
    if (update.count === 1) {
      return { kind: "ready", logId: lastLog.id, attempt: lastLog.attempt };
    }
    return { kind: "waiting" };
  }

  if (lastLog?.status === CrmJourneyStepLogStatus.RUNNING) {
    await prisma.crmJourneyStepLog.updateMany({
      where: {
        id: lastLog.id,
        status: CrmJourneyStepLogStatus.RUNNING,
      },
      data: {
        status: CrmJourneyStepLogStatus.FAILED,
        executedAt: params.now,
        errorCode: "STALE_STEP",
        errorMessage: "Execução anterior interrompida.",
      },
    });
  }

  const nextAttempt = (lastLog?.attempt ?? 0) + 1;
  if (nextAttempt > params.maxAttempts) {
    return { kind: "exhausted", attempts: nextAttempt - 1 };
  }

  const created = await prisma.crmJourneyStepLog.create({
    data: {
      organizationId: params.organizationId,
      journeyRunId: params.runId,
      journeyStepId: params.stepId,
      stepKey: params.stepKey,
      stepType: params.stepType,
      status: CrmJourneyStepLogStatus.RUNNING,
      attempt: nextAttempt,
      metadata: {
        executionStartedAt: params.now.toISOString(),
      } as Prisma.InputJsonValue,
    },
    select: { id: true, attempt: true },
  });

  return { kind: "ready", logId: created.id, attempt: created.attempt };
}

async function executeAction(params: {
  now: Date;
  policy: CrmConfig;
  organizationId: number;
  journeyId: string;
  runId: string;
  stepKey: string;
  attempt: number;
  contact: {
    id: string;
    userId: string | null;
    contactEmail: string | null;
    marketingEmailOptIn: boolean;
    displayName: string | null;
  };
  config: Record<string, unknown>;
}): Promise<ActionOutcome> {
  const channelToken =
    typeof params.config.channel === "string" ? params.config.channel.trim().toUpperCase() : "IN_APP";
  const fallbackChannel = channelToken === "EMAIL" ? "EMAIL" : "IN_APP";

  const abTestConfig = normalizeCrmAbTestConfig(params.config.abTest);
  const abAssignment = resolveCrmAbAssignment({
    scope: "journey",
    entityId: `${params.journeyId}:${params.stepKey}`,
    contactId: params.contact.id,
    config: abTestConfig,
  });
  if (abAssignment.holdout) {
    return {
      state: "SKIPPED",
      detail: "Run em holdout do A/B test.",
      abTest: abAssignment,
    };
  }

  const deferUntil = resolveQuietHoursDeferral({
    now: params.now,
    timezone: params.policy.timezone,
    startMinute: params.policy.quietHoursStartMinute,
    endMinute: params.policy.quietHoursEndMinute,
  });
  if (deferUntil) {
    return {
      state: "DEFERRED",
      detail: `Diferido por quiet hours até ${deferUntil.toISOString()}.`,
      scheduledFor: deferUntil,
      abTest: abAssignment.enabled ? abAssignment : null,
    };
  }

  const caps = await loadContactExposureCounts({
    organizationId: params.organizationId,
    contactId: params.contact.id,
    now: params.now,
  });

  if (caps.day >= params.policy.capPerDay) {
    return { state: "SKIPPED", detail: "Cap diário atingido.", abTest: abAssignment.enabled ? abAssignment : null };
  }
  if (caps.week >= params.policy.capPerWeek) {
    return { state: "SKIPPED", detail: "Cap semanal atingido.", abTest: abAssignment.enabled ? abAssignment : null };
  }
  if (caps.month >= params.policy.capPerMonth) {
    return { state: "SKIPPED", detail: "Cap mensal atingido.", abTest: abAssignment.enabled ? abAssignment : null };
  }

  const baseTitle =
    typeof params.config.title === "string" && params.config.title.trim()
      ? params.config.title.trim()
      : "Atualização ORYA Padel";
  const baseBody =
    typeof params.config.body === "string" && params.config.body.trim()
      ? params.config.body.trim()
      : "Temos novidades para ti.";
  const baseCtaLabel =
    typeof params.config.ctaLabel === "string" && params.config.ctaLabel.trim()
      ? params.config.ctaLabel.trim()
      : "Ver detalhes";
  const baseCtaUrl =
    typeof params.config.ctaUrl === "string" && params.config.ctaUrl.trim()
      ? params.config.ctaUrl.trim()
      : "/me";
  const resolvedMessage = resolveCrmAbMessage({
    base: {
      title: baseTitle,
      body: baseBody,
      ctaLabel: baseCtaLabel,
      ctaUrl: baseCtaUrl,
      emailSubject: baseTitle,
    },
    assignment: abAssignment,
    fallbackChannel,
  });
  const resolvedChannel =
    resolvedMessage.channel === "EMAIL"
      ? CrmCampaignDeliveryChannel.EMAIL
      : CrmCampaignDeliveryChannel.IN_APP;

  if (resolvedMessage.delayMinutes > 0 && params.attempt === 1) {
    return {
      state: "DEFERRED",
      detail: `Diferido por variante A/B (${resolvedMessage.delayMinutes} min).`,
      scheduledFor: new Date(params.now.getTime() + resolvedMessage.delayMinutes * 60 * 1000),
      abTest: abAssignment.enabled ? abAssignment : null,
    };
  }

  if (resolvedChannel === CrmCampaignDeliveryChannel.IN_APP) {
    if (!params.contact.userId) {
      return {
        state: "SKIPPED",
        detail: "Contacto sem userId para notificação in-app.",
        abTest: abAssignment.enabled ? abAssignment : null,
      };
    }

    await createNotification({
      userId: params.contact.userId,
      organizationId: params.organizationId,
      type: NotificationType.CRM_CAMPAIGN,
      dedupeKey: `crm-journey:${params.runId}:${params.stepKey}:${params.attempt}`,
      title: resolvedMessage.title,
      body: resolvedMessage.body,
      ctaLabel: resolvedMessage.ctaLabel,
      ctaUrl: resolvedMessage.ctaUrl,
      payload: {
        journeyId: params.journeyId,
        journeyRunId: params.runId,
        stepKey: params.stepKey,
        channel: "IN_APP",
        abTest: {
          enabled: abAssignment.enabled,
          key: abAssignment.key,
          bucket: abAssignment.bucket,
          variantId: abAssignment.variantId,
        },
      } as Prisma.InputJsonValue,
    });

    return {
      state: "COMPLETED",
      detail: "Notificação in-app enviada.",
      channel: resolvedChannel,
      abTest: abAssignment.enabled ? abAssignment : null,
    };
  }

  if (!params.contact.contactEmail || !params.contact.marketingEmailOptIn) {
    return {
      state: "SKIPPED",
      detail: "Contacto sem email elegível (consentimento/email).",
      abTest: abAssignment.enabled ? abAssignment : null,
    };
  }

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: params.organizationId },
      select: { publicName: true, officialEmail: true, officialEmailVerifiedAt: true },
    });
    const organizationName = organization?.publicName || "ORYA";
    const officialEmail = normalizeOfficialEmail(organization?.officialEmail ?? null);
    const platformOfficialEmail = await getPlatformOfficialEmail();
    const replyTo = organization?.officialEmailVerifiedAt && officialEmail ? officialEmail : platformOfficialEmail;

    await sendCrmCampaignEmail({
      to: params.contact.contactEmail,
      subject: resolvedMessage.emailSubject,
      organizationName,
      title: resolvedMessage.title,
      body: resolvedMessage.body,
      ctaLabel: resolvedMessage.ctaLabel,
      ctaUrl: resolvedMessage.ctaUrl,
      previewText: resolvedMessage.body,
      replyTo,
    });

    return {
      state: "COMPLETED",
      detail: "Email de journey enviado.",
      channel: resolvedChannel,
      abTest: abAssignment.enabled ? abAssignment : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha no envio de email";
    return {
      state: "FAILED",
      detail: message,
      code: "ACTION_EMAIL_FAILED",
      abTest: abAssignment.enabled ? abAssignment : null,
    };
  }
}

async function processJourneyRun(runId: string, now: Date): Promise<RunProcessResult> {
  const counters: RunProcessCounters = {
    created: 0,
    completed: 0,
    skipped: 0,
    failed: 0,
  };

  const run = await prisma.crmJourneyRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      organizationId: true,
      journeyId: true,
      contactId: true,
      status: true,
      journey: {
        select: {
          id: true,
          organizationId: true,
          status: true,
          steps: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              stepKey: true,
              stepType: true,
              config: true,
            },
          },
        },
      },
    },
  });

  if (!run) {
    return { status: "noop", counters, warning: "Run não encontrada." };
  }

  if (
    run.status === CrmJourneyRunLifecycleStatus.COMPLETED ||
    run.status === CrmJourneyRunLifecycleStatus.SKIPPED ||
    run.status === CrmJourneyRunLifecycleStatus.FAILED
  ) {
    return { status: "noop", counters };
  }

  if (!run.journey || run.journey.status !== CrmJourneyStatus.PUBLISHED) {
    await prisma.crmJourneyRun.update({
      where: { id: run.id },
      data: {
        status: CrmJourneyRunLifecycleStatus.SKIPPED,
        completedAt: now,
        errorCode: null,
        errorMessage: "Journey não publicada durante execução.",
      },
    });
    return { status: "skipped", counters, warning: "Journey deixou de estar publicada." };
  }

  if (run.status === CrmJourneyRunLifecycleStatus.PENDING) {
    await prisma.crmJourneyRun.updateMany({
      where: {
        id: run.id,
        status: CrmJourneyRunLifecycleStatus.PENDING,
      },
      data: {
        status: CrmJourneyRunLifecycleStatus.RUNNING,
        startedAt: now,
      },
    });
  }

  if (!run.contactId) {
    await prisma.crmJourneyRun.update({
      where: { id: run.id },
      data: {
        status: CrmJourneyRunLifecycleStatus.FAILED,
        failedAt: now,
        errorCode: "CONTACT_REQUIRED",
        errorMessage: "Run sem contacto associado.",
      },
    });
    return { status: "failed", counters, warning: "Run sem contacto." };
  }

  const contact = await prisma.crmContact.findFirst({
    where: {
      id: run.contactId,
      organizationId: run.organizationId,
    },
    select: {
      id: true,
      userId: true,
      displayName: true,
      contactEmail: true,
      marketingEmailOptIn: true,
      contactType: true,
      lastActivityAt: true,
      totalSpentCents: true,
      tags: true,
      padelProfile: {
        select: {
          churnRiskScore: true,
          reactivationPropensityScore: true,
          activityStatus: true,
        },
      },
    },
  });

  if (!contact) {
    await prisma.crmJourneyRun.update({
      where: { id: run.id },
      data: {
        status: CrmJourneyRunLifecycleStatus.FAILED,
        failedAt: now,
        errorCode: "CONTACT_NOT_FOUND",
        errorMessage: "Contacto da run não encontrado.",
      },
    });
    return { status: "failed", counters, warning: "Contacto não encontrado." };
  }

  const policy = policyToConfig(await ensureCrmPolicy(prisma, run.organizationId));

  for (const step of run.journey.steps) {
    if (step.stepType === CrmJourneyStepType.TRIGGER) continue;

    if (step.stepType === CrmJourneyStepType.DELAY) {
      const config = asObject(step.config);
      const minutes = parsePositiveInt(config.minutes, 60);
      const lastLog = await prisma.crmJourneyStepLog.findFirst({
        where: {
          journeyRunId: run.id,
          stepKey: step.stepKey,
        },
        orderBy: [{ attempt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          attempt: true,
          status: true,
          scheduledFor: true,
        },
      });

      if (lastLog?.status === CrmJourneyStepLogStatus.COMPLETED || lastLog?.status === CrmJourneyStepLogStatus.SKIPPED) {
        continue;
      }

      if (!lastLog) {
        await prisma.crmJourneyStepLog.create({
          data: {
            organizationId: run.organizationId,
            journeyRunId: run.id,
            journeyStepId: step.id,
            stepKey: step.stepKey,
            stepType: step.stepType,
            status: CrmJourneyStepLogStatus.PENDING,
            attempt: 1,
            scheduledFor: new Date(now.getTime() + minutes * 60 * 1000),
            metadata: {
              minutes,
              reason: "WAIT_DELAY",
            } as Prisma.InputJsonValue,
          },
        });
        counters.created += 1;
        return { status: "waiting", counters };
      }

      if (lastLog.status === CrmJourneyStepLogStatus.PENDING) {
        if (lastLog.scheduledFor && lastLog.scheduledFor > now) {
          return { status: "waiting", counters };
        }

        await prisma.crmJourneyStepLog.updateMany({
          where: {
            id: lastLog.id,
            status: CrmJourneyStepLogStatus.PENDING,
          },
          data: {
            status: CrmJourneyStepLogStatus.COMPLETED,
            executedAt: now,
            metadata: {
              minutes,
              releasedAt: now.toISOString(),
            } as Prisma.InputJsonValue,
          },
        });
        counters.completed += 1;
        continue;
      }

      if (lastLog.status === CrmJourneyStepLogStatus.RUNNING || lastLog.status === CrmJourneyStepLogStatus.FAILED) {
        await prisma.crmJourneyStepLog.create({
          data: {
            organizationId: run.organizationId,
            journeyRunId: run.id,
            journeyStepId: step.id,
            stepKey: step.stepKey,
            stepType: step.stepType,
            status: CrmJourneyStepLogStatus.PENDING,
            attempt: Math.max(1, lastLog.attempt + 1),
            scheduledFor: new Date(now.getTime() + minutes * 60 * 1000),
            metadata: {
              minutes,
              reason: "RETRY_DELAY",
            } as Prisma.InputJsonValue,
          },
        });
        counters.created += 1;
        return { status: "waiting", counters };
      }

      continue;
    }

    const maxAttempts = step.stepType === CrmJourneyStepType.CONDITION ? MAX_CONDITION_ATTEMPTS : MAX_ACTION_ATTEMPTS;
    const ticket = await resolveStepExecutionTicket({
      runId: run.id,
      organizationId: run.organizationId,
      stepId: step.id,
      stepKey: step.stepKey,
      stepType: step.stepType,
      now,
      maxAttempts,
    });

    if (ticket.kind === "already_done") {
      continue;
    }

    if (ticket.kind === "waiting") {
      return { status: "waiting", counters };
    }

    if (ticket.kind === "exhausted") {
      await prisma.crmJourneyRun.update({
        where: { id: run.id },
        data: {
          status: CrmJourneyRunLifecycleStatus.FAILED,
          failedAt: now,
          errorCode: "STEP_RETRY_EXHAUSTED",
          errorMessage: `Tentativas esgotadas no passo ${step.stepKey}.`,
        },
      });
      return { status: "failed", counters, warning: `Tentativas esgotadas no passo ${step.stepKey}.` };
    }

    counters.created += 1;

    if (step.stepType === CrmJourneyStepType.CONDITION) {
      const config = asObject(step.config);
      const field = typeof config.field === "string" ? config.field : "";
      const op = typeof config.op === "string" ? config.op : "eq";
      const conditionResult = evaluateJourneyCondition({
        field,
        op,
        value: config.value,
        windowDays:
          typeof config.windowDays === "number" && Number.isFinite(config.windowDays)
            ? Math.trunc(config.windowDays)
            : null,
        snapshot: {
          lastActivityAt: contact.lastActivityAt,
          totalSpentCents: contact.totalSpentCents,
          marketingOptIn: contact.marketingEmailOptIn,
          contactType: contact.contactType,
          tags: contact.tags,
          churnRiskScore: contact.padelProfile?.churnRiskScore ?? null,
          reactivationPropensityScore: contact.padelProfile?.reactivationPropensityScore ?? null,
          padelActivityStatus: contact.padelProfile?.activityStatus ?? null,
        },
        now,
      });

      await prisma.crmJourneyStepLog.update({
        where: { id: ticket.logId },
        data: {
          status: conditionResult.matched ? CrmJourneyStepLogStatus.COMPLETED : CrmJourneyStepLogStatus.SKIPPED,
          executedAt: now,
          metadata: {
            field,
            op,
            value: config.value ?? null,
            matched: conditionResult.matched,
            detail: conditionResult.detail,
          } as Prisma.InputJsonValue,
        },
      });

      if (conditionResult.matched) {
        counters.completed += 1;
        continue;
      }

      counters.skipped += 1;
      await prisma.crmJourneyRun.update({
        where: { id: run.id },
        data: {
          status: CrmJourneyRunLifecycleStatus.SKIPPED,
          completedAt: now,
          errorCode: null,
          errorMessage: conditionResult.detail,
        },
      });
      return { status: "skipped", counters };
    }

    if (step.stepType === CrmJourneyStepType.ACTION) {
      const config = asObject(step.config);
      const actionResult = await executeAction({
        now,
        policy,
        organizationId: run.organizationId,
        journeyId: run.journeyId,
        runId: run.id,
        stepKey: step.stepKey,
        attempt: ticket.attempt,
        contact: {
          id: contact.id,
          userId: contact.userId,
          contactEmail: contact.contactEmail,
          marketingEmailOptIn: contact.marketingEmailOptIn,
          displayName: contact.displayName,
        },
        config,
      });

      if (actionResult.state === "DEFERRED") {
        await prisma.crmJourneyStepLog.update({
          where: { id: ticket.logId },
          data: {
            status: CrmJourneyStepLogStatus.PENDING,
            scheduledFor: actionResult.scheduledFor,
            metadata: {
              reason: "QUIET_HOURS",
              detail: actionResult.detail,
              ...(actionResult.abTest
                ? {
                    abTest: {
                      key: actionResult.abTest.key,
                      bucket: actionResult.abTest.bucket,
                      variantId: actionResult.abTest.variantId,
                    },
                  }
                : {}),
            } as Prisma.InputJsonValue,
          },
        });
        return { status: "waiting", counters };
      }

      if (actionResult.state === "SKIPPED") {
        await prisma.crmJourneyStepLog.update({
          where: { id: ticket.logId },
          data: {
            status: CrmJourneyStepLogStatus.SKIPPED,
            executedAt: now,
            metadata: {
              detail: actionResult.detail,
              ...(actionResult.abTest
                ? {
                    abTest: {
                      key: actionResult.abTest.key,
                      bucket: actionResult.abTest.bucket,
                      variantId: actionResult.abTest.variantId,
                    },
                  }
                : {}),
            } as Prisma.InputJsonValue,
          },
        });
        counters.skipped += 1;
        continue;
      }

      if (actionResult.state === "COMPLETED") {
        await prisma.crmJourneyStepLog.update({
          where: { id: ticket.logId },
          data: {
            status: CrmJourneyStepLogStatus.COMPLETED,
            executedAt: now,
            metadata: {
              detail: actionResult.detail,
              channel: actionResult.channel,
              ...(actionResult.abTest
                ? {
                    abTest: {
                      key: actionResult.abTest.key,
                      bucket: actionResult.abTest.bucket,
                      variantId: actionResult.abTest.variantId,
                    },
                  }
                : {}),
            } as Prisma.InputJsonValue,
          },
        });
        counters.completed += 1;
        continue;
      }

      await prisma.crmJourneyStepLog.update({
        where: { id: ticket.logId },
        data: {
          status: CrmJourneyStepLogStatus.FAILED,
          executedAt: now,
          errorCode: actionResult.code,
          errorMessage: actionResult.detail.slice(0, 200),
        },
      });
      counters.failed += 1;

      if (ticket.attempt < MAX_ACTION_ATTEMPTS) {
        const backoffMinutes = nextBackoffMinutes(ticket.attempt);
        await prisma.crmJourneyStepLog.create({
          data: {
            organizationId: run.organizationId,
            journeyRunId: run.id,
            journeyStepId: step.id,
            stepKey: step.stepKey,
            stepType: CrmJourneyStepType.ACTION,
            status: CrmJourneyStepLogStatus.PENDING,
            attempt: ticket.attempt + 1,
            scheduledFor: new Date(now.getTime() + backoffMinutes * 60 * 1000),
            metadata: {
              reason: "ACTION_RETRY",
              backoffMinutes,
              ...(actionResult.abTest
                ? {
                    abTest: {
                      key: actionResult.abTest.key,
                      bucket: actionResult.abTest.bucket,
                      variantId: actionResult.abTest.variantId,
                    },
                  }
                : {}),
            } as Prisma.InputJsonValue,
          },
        });
        counters.created += 1;
        return { status: "waiting", counters };
      }

      await prisma.crmJourneyRun.update({
        where: { id: run.id },
        data: {
          status: CrmJourneyRunLifecycleStatus.FAILED,
          failedAt: now,
          errorCode: actionResult.code,
          errorMessage: actionResult.detail.slice(0, 200),
        },
      });
      return { status: "failed", counters };
    }
  }

  await prisma.crmJourneyRun.update({
    where: { id: run.id },
    data: {
      status: CrmJourneyRunLifecycleStatus.COMPLETED,
      completedAt: now,
      errorCode: null,
      errorMessage: null,
    },
  });

  return { status: "completed", counters };
}

function parseJourneyTrigger(payload: {
  definition: unknown;
  steps: Array<{ stepType: CrmJourneyStepType; config: unknown }>;
}): { eventType?: CrmInteractionType; segmentId?: string } {
  const triggerStep = payload.steps.find((step) => step.stepType === CrmJourneyStepType.TRIGGER);
  const triggerConfig = asObject(triggerStep?.config);

  const eventTypeRaw =
    typeof triggerConfig.eventType === "string"
      ? triggerConfig.eventType.trim().toUpperCase()
      : (() => {
          const definition = asObject(payload.definition);
          const trigger = asObject(definition.trigger);
          return typeof trigger.eventType === "string" ? trigger.eventType.trim().toUpperCase() : "";
        })();

  const segmentIdRaw =
    typeof triggerConfig.segmentId === "string"
      ? triggerConfig.segmentId.trim()
      : (() => {
          const definition = asObject(payload.definition);
          const trigger = asObject(definition.trigger);
          return typeof trigger.segmentId === "string" ? trigger.segmentId.trim() : "";
        })();

  const eventType = (Object.values(CrmInteractionType) as string[]).includes(eventTypeRaw)
    && isCrmPadelJourneyTriggerToken(eventTypeRaw)
    ? (eventTypeRaw as CrmInteractionType)
    : undefined;
  const segmentId = segmentIdRaw || undefined;

  return {
    ...(eventType ? { eventType } : {}),
    ...(segmentId ? { segmentId } : {}),
  };
}

async function enrollSegmentRuns(params: {
  now: Date;
  journeyId: string;
  organizationId: number;
  segmentId: string;
  maxContacts: number;
}): Promise<number> {
  const segment = await prisma.crmSegment.findFirst({
    where: {
      id: params.segmentId,
      organizationId: params.organizationId,
    },
    select: {
      id: true,
      rules: true,
    },
  });
  if (!segment) return 0;

  const audience = await resolveSegmentContactIds({
    organizationId: params.organizationId,
    rules: segment.rules,
    maxContacts: params.maxContacts,
  });
  if (!audience.contactIds.length) return 0;

  const lookbackSince = new Date(params.now.getTime() - SEGMENT_REENTRY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const existing = await prisma.crmJourneyRun.findMany({
    where: {
      journeyId: params.journeyId,
      contactId: { in: audience.contactIds },
      createdAt: { gte: lookbackSince },
    },
    select: { contactId: true },
  });
  const existingSet = new Set(existing.map((item) => item.contactId).filter(Boolean) as string[]);

  const candidates = audience.contactIds.filter((contactId) => !existingSet.has(contactId));
  if (!candidates.length) return 0;

  await prisma.crmJourneyRun.createMany({
    data: candidates.map((contactId) => ({
      organizationId: params.organizationId,
      journeyId: params.journeyId,
      contactId,
      status: CrmJourneyRunLifecycleStatus.PENDING,
      metadata: {
        trigger: {
          type: "SEGMENT",
          segmentId: params.segmentId,
        },
      } as Prisma.InputJsonValue,
    })),
  });

  return candidates.length;
}

async function enrollEventRuns(params: {
  journeyId: string;
  organizationId: number;
  eventType: CrmInteractionType;
  maxContacts: number;
}): Promise<number> {
  const interactions = await prisma.crmInteraction.findMany({
    where: {
      organizationId: params.organizationId,
      type: params.eventType,
    },
    orderBy: { occurredAt: "desc" },
    take: params.maxContacts,
    select: {
      id: true,
      contactId: true,
      occurredAt: true,
      sourceId: true,
    },
  });
  if (!interactions.length) return 0;

  const existing = await prisma.crmJourneyRun.findMany({
    where: {
      journeyId: params.journeyId,
      triggerEventId: { in: interactions.map((item) => item.id) },
    },
    select: { triggerEventId: true },
  });

  const existingSet = new Set(existing.map((item) => item.triggerEventId).filter(Boolean) as string[]);
  const candidates = interactions.filter((item) => !existingSet.has(item.id));
  if (!candidates.length) return 0;

  await prisma.crmJourneyRun.createMany({
    data: candidates.map((item) => ({
      organizationId: params.organizationId,
      journeyId: params.journeyId,
      contactId: item.contactId,
      triggerEventId: item.id,
      status: CrmJourneyRunLifecycleStatus.PENDING,
      metadata: {
        trigger: {
          type: "EVENT",
          eventType: params.eventType,
          occurredAt: item.occurredAt.toISOString(),
          sourceId: item.sourceId,
        },
      } as Prisma.InputJsonValue,
    })),
  });

  return candidates.length;
}

export async function processCrmJourneyRuntimeBatch(options?: RuntimeOptions): Promise<CrmJourneyRuntimeResult> {
  const now = options?.now ?? new Date();
  const journeyLimit = parseLimit(options?.journeyLimit, DEFAULT_JOURNEY_LIMIT, MAX_JOURNEY_LIMIT);
  const enrollmentsPerJourney = parseLimit(
    options?.enrollmentsPerJourney,
    DEFAULT_ENROLLMENTS_PER_JOURNEY,
    MAX_ENROLLMENTS_PER_JOURNEY,
  );
  const runsPerJourney = parseLimit(options?.runsPerJourney, DEFAULT_RUNS_PER_JOURNEY, MAX_RUNS_PER_JOURNEY);

  const result: CrmJourneyRuntimeResult = {
    generatedAt: now.toISOString(),
    journeysScanned: 0,
    runsEnrolled: 0,
    runsProcessed: 0,
    runsCompleted: 0,
    runsSkipped: 0,
    runsFailed: 0,
    runsWaiting: 0,
    stepLogsCreated: 0,
    stepLogsCompleted: 0,
    stepLogsSkipped: 0,
    stepLogsFailed: 0,
    warnings: [],
  };

  const journeys = await prisma.crmJourney.findMany({
    where: { status: CrmJourneyStatus.PUBLISHED },
    orderBy: { updatedAt: "desc" },
    take: journeyLimit,
    select: {
      id: true,
      organizationId: true,
      definition: true,
      steps: {
        orderBy: { position: "asc" },
        select: {
          stepType: true,
          config: true,
        },
      },
    },
  });

  result.journeysScanned = journeys.length;

  for (const journey of journeys) {
    const trigger = parseJourneyTrigger({
      definition: journey.definition,
      steps: journey.steps,
    });

    if (trigger.segmentId) {
      try {
        const created = await enrollSegmentRuns({
          now,
          journeyId: journey.id,
          organizationId: journey.organizationId,
          segmentId: trigger.segmentId,
          maxContacts: enrollmentsPerJourney,
        });
        result.runsEnrolled += created;
      } catch (err) {
        result.warnings.push({
          journeyId: journey.id,
          message: `Falha ao inscrever via segmento: ${err instanceof Error ? err.message : "erro"}`,
        });
      }
    }

    if (trigger.eventType) {
      try {
        const created = await enrollEventRuns({
          journeyId: journey.id,
          organizationId: journey.organizationId,
          eventType: trigger.eventType,
          maxContacts: enrollmentsPerJourney,
        });
        result.runsEnrolled += created;
      } catch (err) {
        result.warnings.push({
          journeyId: journey.id,
          message: `Falha ao inscrever via evento: ${err instanceof Error ? err.message : "erro"}`,
        });
      }
    }

    if (!trigger.segmentId && !trigger.eventType) {
      result.warnings.push({
        journeyId: journey.id,
        message: "Journey sem trigger configurado (eventType ou segmentId).",
      });
    }

    const runs = await prisma.crmJourneyRun.findMany({
      where: {
        journeyId: journey.id,
        status: {
          in: [CrmJourneyRunLifecycleStatus.PENDING, CrmJourneyRunLifecycleStatus.RUNNING],
        },
      },
      orderBy: { createdAt: "asc" },
      take: runsPerJourney,
      select: { id: true },
    });

    for (const run of runs) {
      const runResult = await processJourneyRun(run.id, now);
      if (runResult.status === "noop") continue;

      result.runsProcessed += 1;
      result.stepLogsCreated += runResult.counters.created;
      result.stepLogsCompleted += runResult.counters.completed;
      result.stepLogsSkipped += runResult.counters.skipped;
      result.stepLogsFailed += runResult.counters.failed;

      if (runResult.status === "completed") result.runsCompleted += 1;
      if (runResult.status === "skipped") result.runsSkipped += 1;
      if (runResult.status === "failed") result.runsFailed += 1;
      if (runResult.status === "waiting") result.runsWaiting += 1;

      if (runResult.warning) {
        result.warnings.push({
          journeyId: journey.id,
          runId: run.id,
          message: runResult.warning,
        });
      }
    }
  }

  return result;
}
