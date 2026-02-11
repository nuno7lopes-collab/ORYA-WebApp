// app/api/admin/organizacoes/update-status/route.ts

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { auditAdminAction } from "@/lib/admin/audit";
import { getClientIp } from "@/lib/auth/requestValidation";
import { appendEventLog } from "@/domain/eventLog/append";
import { logError } from "@/lib/observability/logger";
import { recordSearchIndexOrgStatusOutbox } from "@/domain/searchIndex/outbox";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { listEffectiveOrganizationMemberUserIdsByRoles } from "@/lib/organizationMembers";

// Tipos de estados permitidos para organizações (ajusta se o enum tiver outros valores)
const ALLOWED_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED"] as const;

type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

type UpdateOrganizationStatusBody = {
  organizationId?: number | string;
  newStatus?: string;
};

async function _POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
    }
    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent");

    const body = (await req.json().catch(() => null)) as
      | UpdateOrganizationStatusBody
      | null;

    if (!body || typeof body !== "object") {
      return jsonWrap(
        { ok: false, error: "INVALID_BODY" },
        { status: 400 },
      );
    }

    const { organizationId, newStatus } = body;

    if (
      organizationId === undefined ||
      organizationId === null ||
      newStatus === undefined ||
      typeof newStatus !== "string"
    ) {
      return jsonWrap(
        { ok: false, error: "MISSING_FIELDS" },
        { status: 400 },
      );
    }

    const normalizedStatus = newStatus.trim().toUpperCase() as AllowedStatus;

    if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
      return jsonWrap(
        { ok: false, error: "INVALID_STATUS" },
        { status: 400 },
      );
    }

    const organizationIdNumber =
      typeof organizationId === "string" ? Number(organizationId) : organizationId;

    if (
      typeof organizationIdNumber !== "number" ||
      Number.isNaN(organizationIdNumber) ||
      organizationIdNumber <= 0
    ) {
      return jsonWrap(
        { ok: false, error: "INVALID_ORGANIZATION_ID" },
        { status: 400 },
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationIdNumber },
      select: {
        id: true,
        status: true,
        publicName: true,
      },
    });

    if (!organization) {
      return jsonWrap(
        { ok: false, error: "ORGANIZATION_NOT_FOUND" },
        { status: 404 },
      );
    }

    // Se o estado já está igual, devolvemos ok mas sem fazer update
    if (organization.status === normalizedStatus) {
      return jsonWrap(
        {
          ok: true,
          organization: {
            id: organization.id,
            status: organization.status,
            publicName: organization.publicName,
            changed: false,
          },
        },
        { status: 200 },
      );
    }

    const { updated } = await prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: organizationIdNumber },
        data: {
          status: normalizedStatus,
        },
        select: {
          id: true,
          status: true,
          publicName: true,
        },
      });

      const eventLogId = crypto.randomUUID();
      await appendEventLog(
        {
          eventId: eventLogId,
          organizationId: updated.id,
          eventType: "organization.status.updated",
          idempotencyKey: `organization.status.updated:${updated.id}:${updated.status}`,
          actorUserId: admin.userId,
          correlationId: String(updated.id),
          payload: {
            organizationId: updated.id,
            fromStatus: organization.status,
            toStatus: updated.status,
          },
        },
        tx,
      );

      await recordSearchIndexOrgStatusOutbox(
        {
          eventLogId,
          organizationId: updated.id,
          status: updated.status,
        },
        tx,
      );

      await recordOrganizationAudit(tx, {
        organizationId: updated.id,
        actorUserId: admin.userId,
        action: "admin_organization_status_change",
        metadata: {
          fromStatus: organization.status,
          toStatus: updated.status,
        },
        ip,
        userAgent,
      });

      return { updated };
    });

    // Se aprovado (ACTIVE), adicionar role organization ao profile
    const ownerUserIds =
      normalizedStatus === "ACTIVE"
        ? await listEffectiveOrganizationMemberUserIdsByRoles({
            organizationId: updated.id,
            roles: ["OWNER", "CO_OWNER"],
          })
        : [];
    if (ownerUserIds.length > 0) {
      for (const ownerUserId of ownerUserIds) {
        const profile = await prisma.profile.findUnique({
          where: { id: ownerUserId },
          select: { roles: true },
        });
        const roles = Array.isArray(profile?.roles) ? profile?.roles : [];
        if (!roles.includes("organization")) {
          await prisma.profile.update({
            where: { id: ownerUserId },
            data: { roles: [...roles, "organization"] },
          });
        }
      }
    }

    await auditAdminAction({
      action: "ORGANIZATION_STATUS_UPDATE",
      actorUserId: admin.userId,
      payload: {
        organizationId: updated.id,
        publicName: updated.publicName,
        fromStatus: organization.status,
        toStatus: updated.status,
        ownerUserIds,
      },
    });

    return jsonWrap(
      {
        ok: true,
        organization: {
          id: updated.id,
          status: updated.status,
          publicName: updated.publicName,
          changed: true,
          ownerUserIds,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    logError("admin.organizacoes.update_status_failed", error);
    return jsonWrap(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
export const POST = withApiEnvelope(_POST);
