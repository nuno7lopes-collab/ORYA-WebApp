import { NextRequest, NextResponse } from "next/server";
import { OrganizerMemberRole } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { getOrgTransferEnabled } from "@/lib/platformSettings";
import { setSoleOwner } from "@/lib/organizerRoles";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/resendClient";

export async function POST(req: NextRequest) {
  try {
    const ownerTransferModel = (prisma as any).organizerOwnerTransfer;
    if (!ownerTransferModel?.findUnique) {
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
    const token = typeof body?.token === "string" ? body.token.trim() : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: "INVALID_TOKEN" }, { status: 400 });
    }

    const transfer = await ownerTransferModel.findUnique({
      where: { token },
    });
    if (!transfer) {
      return NextResponse.json({ ok: false, error: "TRANSFER_NOT_FOUND" }, { status: 404 });
    }

    if (transfer.status !== "PENDING") {
      return NextResponse.json({ ok: false, error: "TRANSFER_NOT_PENDING" }, { status: 400 });
    }

    if (transfer.toUserId !== user.id) {
      return NextResponse.json({ ok: false, error: "TOKEN_USER_MISMATCH" }, { status: 403 });
    }

    const now = new Date();
    if (transfer.expiresAt && transfer.expiresAt.getTime() < now.getTime()) {
      await ownerTransferModel.update({
        where: { id: transfer.id },
        data: { status: "EXPIRED", cancelledAt: now },
      });
      return NextResponse.json({ ok: false, error: "TRANSFER_EXPIRED" }, { status: 400 });
    }

    const fromMembership = await prisma.organizerMember.findUnique({
      where: { organizerId_userId: { organizerId: transfer.organizerId, userId: transfer.fromUserId } },
    });
    if (!fromMembership || fromMembership.role !== OrganizerMemberRole.OWNER) {
      await ownerTransferModel.update({
        where: { id: transfer.id },
        data: { status: "CANCELLED", cancelledAt: now },
      });
      return NextResponse.json({ ok: false, error: "TRANSFER_NO_LONGER_VALID" }, { status: 400 });
    }

    const [organizer, fromProfile, toProfile] = await Promise.all([
      prisma.organizer.findUnique({
        where: { id: transfer.organizerId },
        select: { publicName: true, username: true },
      }),
      prisma.profile.findUnique({
        where: { id: transfer.fromUserId },
        select: { fullName: true, username: true },
      }),
      prisma.profile.findUnique({
        where: { id: transfer.toUserId },
        select: { fullName: true, username: true },
      }),
    ]);

    await prisma.$transaction(async (tx) => {
      await ownerTransferModel.update({
        where: { id: transfer.id },
        data: { status: "CONFIRMED", confirmedAt: now },
      });

      await setSoleOwner(tx, transfer.organizerId, transfer.toUserId, transfer.fromUserId);

      await recordOrganizationAudit(tx, {
        organizerId: transfer.organizerId,
        actorUserId: user.id,
        action: "OWNER_TRANSFER_CONFIRMED",
        fromUserId: transfer.fromUserId,
        toUserId: transfer.toUserId,
        metadata: { transferId: transfer.id, token: transfer.token },
        ip: req.ip ?? null,
        userAgent: req.headers.get("user-agent"),
      });
    });

    // Notificar o antigo OWNER (best-effort)
    const organizerName = organizer?.publicName || organizer?.username || "Organização ORYA";
    const toName = toProfile?.fullName || toProfile?.username || "novo OWNER";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://orya.pt";
    try {
      const fromUser = await supabaseAdmin.auth.admin.getUserById(transfer.fromUserId);
      const fromEmail = fromUser.data?.user?.email ?? null;
      if (fromEmail) {
        await sendEmail({
          to: fromEmail,
          subject: `✅ Transferência concluída – ${organizerName}`,
          html: `<div style="font-family: Arial, sans-serif; color:#0f172a;">
            <h2>Transferência de OWNER concluída</h2>
            <p>O papel de OWNER em <strong>${organizerName}</strong> foi assumido por <strong>${toName}</strong>.</p>
            <p>Podes rever o staff aqui: <a href="${baseUrl}/organizador?tab=manage&section=staff" style="color:#2563eb;">Ver staff</a></p>
          </div>`,
          text: `Transferência de OWNER concluída\n${organizerName}\nNovo OWNER: ${toName}\nStaff: ${baseUrl}/organizador?tab=manage&section=staff`,
        });
      } else {
        console.warn("[owner/confirm] fromUser sem email para notificar", { fromUserId: transfer.fromUserId });
      }
    } catch (emailErr) {
      console.error("[owner/confirm] Falha ao notificar antigo OWNER", emailErr);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[organizer/owner/confirm][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
