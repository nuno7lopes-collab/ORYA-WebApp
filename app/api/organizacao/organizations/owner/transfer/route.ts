import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { OrganizationMemberRole } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { resolveUserIdentifier } from "@/lib/userResolver";
import { getOrgTransferEnabled } from "@/lib/platformSettings";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { sendOwnerTransferEmail } from "@/lib/emailSender";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseOrganizationId } from "@/lib/organizationId";

const DEFAULT_EXPIRATION_MS = 1000 * 60 * 60 * 24 * 3; // 3 dias

export async function POST(req: NextRequest) {
  try {
    const ownerTransferModel = (prisma as any).organizationOwnerTransfer;
    if (!ownerTransferModel?.create) {
      return NextResponse.json({ ok: false, error: "OWNER_TRANSFER_UNAVAILABLE" }, { status: 501 });
    }

    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const transferEnabled = await getOrgTransferEnabled();
    if (!transferEnabled) {
      return NextResponse.json({ ok: false, error: "ORG_TRANSFER_DISABLED" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const organizationId = parseOrganizationId(body?.organizationId);
    const targetRaw = typeof body?.targetUserId === "string" ? body.targetUserId.trim() : null;

    if (!organizationId || !targetRaw) {
      return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    const callerMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });
    if (!callerMembership || callerMembership.role !== OrganizationMemberRole.OWNER) {
      return NextResponse.json({ ok: false, error: "ONLY_OWNER_CAN_TRANSFER" }, { status: 403 });
    }

    const resolved = await resolveUserIdentifier(targetRaw);
    const targetUserId = resolved?.userId ?? null;
    if (!targetUserId) {
      return NextResponse.json({ ok: false, error: "TARGET_NOT_FOUND" }, { status: 404 });
    }
    if (targetUserId === user.id) {
      return NextResponse.json({ ok: false, error: "CANNOT_TRANSFER_TO_SELF" }, { status: 400 });
    }

    const now = Date.now();
    const expiresAt = new Date(now + DEFAULT_EXPIRATION_MS);
    const token = randomUUID();

    const [organization, actorProfile] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { publicName: true, username: true },
      }),
      prisma.profile.findUnique({
        where: { id: user.id },
        select: { fullName: true, username: true },
      }),
    ]);

    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null;
    const transfer = await prisma.$transaction(async (tx) => {
      // Cancela pedidos pendentes anteriores
      await ownerTransferModel.updateMany({
        where: { organizationId, status: "PENDING" },
        data: { status: "CANCELLED", cancelledAt: new Date(now) },
      });

      const created = await ownerTransferModel.create({
        data: {
          organizationId,
          fromUserId: user.id,
          toUserId: targetUserId,
          status: "PENDING",
          token,
          expiresAt,
        },
      });

      await recordOrganizationAudit(tx, {
        organizationId,
        actorUserId: user.id,
        action: "OWNER_TRANSFER_REQUESTED",
        fromUserId: user.id,
        toUserId: targetUserId,
        metadata: { transferId: created.id, token },
        ip,
        userAgent: req.headers.get("user-agent"),
      });

      return created;
    });

    // Envio do email de confirmação para o novo Owner (best-effort)
    try {
      const targetUser = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      const targetEmail = targetUser.data?.user?.email ?? null;
      const organizationName =
        organization?.publicName || organization?.username || "Organização ORYA";
      const actorName = actorProfile?.fullName || actorProfile?.username || "OWNER atual";

      if (targetEmail) {
        await sendOwnerTransferEmail({
          to: targetEmail,
          organizationName,
          actorName,
          token: transfer.token,
          expiresAt: transfer.expiresAt,
        });
      } else {
        console.warn("[owner/transfer] target user sem email para envio", { targetUserId });
      }
    } catch (emailErr) {
      console.error("[owner/transfer] Falha ao enviar email de transferência", emailErr);
    }

    return NextResponse.json(
      {
        ok: true,
        transfer: {
          id: transfer.id,
          status: transfer.status,
          token: transfer.token,
          expiresAt: transfer.expiresAt,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organization/owner/transfer][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
