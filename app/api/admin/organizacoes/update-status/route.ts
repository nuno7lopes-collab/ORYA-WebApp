// app/api/admin/organizacoes/update-status/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { getClientIp } from "@/lib/auth/requestValidation";

// Tipos de estados permitidos para organizações (ajusta se o enum tiver outros valores)
const ALLOWED_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED"] as const;

type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

type UpdateOrganizationStatusBody = {
  organizationId?: number | string;
  newStatus?: string;
};

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
    }
    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent");

    const body = (await req.json().catch(() => null)) as
      | UpdateOrganizationStatusBody
      | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
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
      return NextResponse.json(
        { ok: false, error: "MISSING_FIELDS" },
        { status: 400 },
      );
    }

    const normalizedStatus = newStatus.trim().toUpperCase() as AllowedStatus;

    if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
      return NextResponse.json(
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
      return NextResponse.json(
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
      return NextResponse.json(
        { ok: false, error: "ORGANIZATION_NOT_FOUND" },
        { status: 404 },
      );
    }

    // Se o estado já está igual, devolvemos ok mas sem fazer update
    if (organization.status === normalizedStatus) {
      return NextResponse.json(
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

    const updated = await prisma.organization.update({
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

    await recordOrganizationAuditSafe({
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

    // Se aprovado (ACTIVE), adicionar role organization ao profile
    const ownerMembers =
      normalizedStatus === "ACTIVE"
        ? await prisma.organizationMember.findMany({
            where: { organizationId: updated.id, role: { in: ["OWNER", "CO_OWNER"] } },
            select: { userId: true },
          })
        : [];
    if (ownerMembers.length > 0) {
      for (const owner of ownerMembers) {
        const profile = await prisma.profile.findUnique({
          where: { id: owner.userId },
          select: { roles: true },
        });
        const roles = Array.isArray(profile?.roles) ? profile?.roles : [];
        if (!roles.includes("organization")) {
          await prisma.profile.update({
            where: { id: owner.userId },
            data: { roles: [...roles, "organization"] },
          });
        }
      }
    }

    return NextResponse.json(
      {
        ok: true,
        organization: {
          id: updated.id,
          status: updated.status,
          publicName: updated.publicName,
          changed: true,
          ownerUserIds: ownerMembers.map((member) => member.userId),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[ADMIN][ORGANIZADORES][UPDATE-STATUS]", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
