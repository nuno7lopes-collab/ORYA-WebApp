import { NextRequest, NextResponse } from "next/server";
import { OrganizerMemberRole } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { recordOrganizationAudit } from "@/lib/organizationAudit";

const STATUS_PENDING = "PENDING";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token.trim() : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: "INVALID_TOKEN" }, { status: 400 });
    }

    const request = await prisma.organizerOfficialEmailRequest.findUnique({
      where: { token },
    });
    if (!request) {
      return NextResponse.json({ ok: false, error: "REQUEST_NOT_FOUND" }, { status: 404 });
    }
    if (request.status !== STATUS_PENDING) {
      return NextResponse.json({ ok: false, error: "REQUEST_NOT_PENDING" }, { status: 400 });
    }

    const membership = await prisma.organizerMember.findUnique({
      where: { organizerId_userId: { organizerId: request.organizerId, userId: user.id } },
    });
    if (!membership || membership.role !== OrganizerMemberRole.OWNER) {
      return NextResponse.json({ ok: false, error: "ONLY_OWNER_CAN_CONFIRM" }, { status: 403 });
    }

    const now = new Date();
    if (request.expiresAt && request.expiresAt.getTime() < now.getTime()) {
      await prisma.organizerOfficialEmailRequest.update({
        where: { id: request.id },
        data: { status: "EXPIRED", cancelledAt: now },
      });
      return NextResponse.json({ ok: false, error: "REQUEST_EXPIRED" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null;
    await prisma.$transaction(async (tx) => {
      await tx.organizerOfficialEmailRequest.update({
        where: { id: request.id },
        data: { status: "CONFIRMED", confirmedAt: now },
      });

      await tx.organizerOfficialEmailRequest.updateMany({
        where: { organizerId: request.organizerId, id: { not: request.id }, status: STATUS_PENDING },
        data: { status: "CANCELLED", cancelledAt: now },
      });

      await tx.organizer.update({
        where: { id: request.organizerId },
        data: { officialEmail: request.newEmail, officialEmailVerifiedAt: now },
      });

      await recordOrganizationAudit(tx, {
        organizerId: request.organizerId,
        actorUserId: user.id,
        action: "OFFICIAL_EMAIL_CONFIRMED",
        metadata: { requestId: request.id, email: request.newEmail },
        ip,
        userAgent: req.headers.get("user-agent"),
      });
    });

    return NextResponse.json({ ok: true, verifiedAt: now }, { status: 200 });
  } catch (err) {
    console.error("[official-email/confirm][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
