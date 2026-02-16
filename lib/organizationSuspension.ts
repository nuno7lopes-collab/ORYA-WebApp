import { Prisma, PrismaClient, OrganizationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type TxLike = Prisma.TransactionClient | PrismaClient;

const DAY_MS = 24 * 60 * 60 * 1000;
export const ORGANIZATION_SUSPENSION_WINDOW_DAYS = 30;
export const ORGANIZATION_SUSPENSION_WINDOW_MS = ORGANIZATION_SUSPENSION_WINDOW_DAYS * DAY_MS;

const SUSPEND_ACTION = "ORGANIZATION_SUSPENDED";
const REACTIVATE_ACTION = "ORGANIZATION_REACTIVATED";
const ADMIN_STATUS_ACTION = "admin_organization_status_change";

type OrganizationAuditRow = {
  action: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date | null;
};

const asRecord = (value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const normalizeStatus = (value: unknown): OrganizationStatus | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === OrganizationStatus.PENDING) return OrganizationStatus.PENDING;
  if (normalized === OrganizationStatus.ACTIVE) return OrganizationStatus.ACTIVE;
  if (normalized === OrganizationStatus.SUSPENDED) return OrganizationStatus.SUSPENDED;
  return null;
};

const resolveAdminTargetStatus = (metadata: Prisma.JsonValue | null | undefined): OrganizationStatus | null => {
  const record = asRecord(metadata);
  if (!record) return null;
  return normalizeStatus(record.toStatus);
};

const isSuspendAudit = (row: OrganizationAuditRow) =>
  row.action === SUSPEND_ACTION ||
  (row.action === ADMIN_STATUS_ACTION && resolveAdminTargetStatus(row.metadata) === OrganizationStatus.SUSPENDED);

const isReactivateAudit = (row: OrganizationAuditRow) =>
  row.action === REACTIVATE_ACTION ||
  (row.action === ADMIN_STATUS_ACTION && resolveAdminTargetStatus(row.metadata) === OrganizationStatus.ACTIVE);

export type OrganizationSuspensionSnapshot = {
  status: OrganizationStatus | null;
  isSuspended: boolean;
  suspendedAt: Date | null;
  reactivatedAt: Date | null;
  reactivationDeadlineAt: Date | null;
  reactivationWindowOpen: boolean;
  remainingWindowMs: number | null;
  remainingWindowDays: number | null;
  suspensionTimestampUnknown: boolean;
};

export async function getOrganizationSuspensionSnapshot(params: {
  organizationId: number;
  status?: OrganizationStatus | string | null;
  updatedAt?: Date | null;
  now?: Date;
  client?: TxLike;
}): Promise<OrganizationSuspensionSnapshot> {
  const {
    organizationId,
    status,
    updatedAt = null,
    now = new Date(),
    client = prisma,
  } = params;

  const normalizedStatus = normalizeStatus(status ?? null);
  const rows = await client.organizationAuditLog.findMany({
    where: {
      organizationId,
      action: { in: [SUSPEND_ACTION, REACTIVATE_ACTION, ADMIN_STATUS_ACTION] },
    },
    select: {
      action: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });

  const latestSuspended = rows.find(isSuspendAudit)?.createdAt ?? null;
  const latestReactivated = rows.find(isReactivateAudit)?.createdAt ?? null;
  const isSuspended = normalizedStatus === OrganizationStatus.SUSPENDED;

  const effectiveSuspendedAt =
    isSuspended && latestSuspended ? latestSuspended : isSuspended && updatedAt ? updatedAt : null;

  const reactivationDeadlineAt = effectiveSuspendedAt
    ? new Date(effectiveSuspendedAt.getTime() + ORGANIZATION_SUSPENSION_WINDOW_MS)
    : null;

  const remainingWindowMs = reactivationDeadlineAt
    ? reactivationDeadlineAt.getTime() - now.getTime()
    : null;
  const reactivationWindowOpen = Boolean(
    isSuspended &&
      reactivationDeadlineAt &&
      remainingWindowMs !== null &&
      remainingWindowMs >= 0,
  );

  const remainingWindowDays =
    remainingWindowMs === null
      ? null
      : Math.max(0, Math.ceil(remainingWindowMs / DAY_MS));

  return {
    status: normalizedStatus,
    isSuspended,
    suspendedAt: effectiveSuspendedAt,
    reactivatedAt: latestReactivated,
    reactivationDeadlineAt,
    reactivationWindowOpen,
    remainingWindowMs,
    remainingWindowDays,
    suspensionTimestampUnknown: isSuspended && !effectiveSuspendedAt,
  };
}

export function normalizeOrganizationDangerReasonCode(raw: unknown, fallback = "OWNER_REQUEST") {
  if (typeof raw !== "string") return fallback;
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, "_");
  if (!normalized) return fallback;
  if (!/^[A-Z0-9_:-]{3,64}$/.test(normalized)) return fallback;
  return normalized;
}

