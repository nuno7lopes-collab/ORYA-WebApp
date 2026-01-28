import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { randomUUID } from "crypto";
import { OrganizationMemberRole } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { sendOfficialEmailVerificationEmail } from "@/lib/emailSender";
import { parseOrganizationId } from "@/lib/organizationId";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const DEFAULT_EXPIRATION_MS = 1000 * 60 * 60 * 24; // 24h
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
    const organizationId = parseOrganizationId(body?.organizationId);
    const emailRaw = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
    if (!organizationId || !emailRaw) {
      return jsonWrap({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
    }
    if (!EMAIL_REGEX.test(emailRaw)) {
      return jsonWrap({ ok: false, error: "INVALID_EMAIL" }, { status: 400 });
    }

    const membership = await resolveGroupMemberForOrg({ organizationId, userId: user.id });
    if (!membership || membership.role !== OrganizationMemberRole.OWNER) {
      return jsonWrap({ ok: false, error: "ONLY_OWNER_CAN_UPDATE_OFFICIAL_EMAIL" }, { status: 403 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        officialEmail: true,
        officialEmailVerifiedAt: true,
        publicName: true,
        username: true,
      },
    });
    if (!organization) {
      return jsonWrap({ ok: false, error: "ORGANIZATION_NOT_FOUND" }, { status: 404 });
    }

    if (organization.officialEmailVerifiedAt && organization.officialEmail === emailRaw) {
      return jsonWrap(
        {
          ok: true,
          status: "VERIFIED",
          verifiedAt: organization.officialEmailVerifiedAt,
          email: organization.officialEmail,
        },
        { status: 200 },
      );
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: { officialEmail: emailRaw },
    });

    const now = Date.now();
    const expiresAt = new Date(now + DEFAULT_EXPIRATION_MS);
    const token = randomUUID();

    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null;
    const request = await prisma.$transaction(async (tx) => {
      await tx.organizationOfficialEmailRequest.updateMany({
        where: { organizationId, status: STATUS_PENDING },
        data: { status: "CANCELLED", cancelledAt: new Date(now) },
      });

      const created = await tx.organizationOfficialEmailRequest.create({
        data: {
          organizationId,
          requestedByUserId: user.id,
          newEmail: emailRaw,
          token,
          status: STATUS_PENDING,
          expiresAt,
        },
      });

      await tx.organization.update({
        where: { id: organizationId },
        data: { officialEmail: emailRaw, officialEmailVerifiedAt: null },
      });

      await recordOrganizationAudit(tx, {
        organizationId,
        actorUserId: user.id,
        action: "OFFICIAL_EMAIL_CHANGE_REQUESTED",
        metadata: { email: emailRaw, requestId: created.id },
        ip,
        userAgent: req.headers.get("user-agent"),
      });

      return created;
    });

    // Envia email de verificação (best-effort)
    try {
      const organizationName =
        organization.publicName || organization.username || "Organização ORYA";
      await sendOfficialEmailVerificationEmail({
        to: emailRaw,
        organizationName,
        token: request.token,
        pendingEmail: emailRaw,
        expiresAt: request.expiresAt,
      });
    } catch (emailErr) {
      console.error("[organization/official-email] Falha ao enviar email de verificação", emailErr);
    }

    return jsonWrap(
      {
        ok: true,
        status: request.status,
        expiresAt: request.expiresAt,
        pendingEmail: emailRaw,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organization/official-email][POST]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);