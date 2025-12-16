import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { OrganizerMemberRole } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { resolveUserIdentifier } from "@/lib/userResolver";
import { getOrgTransferEnabled } from "@/lib/platformSettings";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { sendOwnerTransferEmail } from "@/lib/emailSender";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DEFAULT_EXPIRATION_MS = 1000 * 60 * 60 * 24 * 3; // 3 dias

export async function POST(req: NextRequest) {
  try {
    const ownerTransferModel = (prisma as any).organizerOwnerTransfer;
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
    const organizerId = Number(body?.organizerId);
    const targetRaw = typeof body?.targetUserId === "string" ? body.targetUserId.trim() : null;

    if (!organizerId || Number.isNaN(organizerId) || !targetRaw) {
      return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    const callerMembership = await prisma.organizerMember.findUnique({
      where: { organizerId_userId: { organizerId, userId: user.id } },
    });
    if (!callerMembership || callerMembership.role !== OrganizerMemberRole.OWNER) {
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

    const [organizer, actorProfile] = await Promise.all([
      prisma.organizer.findUnique({
        where: { id: organizerId },
        select: { displayName: true, username: true, publicName: true },
      }),
      prisma.profile.findUnique({
        where: { id: user.id },
        select: { fullName: true, username: true },
      }),
    ]);

    const transfer = await prisma.$transaction(async (tx) => {
      // Cancela pedidos pendentes anteriores
      await ownerTransferModel.updateMany({
        where: { organizerId, status: "PENDING" },
        data: { status: "CANCELLED", cancelledAt: new Date(now) },
      });

      const created = await ownerTransferModel.create({
        data: {
          organizerId,
          fromUserId: user.id,
          toUserId: targetUserId,
          status: "PENDING",
          token,
          expiresAt,
        },
      });

      await recordOrganizationAudit(tx, {
        organizerId,
        actorUserId: user.id,
        action: "OWNER_TRANSFER_REQUESTED",
        fromUserId: user.id,
        toUserId: targetUserId,
        metadata: { transferId: created.id, token },
        ip: req.ip ?? null,
        userAgent: req.headers.get("user-agent"),
      });

      return created;
    });

    // Envio do email de confirmação para o novo Owner (best-effort)
    try {
      const targetUser = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      const targetEmail = targetUser.data?.user?.email ?? null;
      const organizerName =
        organizer?.publicName || organizer?.displayName || organizer?.username || "Organização ORYA";
      const actorName = actorProfile?.fullName || actorProfile?.username || "OWNER atual";

      if (targetEmail) {
        await sendOwnerTransferEmail({
          to: targetEmail,
          organizerName,
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
    console.error("[organizer/owner/transfer][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
