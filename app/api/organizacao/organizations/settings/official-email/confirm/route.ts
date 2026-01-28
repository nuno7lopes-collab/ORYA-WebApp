import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { OrganizationMemberRole } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const STATUS_PENDING = "PENDING";

async function _POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token.trim() : null;
    if (!token) {
      return jsonWrap({ ok: false, error: "INVALID_TOKEN" }, { status: 400 });
    }

    const request = await prisma.organizationOfficialEmailRequest.findUnique({
      where: { token },
    });
    if (!request) {
      return jsonWrap({ ok: false, error: "REQUEST_NOT_FOUND" }, { status: 404 });
    }
    if (request.status !== STATUS_PENDING) {
      return jsonWrap({ ok: false, error: "REQUEST_NOT_PENDING" }, { status: 400 });
    }

    const membership = await resolveGroupMemberForOrg({ organizationId: request.organizationId, userId: user.id });
    if (!membership || membership.role !== OrganizationMemberRole.OWNER) {
      return jsonWrap({ ok: false, error: "ONLY_OWNER_CAN_CONFIRM" }, { status: 403 });
    }

    const now = new Date();
    if (request.expiresAt && request.expiresAt.getTime() < now.getTime()) {
      await prisma.organizationOfficialEmailRequest.update({
        where: { id: request.id },
        data: { status: "EXPIRED", cancelledAt: now },
      });
      return jsonWrap({ ok: false, error: "REQUEST_EXPIRED" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null;
    await prisma.$transaction(async (tx) => {
      await tx.organizationOfficialEmailRequest.update({
        where: { id: request.id },
        data: { status: "CONFIRMED", confirmedAt: now },
      });

      await tx.organizationOfficialEmailRequest.updateMany({
        where: { organizationId: request.organizationId, id: { not: request.id }, status: STATUS_PENDING },
        data: { status: "CANCELLED", cancelledAt: now },
      });

      await tx.organization.update({
        where: { id: request.organizationId },
        data: { officialEmail: request.newEmail, officialEmailVerifiedAt: now },
      });

      await recordOrganizationAudit(tx, {
        organizationId: request.organizationId,
        actorUserId: user.id,
        action: "OFFICIAL_EMAIL_CONFIRMED",
        metadata: { requestId: request.id, email: request.newEmail },
        ip,
        userAgent: req.headers.get("user-agent"),
      });
    });

    return jsonWrap(
      {
        ok: true,
        status: "VERIFIED",
        verifiedAt: now,
        email: request.newEmail,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[official-email/confirm][POST]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);