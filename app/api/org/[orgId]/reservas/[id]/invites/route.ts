import { NextRequest } from "next/server";
import crypto from "crypto";
import { BookingInviteStatus, OrganizationMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { queueBookingInviteEmail } from "@/domain/notifications/email";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { getBookingState, isBookingConfirmed } from "@/lib/reservas/bookingState";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";

const MAX_INVITES = 20;
const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

function parseId(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}

function normalizeContact(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  return trimmed;
}

function generateToken(existing: Set<string>) {
  let token = "";
  do {
    token = crypto.randomBytes(16).toString("hex");
  } while (existing.has(token));
  existing.add(token);
  return token;
}

async function getOrganizationContext(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const user = await ensureAuthenticated(supabase);
  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { id: true } });
  if (!profile) {
    return { user: null, profile: null, organization: null, membership: null };
  }

  const organizationId = resolveOrganizationIdFromRequest(req);
  const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
    organizationId: organizationId ?? undefined,
    roles: [...ROLE_ALLOWLIST],
  });
  return { user, profile, organization, membership };
}

async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  const resolved = await params;
  const bookingId = parseId(resolved.id);
  if (!bookingId) {
    return fail(400, "Reserva inválida.");
  }

  try {
    const { profile, organization, membership } = await getOrganizationContext(req);
    if (!profile || !organization || !membership) {
      return fail(403, "Sem permissões.");
    }

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, organizationId: organization.id },
      select: { id: true },
    });
    if (!booking) {
      return fail(404, "Reserva não encontrada.");
    }

    const items = await prisma.bookingInvite.findMany({
      where: { bookingId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        token: true,
        targetName: true,
        targetContact: true,
        message: true,
        status: true,
        respondedAt: true,
        createdAt: true,
      },
    });

    return respondOk(ctx, { items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("GET /api/org/[orgId]/reservas/[id]/invites error:", err);
    return fail(500, "Erro ao carregar convites.");
  }
}

type NormalizedInvite = { contact: string; name: string; message: string };

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  const resolved = await params;
  const bookingId = parseId(resolved.id);
  if (!bookingId) {
    return fail(400, "Reserva inválida.");
  }

  try {
    const { user, profile, organization, membership } = await getOrganizationContext(req);
    if (!user || !profile || !organization || !membership) {
      return fail(403, "Sem permissões.");
    }

    const payload = await req.json().catch(() => ({}));
    const invitesPayload = Array.isArray(payload?.invites)
      ? payload.invites
      : payload?.contact
        ? [payload]
        : [];

    if (invitesPayload.length === 0) {
      return fail(400, "Sem convidados.");
    }
    if (invitesPayload.length > MAX_INVITES) {
      return fail(413, "Demasiados convidados.");
    }

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, organizationId: organization.id },
      select: { id: true, status: true, organizationId: true },
    });
    if (!booking) {
      return fail(404, "Reserva não encontrada.");
    }
    if (!isBookingConfirmed(booking)) {
      const bookingState = getBookingState(booking);
      if (!["PENDING", "PENDING_CONFIRMATION"].includes(bookingState ?? "")) {
        return fail(409, "Só podes convidar após confirmação.");
      }
    }

    const invites: NormalizedInvite[] = invitesPayload
      .map((invite: any): NormalizedInvite => {
        const contactRaw = typeof invite?.contact === "string" ? invite.contact : "";
        const contact = normalizeContact(contactRaw);
        const name = typeof invite?.name === "string" ? invite.name.trim() : "";
        const message = typeof invite?.message === "string" ? invite.message.trim() : "";
        return { contact, name, message };
      })
      .filter((invite) => invite.contact.length >= 3);

    if (invites.length === 0) {
      return fail(422, "Contactos inválidos.");
    }

    const contacts = Array.from(new Set(invites.map((invite) => invite.contact)));
    const existing = contacts.length
      ? await prisma.bookingInvite.findMany({
          where: { bookingId, targetContact: { in: contacts } },
          select: { targetContact: true },
        })
      : [];
    const existingSet = new Set(existing.map((item) => item.targetContact ?? ""));
    const filtered = invites.filter((invite) => !existingSet.has(invite.contact));

    if (filtered.length === 0) {
      return respondOk(ctx, { items: [] });
    }

    const tokens = new Set<string>();
    const data = filtered.map((invite) => ({
      bookingId,
      organizationId: booking.organizationId,
      invitedByUserId: user.id,
      token: generateToken(tokens),
      targetName: invite.name ? invite.name.slice(0, 120) : null,
      targetContact: invite.contact.slice(0, 180),
      message: invite.message ? invite.message.slice(0, 300) : null,
      status: BookingInviteStatus.PENDING,
    }));

    await prisma.bookingInvite.createMany({ data });

    const created = await prisma.bookingInvite.findMany({
      where: { bookingId, token: { in: Array.from(tokens) } },
      select: {
        id: true,
        token: true,
        targetName: true,
        targetContact: true,
        message: true,
        status: true,
        respondedAt: true,
        createdAt: true,
      },
    });

    const emailInvites = created.filter(
      (invite) => invite.targetContact && invite.targetContact.includes("@"),
    );
    if (emailInvites.length > 0) {
      try {
        const [bookingDetails, inviterProfile] = await Promise.all([
          prisma.booking.findUnique({
            where: { id: bookingId },
            select: {
              startsAt: true,
              snapshotTimezone: true,
              service: { select: { title: true } },
              organization: { select: { publicName: true, businessName: true } },
            },
          }),
          prisma.profile.findUnique({
            where: { id: user.id },
            select: { fullName: true, username: true },
          }),
        ]);

        if (bookingDetails?.startsAt) {
          const baseUrl = getAppBaseUrl().replace(/\/+$/, "");
          const serviceTitle = bookingDetails.service?.title || "Serviço";
          const organizationName =
            bookingDetails.organization?.publicName ||
            bookingDetails.organization?.businessName ||
            "Organização";
          const inviterName = inviterProfile?.fullName || inviterProfile?.username || null;
          const startsAt = bookingDetails.startsAt;
          const timeZone = bookingDetails.snapshotTimezone ?? null;

          await Promise.allSettled(
            emailInvites.map((invite) =>
              queueBookingInviteEmail({
                dedupeKey: `booking_invite:${invite.id}`,
                recipient: invite.targetContact ?? "",
                bookingId,
                organizationId: booking.organizationId,
                serviceTitle,
                organizationName,
                startsAt,
                timeZone,
                inviteUrl: `${baseUrl}/convites/${invite.token}`,
                inviterName,
                guestName: invite.targetName ?? null,
                message: invite.message ?? null,
              }),
            ),
          );
        }
      } catch (err) {
        console.warn("booking invite email enqueue failed", err);
      }
    }

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: booking.organizationId,
      actorUserId: user.id,
      action: "BOOKING_INVITES_CREATED",
      metadata: { bookingId, count: created.length, emailsQueued: emailInvites.length },
      ip,
      userAgent,
    });

    return respondOk(ctx, { items: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("POST /api/org/[orgId]/reservas/[id]/invites error:", err);
    return fail(500, "Erro ao criar convites.");
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
