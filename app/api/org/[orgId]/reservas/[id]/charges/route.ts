import { NextRequest } from "next/server";
import crypto from "crypto";
import { BookingChargeStatus, BookingChargeKind, BookingChargePayerKind, OrganizationMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { getAppBaseUrl } from "@/lib/appBaseUrl";

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

function parseAmountCents(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value !== "string") return null;
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
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
  const fail = (status: number, message: string, errorCode = "ERROR") =>
    respondError(ctx, { errorCode, message, retryable: status >= 500 }, { status });

  const resolved = await params;
  const bookingId = parseId(resolved.id);
  if (!bookingId) {
    return fail(400, "Reserva inválida.", "BOOKING_INVALID");
  }

  try {
    const { profile, organization, membership } = await getOrganizationContext(req);
    if (!profile || !organization || !membership) {
      return fail(403, "Sem permissões.", "FORBIDDEN");
    }

    const reservasAccess = await ensureReservasModuleAccess(organization, undefined, {
      requireVerifiedEmail: true,
    });
    if (!reservasAccess.ok) {
      const reservasMessage =
        "message" in reservasAccess && typeof reservasAccess.message === "string"
          ? reservasAccess.message
          : reservasAccess.error ?? "Sem permissões.";
      return fail(403, reservasMessage, reservasAccess.error ?? "FORBIDDEN");
    }

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, organizationId: organization.id },
      select: { id: true },
    });
    if (!booking) {
      return fail(404, "Reserva não encontrada.", "BOOKING_NOT_FOUND");
    }

    const charges = await prisma.bookingCharge.findMany({
      where: { bookingId, organizationId: organization.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        status: true,
        kind: true,
        payerKind: true,
        label: true,
        amountCents: true,
        currency: true,
        token: true,
        paymentIntentId: true,
        paymentId: true,
        paidAt: true,
        createdAt: true,
      },
    });

    const baseUrl = getAppBaseUrl();
    const items = charges.map((charge) => ({
      ...charge,
      paymentUrl: `${baseUrl}/cobrancas/${charge.token}`,
    }));

    return respondOk(ctx, { charges: items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.", "UNAUTHENTICATED");
    }
    console.error("GET /api/org/[orgId]/reservas/[id]/charges error:", err);
    return fail(500, "Erro ao carregar cobranças.", "CHARGES_LOAD_FAILED");
  }
}

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const ctx = getRequestContext(req);
  const fail = (status: number, message: string, errorCode = "ERROR") =>
    respondError(ctx, { errorCode, message, retryable: status >= 500 }, { status });

  const resolved = await params;
  const bookingId = parseId(resolved.id);
  if (!bookingId) {
    return fail(400, "Reserva inválida.", "BOOKING_INVALID");
  }

  try {
    const { profile, organization, membership } = await getOrganizationContext(req);
    if (!profile || !organization || !membership) {
      return fail(403, "Sem permissões.", "FORBIDDEN");
    }

    const reservasAccess = await ensureReservasModuleAccess(organization, undefined, {
      requireVerifiedEmail: true,
    });
    if (!reservasAccess.ok) {
      const reservasMessage =
        "message" in reservasAccess && typeof reservasAccess.message === "string"
          ? reservasAccess.message
          : reservasAccess.error ?? "Sem permissões.";
      return fail(403, reservasMessage, reservasAccess.error ?? "FORBIDDEN");
    }

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, organizationId: organization.id },
      select: {
        id: true,
        status: true,
        currency: true,
      },
    });
    if (!booking) {
      return fail(404, "Reserva não encontrada.", "BOOKING_NOT_FOUND");
    }
    if (["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG"].includes(booking.status)) {
      return fail(409, "Reserva cancelada.", "BOOKING_CANCELLED");
    }

    const payload = await req.json().catch(() => ({}));
    const label = typeof payload?.label === "string" ? payload.label.trim().slice(0, 140) : "";
    const rawAmount = payload?.amountCents ?? payload?.amount ?? null;
    const amountCents = parseAmountCents(rawAmount);
    if (!amountCents || amountCents <= 0) {
      return fail(422, "Valor inválido.", "AMOUNT_INVALID");
    }

    const kindRaw = typeof payload?.kind === "string" ? payload.kind.toUpperCase() : "EXTRA";
    const payerRaw = typeof payload?.payerKind === "string" ? payload.payerKind.toUpperCase() : "ORGANIZER";
    const kind = (Object.values(BookingChargeKind).includes(kindRaw as BookingChargeKind)
      ? (kindRaw as BookingChargeKind)
      : BookingChargeKind.EXTRA);
    const payerKind = (Object.values(BookingChargePayerKind).includes(payerRaw as BookingChargePayerKind)
      ? (payerRaw as BookingChargePayerKind)
      : BookingChargePayerKind.ORGANIZER);

    const token = crypto.randomBytes(16).toString("hex");
    const { ip, userAgent } = getRequestMeta(req);

    const charge = await prisma.bookingCharge.create({
      data: {
        bookingId: booking.id,
        organizationId: organization.id,
        createdByUserId: profile.id,
        token,
        kind,
        payerKind,
        status: BookingChargeStatus.OPEN,
        label: label || null,
        amountCents,
        currency: booking.currency ?? "EUR",
      },
      select: {
        id: true,
        status: true,
        kind: true,
        payerKind: true,
        label: true,
        amountCents: true,
        currency: true,
        token: true,
        paymentIntentId: true,
        paymentId: true,
        paidAt: true,
        createdAt: true,
      },
    });

    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "BOOKING_CHARGE_CREATED",
      metadata: {
        bookingId: booking.id,
        chargeId: charge.id,
        amountCents,
        currency: charge.currency,
        kind,
        payerKind,
      },
      ip,
      userAgent,
    });

    const baseUrl = getAppBaseUrl();
    return respondOk(ctx, {
      charge: {
        ...charge,
        paymentUrl: `${baseUrl}/cobrancas/${charge.token}`,
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.", "UNAUTHENTICATED");
    }
    console.error("POST /api/org/[orgId]/reservas/[id]/charges error:", err);
    return fail(500, "Erro ao criar cobrança.", "CHARGE_CREATE_FAILED");
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
