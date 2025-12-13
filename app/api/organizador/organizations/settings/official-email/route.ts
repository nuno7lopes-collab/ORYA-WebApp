import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { OrganizerEmailRequestStatus, OrganizerMemberRole } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { sendOfficialEmailVerificationEmail } from "@/lib/emailSender";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const DEFAULT_EXPIRATION_MS = 1000 * 60 * 60 * 24; // 24h

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
    const organizerId = Number(body?.organizerId);
    const emailRaw = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
    if (!organizerId || Number.isNaN(organizerId) || !emailRaw) {
      return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
    }
    if (!EMAIL_REGEX.test(emailRaw)) {
      return NextResponse.json({ ok: false, error: "INVALID_EMAIL" }, { status: 400 });
    }

    const membership = await prisma.organizerMember.findUnique({
      where: { organizerId_userId: { organizerId, userId: user.id } },
    });
    if (!membership || membership.role !== OrganizerMemberRole.OWNER) {
      return NextResponse.json({ ok: false, error: "ONLY_OWNER_CAN_UPDATE_OFFICIAL_EMAIL" }, { status: 403 });
    }

    const organizer = await prisma.organizer.findUnique({
      where: { id: organizerId },
      select: {
        id: true,
        officialEmail: true,
        officialEmailVerifiedAt: true,
        displayName: true,
        publicName: true,
        username: true,
      },
    });
    if (!organizer) {
      return NextResponse.json({ ok: false, error: "ORGANIZER_NOT_FOUND" }, { status: 404 });
    }
    if (organizer.officialEmailVerifiedAt && organizer.officialEmail === emailRaw) {
      return NextResponse.json({ ok: false, error: "EMAIL_ALREADY_VERIFIED" }, { status: 400 });
    }

    const now = Date.now();
    const expiresAt = new Date(now + DEFAULT_EXPIRATION_MS);
    const token = randomUUID();

    const request = await prisma.$transaction(async (tx) => {
      await tx.organizerOfficialEmailRequest.updateMany({
        where: { organizerId, status: OrganizerEmailRequestStatus.PENDING },
        data: { status: OrganizerEmailRequestStatus.CANCELLED, cancelledAt: new Date(now) },
      });

      const created = await tx.organizerOfficialEmailRequest.create({
        data: {
          organizerId,
          requestedByUserId: user.id,
          newEmail: emailRaw,
          token,
          status: OrganizerEmailRequestStatus.PENDING,
          expiresAt,
        },
      });

      await tx.organizer.update({
        where: { id: organizerId },
        data: { officialEmail: emailRaw, officialEmailVerifiedAt: null },
      });

      await recordOrganizationAudit(tx, {
        organizerId,
        actorUserId: user.id,
        action: "OFFICIAL_EMAIL_CHANGE_REQUESTED",
        metadata: { email: emailRaw, requestId: created.id },
        ip: req.ip ?? null,
        userAgent: req.headers.get("user-agent"),
      });

      return created;
    });

    // Envia email de verificação (best-effort)
    try {
      const organizerName =
        organizer.publicName || organizer.displayName || organizer.username || "Organização ORYA";
      await sendOfficialEmailVerificationEmail({
        to: emailRaw,
        organizerName,
        token: request.token,
        pendingEmail: emailRaw,
        expiresAt: request.expiresAt,
      });
    } catch (emailErr) {
      console.error("[organizer/official-email] Falha ao enviar email de verificação", emailErr);
    }

    return NextResponse.json(
      {
        ok: true,
        status: request.status,
        expiresAt: request.expiresAt,
        pendingEmail: emailRaw,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organizer/official-email][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
