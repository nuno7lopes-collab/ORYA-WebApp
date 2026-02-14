import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { OrganizationMemberRole } from "@prisma/client";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getBookingState } from "@/lib/reservas/bookingState";
import { ensureBookingPendingExpiry } from "@/domain/bookings/commands";
import { computePricing } from "@/lib/pricing";
import { computeCombinedFees } from "@/lib/fees";
import { getPlatformFees } from "@/lib/platformSettings";
import { normalizeSplitParticipants, type SplitParticipantInput, type SplitPricingMode, type SplitDynamicMode } from "@/lib/reservas/bookingSplit";

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

function fail(
  ctx: { requestId: string; correlationId: string },
  status: number,
  errorCode: string,
  message: string,
) {
  return respondError(ctx, { errorCode, message, retryable: status >= 500 }, { status });
}

function parsePricingMode(value: unknown): SplitPricingMode {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  return raw === "DYNAMIC" ? "DYNAMIC" : "FIXED";
}

function parseDynamicMode(value: unknown): SplitDynamicMode | null {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (raw === "PERCENT") return "PERCENT";
  if (raw === "AMOUNT") return "AMOUNT";
  return null;
}

function toInt(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const resolved = await params;
  const bookingId = parseId(resolved.id);
  if (!bookingId) {
    return fail(ctx, 400, "BAD_REQUEST", "Reserva inválida.");
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { id: true } });
    if (!profile) {
      return fail(ctx, 403, "PROFILE_NOT_FOUND", "Perfil não encontrado.");
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });
    if (!organization || !membership) {
      return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
    }

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, organizationId: organization.id },
      select: {
        id: true,
        price: true,
        currency: true,
        splitPayment: {
          select: {
            id: true,
            status: true,
            pricingMode: true,
            currency: true,
            totalCents: true,
            shareCents: true,
            deadlineAt: true,
            createdAt: true,
            updatedAt: true,
            participants: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                inviteId: true,
                userId: true,
                name: true,
                contact: true,
                baseShareCents: true,
                shareCents: true,
                platformFeeCents: true,
                status: true,
                paymentIntentId: true,
                paidAt: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!booking) {
      return fail(ctx, 404, "NOT_FOUND", "Reserva não encontrada.");
    }

    const split = booking.splitPayment ?? null;
    if (!split) {
      return respondOk(ctx, { split: null });
    }

    const paidCents = split.participants
      .filter((p) => p.status === "PAID")
      .reduce((acc, item) => acc + Math.max(0, item.shareCents ?? 0), 0);

    return respondOk(ctx, {
      split: {
        ...split,
        paidCents,
        baseTotalCents: booking.price ?? 0,
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("GET /api/org/[orgId]/reservas/[id]/split error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao carregar split.");
  }
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const resolved = await params;
  const bookingId = parseId(resolved.id);
  if (!bookingId) {
    return fail(ctx, 400, "BAD_REQUEST", "Reserva inválida.");
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { id: true } });
    if (!profile) {
      return fail(ctx, 403, "PROFILE_NOT_FOUND", "Perfil não encontrado.");
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });
    if (!organization || !membership) {
      return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
    }

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, organizationId: organization.id },
      select: {
        id: true,
        status: true,
        price: true,
        currency: true,
        pendingExpiresAt: true,
        startsAt: true,
        organizationId: true,
        organization: {
          select: {
            feeMode: true,
            platformFeeBps: true,
            platformFeeFixedCents: true,
            orgType: true,
          },
        },
      },
    });

    if (!booking) {
      return fail(ctx, 404, "NOT_FOUND", "Reserva não encontrada.");
    }
    const bookingState = getBookingState(booking);
    if (["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "COMPLETED", "NO_SHOW", "DISPUTED"].includes(bookingState ?? "")) {
      return fail(ctx, 409, "BOOKING_INACTIVE", "Reserva inativa.");
    }
    if (!booking.price || booking.price <= 0) {
      return fail(ctx, 409, "INVALID_PRICE", "Reserva sem valor válido.");
    }

    const payload = await req.json().catch(() => ({}));
    const pricingMode = parsePricingMode(payload?.pricingMode);
    const dynamicMode = parseDynamicMode(payload?.dynamicMode);
    const rawParticipants = Array.isArray(payload?.participants) ? payload.participants : [];
    const participantsInput: SplitParticipantInput[] = rawParticipants.map((item: any) => ({
      inviteId: Number.isFinite(Number(item?.inviteId)) ? Number(item.inviteId) : null,
      userId: typeof item?.userId === "string" ? item.userId : null,
      name: typeof item?.name === "string" ? item.name.trim() : null,
      contact: typeof item?.contact === "string" ? item.contact.trim() : null,
      shareCents: toInt(item?.shareCents ?? item?.amountCents),
      sharePercentBps: toInt(item?.sharePercentBps ?? item?.percentBps),
    }));

    const seenInviteIds = new Set<number>();
    for (const item of participantsInput) {
      if (item.inviteId && seenInviteIds.has(item.inviteId)) {
        return fail(ctx, 422, "INVITE_DUPLICATE", "Convite duplicado.");
      }
      if (item.inviteId) {
        seenInviteIds.add(item.inviteId);
      }
    }

    const normalized = normalizeSplitParticipants({
      totalBaseCents: booking.price ?? 0,
      pricingMode,
      dynamicMode,
      participants: participantsInput,
    });
    if (!normalized.ok) {
      return fail(ctx, 422, normalized.error, "Participantes inválidos.");
    }

    const inviteIds = participantsInput.map((item) => item.inviteId).filter(Boolean) as number[];
    const invites = inviteIds.length
      ? await prisma.bookingInvite.findMany({
          where: { id: { in: inviteIds }, bookingId },
          select: { id: true, targetName: true, targetContact: true },
        })
      : [];
    if (inviteIds.length && invites.length !== new Set(inviteIds).size) {
      return fail(ctx, 422, "INVITE_INVALID", "Convite inválido.");
    }
    const inviteMap = new Map(invites.map((invite) => [invite.id, invite]));

    const { feeBps: defaultFeeBps, feeFixedCents: defaultFeeFixed } = await getPlatformFees();
    const isPlatformOrg = booking.organization?.orgType === "PLATFORM";

    const computed = normalized.participants.map((participant) => {
      const pricing = computePricing(participant.baseShareCents, 0, {
        platformDefaultFeeMode: "INCLUDED",
        organizationPlatformFeeBps: booking.organization?.platformFeeBps ?? undefined,
        organizationPlatformFeeFixedCents: booking.organization?.platformFeeFixedCents ?? undefined,
        platformDefaultFeeBps: defaultFeeBps,
        platformDefaultFeeFixedCents: defaultFeeFixed,
        isPlatformOrg,
      });
      const combined = computeCombinedFees({
        amountCents: participant.baseShareCents,
        discountCents: 0,
        feeMode: pricing.feeMode,
        platformFeeBps: pricing.feeBpsApplied,
        platformFeeFixedCents: pricing.feeFixedApplied,
        stripeFeeBps: 0,
        stripeFeeFixedCents: 0,
      });

      const invite = participant.inviteId ? inviteMap.get(participant.inviteId) : null;
      const name = participant.name || invite?.targetName || null;
      const contact = participant.contact || invite?.targetContact || null;

      return {
        ...participant,
        name,
        contact,
        shareCents: combined.totalCents,
        platformFeeCents: pricing.platformFeeCents,
      };
    });

    const totalCents = computed.reduce((acc, item) => acc + Math.max(0, item.shareCents), 0);
    const fixedShareCents = pricingMode === "FIXED" ? computed[0]?.shareCents ?? null : null;
    const deadlineAt = typeof payload?.deadlineAt === "string" ? new Date(payload.deadlineAt) : null;
    const deadlineResolved = deadlineAt && !Number.isNaN(deadlineAt.getTime()) ? deadlineAt : null;

    const existing = await prisma.bookingSplit.findUnique({
      where: { bookingId },
      include: { participants: { select: { id: true, status: true } } },
    });
    if (existing?.participants?.some((item) => item.status === "PAID")) {
      return fail(ctx, 409, "SPLIT_LOCKED", "Já existem pagamentos concluídos.");
    }

    const split = await prisma.$transaction(async (tx) => {
      const split = existing
        ? await tx.bookingSplit.update({
            where: { id: existing.id },
            data: {
              pricingMode,
              status: "OPEN",
              currency: booking.currency ?? "EUR",
              totalCents,
              shareCents: fixedShareCents,
              deadlineAt: deadlineResolved ?? undefined,
              createdByUserId: profile.id,
            },
            select: { id: true },
          })
        : await tx.bookingSplit.create({
            data: {
              bookingId,
              organizationId: booking.organizationId,
              createdByUserId: profile.id,
              pricingMode,
              status: "OPEN",
              currency: booking.currency ?? "EUR",
              totalCents,
              shareCents: fixedShareCents,
              deadlineAt: deadlineResolved ?? undefined,
            },
            select: { id: true },
          });

      await tx.bookingSplitParticipant.deleteMany({
        where: { splitId: split.id },
      });

      await tx.bookingSplitParticipant.createMany({
        data: computed.map((item) => ({
          splitId: split.id,
          inviteId: item.inviteId ?? null,
          userId: item.userId ?? null,
          name: item.name ?? null,
          contact: item.contact ?? null,
          baseShareCents: Math.max(0, item.baseShareCents),
          shareCents: Math.max(0, item.shareCents),
          platformFeeCents: Math.max(0, item.platformFeeCents),
          status: "PENDING",
        })),
      });

      const bookingState = getBookingState(booking);
      if (deadlineResolved && ["PENDING_CONFIRMATION", "PENDING"].includes(bookingState ?? "")) {
        await ensureBookingPendingExpiry({
          tx,
          bookingId,
          pendingExpiresAt: booking.pendingExpiresAt ?? null,
          deadlineAt: deadlineResolved,
        });
      }

      return split;
    });

    return respondOk(ctx, {
      split: {
        id: split.id,
        pricingMode,
        totalCents,
        shareCents: fixedShareCents,
        deadlineAt: deadlineResolved,
        currency: booking.currency ?? "EUR",
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("POST /api/org/[orgId]/reservas/[id]/split error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao configurar split.");
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
