import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type CrmConfig = {
  timezone: string;
  quietHoursStartMinute: number;
  quietHoursEndMinute: number;
  capPerDay: number;
  capPerWeek: number;
  capPerMonth: number;
  approvalEscalationHours: number;
  approvalExpireHours: number;
};

export const CRM_CONFIG_DEFAULTS: CrmConfig = {
  timezone: "Europe/Lisbon",
  quietHoursStartMinute: 22 * 60,
  quietHoursEndMinute: 8 * 60,
  capPerDay: 1,
  capPerWeek: 4,
  capPerMonth: 10,
  approvalEscalationHours: 24,
  approvalExpireHours: 48,
};

export type CrmPolicyClient = Prisma.TransactionClient | typeof prisma;

function parseIntValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
}

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeCrmConfigInput(raw: unknown, current?: CrmConfig): CrmConfig {
  const fallback = current ?? CRM_CONFIG_DEFAULTS;
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const timezone = typeof data.timezone === "string" && data.timezone.trim() ? data.timezone.trim() : fallback.timezone;

  const quietHoursStartMinute = clampInt(
    parseIntValue(data.quietHoursStartMinute) ?? fallback.quietHoursStartMinute,
    0,
    1439,
  );
  const quietHoursEndMinute = clampInt(
    parseIntValue(data.quietHoursEndMinute) ?? fallback.quietHoursEndMinute,
    0,
    1439,
  );

  const capPerDay = clampInt(parseIntValue(data.capPerDay) ?? fallback.capPerDay, 0, 100);
  const capPerWeek = clampInt(parseIntValue(data.capPerWeek) ?? fallback.capPerWeek, capPerDay, 500);
  const capPerMonth = clampInt(parseIntValue(data.capPerMonth) ?? fallback.capPerMonth, capPerWeek, 3000);

  const approvalEscalationHours = clampInt(
    parseIntValue(data.approvalEscalationHours) ?? fallback.approvalEscalationHours,
    1,
    168,
  );
  const approvalExpireHours = clampInt(
    parseIntValue(data.approvalExpireHours) ?? fallback.approvalExpireHours,
    approvalEscalationHours,
    336,
  );

  return {
    timezone,
    quietHoursStartMinute,
    quietHoursEndMinute,
    capPerDay,
    capPerWeek,
    capPerMonth,
    approvalEscalationHours,
    approvalExpireHours,
  };
}

export function policyToConfig(policy: {
  timezone: string;
  quietHoursStartMinute: number;
  quietHoursEndMinute: number;
  capPerDay: number;
  capPerWeek: number;
  capPerMonth: number;
  approvalEscalationHours: number;
  approvalExpireHours: number;
}): CrmConfig {
  return {
    timezone: policy.timezone,
    quietHoursStartMinute: policy.quietHoursStartMinute,
    quietHoursEndMinute: policy.quietHoursEndMinute,
    capPerDay: policy.capPerDay,
    capPerWeek: policy.capPerWeek,
    capPerMonth: policy.capPerMonth,
    approvalEscalationHours: policy.approvalEscalationHours,
    approvalExpireHours: policy.approvalExpireHours,
  };
}

export async function ensureCrmPolicy(
  client: CrmPolicyClient,
  organizationId: number,
  timezoneFallback = CRM_CONFIG_DEFAULTS.timezone,
) {
  return client.crmOrganizationPolicy.upsert({
    where: { organizationId },
    update: {},
    create: {
      organizationId,
      timezone: timezoneFallback,
      quietHoursStartMinute: CRM_CONFIG_DEFAULTS.quietHoursStartMinute,
      quietHoursEndMinute: CRM_CONFIG_DEFAULTS.quietHoursEndMinute,
      capPerDay: CRM_CONFIG_DEFAULTS.capPerDay,
      capPerWeek: CRM_CONFIG_DEFAULTS.capPerWeek,
      capPerMonth: CRM_CONFIG_DEFAULTS.capPerMonth,
      approvalEscalationHours: CRM_CONFIG_DEFAULTS.approvalEscalationHours,
      approvalExpireHours: CRM_CONFIG_DEFAULTS.approvalExpireHours,
    },
    select: {
      organizationId: true,
      timezone: true,
      quietHoursStartMinute: true,
      quietHoursEndMinute: true,
      capPerDay: true,
      capPerWeek: true,
      capPerMonth: true,
      approvalEscalationHours: true,
      approvalExpireHours: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
