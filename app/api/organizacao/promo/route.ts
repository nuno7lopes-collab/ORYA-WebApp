import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { OrganizationModule } from "@prisma/client";
import crypto from "crypto";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const resolveOrganizationId = (req: NextRequest) => {
  const organizationId = resolveOrganizationIdFromRequest(req);
  return { organizationId };
};

type AutoPromoCodeInput = {
  organizationId: number;
  eventId: number | null;
  type: "PERCENTAGE" | "FIXED";
  value: number;
  maxUses: number | null;
  perUserLimit: number | null;
  validFrom: Date | null;
  validUntil: Date | null;
  minQuantity: number | null;
  minTotalCents: number | null;
  promoterUserId: string | null;
  active: boolean;
  autoApply: boolean;
};

const buildAutoPromoCode = (input: AutoPromoCodeInput) => {
  const iso = (d: Date | null) => (d ? d.toISOString() : "");
  const seed = [
    input.organizationId,
    input.eventId ?? "",
    input.type,
    input.value,
    input.maxUses ?? "",
    input.perUserLimit ?? "",
    iso(input.validFrom),
    iso(input.validUntil),
    input.minQuantity ?? "",
    input.minTotalCents ?? "",
    input.promoterUserId ?? "",
    input.active ? "1" : "0",
    input.autoApply ? "1" : "0",
  ].join("|");
  const hash = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 8).toUpperCase();
  return `AUTO-${hash}`;
};

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}

function fail(
  ctx: ReturnType<typeof getRequestContext>,
  status: number,
  message: string,
  errorCode = errorCodeForStatus(status),
  retryable = status >= 500,
  details?: Record<string, unknown>,
) {
  const resolvedMessage = typeof message === "string" ? message : String(message);
  const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
  return respondError(
    ctx,
    { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) },
    { status },
  );
}

async function requireOrganization(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: "UNAUTHENTICATED" as const };
  }

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile) return { error: "PROFILE_NOT_FOUND" as const };

  const { organizationId } = resolveOrganizationId(req);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: organizationId ?? undefined,
  });

  if (!membership || !organization) {
    return { error: "ORGANIZATION_NOT_FOUND" as const };
  }

  return { organization, profile, membership };
}

export async function GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const orgCtx = await requireOrganization(req);
    if ("error" in orgCtx) {
      const status =
        orgCtx.error === "UNAUTHENTICATED" ? 401 : orgCtx.error === "PROFILE_NOT_FOUND" ? 404 : 403;
      return fail(ctx, status, orgCtx.error ?? "FORBIDDEN");
    }
    const emailGate = ensureOrganizationEmailVerified(orgCtx.organization, { reasonCode: "PROMO" });
    if (!emailGate.ok) {
      const message =
        "message" in emailGate && typeof emailGate.message === "string"
          ? emailGate.message
          : emailGate.error ?? "Sem permissões.";
      return respondError(
        ctx,
        {
          errorCode: emailGate.error ?? "FORBIDDEN",
          message,
          retryable: false,
          details: emailGate,
        },
        { status: 403 },
      );
    }
    const access = await ensureMemberModuleAccess({
      organizationId: orgCtx.organization.id,
      userId: orgCtx.membership.userId,
      role: orgCtx.membership.role,
      rolePack: orgCtx.membership.rolePack,
      moduleKey: OrganizationModule.MARKETING,
      required: "VIEW",
    });
    if (!access.ok) {
      return fail(ctx, 403, "FORBIDDEN");
    }

    const promoRepo = (prisma as unknown as {
      promoCode?: {
        findMany: typeof prisma.promoCode.findMany;
      };
    }).promoCode;
    if (!promoRepo) {
      return fail(ctx, 500, "Promo codes indisponíveis nesta instância do Prisma.");
    }

    const isPromoter = orgCtx.membership.role === "PROMOTER";

    let organizationEvents: { id: number; title: string; slug: string }[] = [];
    let eventIds: number[] = [];

    if (!isPromoter) {
      organizationEvents = await prisma.event.findMany({
        where: { organizationId: orgCtx.organization.id },
        select: { id: true, title: true, slug: true },
      });
      eventIds = organizationEvents.map((e) => e.id);
    }

    const promoCodes = await prisma.promoCode.findMany({
      where: isPromoter
        ? { promoterUserId: orgCtx.profile.id }
        : {
            OR: [
              { organizationId: orgCtx.organization.id },
              ...(eventIds.length ? [{ eventId: { in: eventIds } }] : []),
            ],
          },
      orderBy: { createdAt: "desc" },
      include: {
        redemptions: true,
        promoter: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      },
    });

    if (isPromoter) {
      eventIds = promoCodes
        .map((promo) => promo.eventId)
        .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
      organizationEvents = await prisma.event.findMany({
        where: { organizationId: orgCtx.organization.id, ...(eventIds.length ? { id: { in: eventIds } } : {}) },
        select: { id: true, title: true, slug: true },
      });
    }

    const promoIds = promoCodes.map((p) => p.id);
    const promoCodesList = promoCodes.map((p) => p.code);

    const lines = await prisma.saleLine.findMany({
      where: {
        eventId: { in: eventIds },
        OR: [{ promoCodeId: { in: promoIds } }, { promoCodeSnapshot: { in: promoCodesList } }],
      },
      select: {
        promoCodeId: true,
        promoCodeSnapshot: true,
        quantity: true,
        grossCents: true,
        netCents: true,
        discountPerUnitCents: true,
        platformFeeCents: true,
      },
    });

    type PromoAgg = {
      tickets: number;
      grossCents: number;
      discountCents: number;
      platformFeeCents: number;
      netCents: number;
    };

    const statsMap = new Map<string | number, PromoAgg & { users: Set<string>; redemptions: number }>();
    const ensureAgg = (key: string | number) => {
      const existing = statsMap.get(key);
      if (existing) return existing;
      const base: PromoAgg & { users: Set<string>; redemptions: number } = {
        tickets: 0,
        grossCents: 0,
        discountCents: 0,
        platformFeeCents: 0,
        netCents: 0,
        users: new Set(),
        redemptions: 0,
      };
      statsMap.set(key, base);
      return base;
    };

    for (const l of lines) {
      const key = l.promoCodeId ?? l.promoCodeSnapshot ?? "unknown";
      const agg = ensureAgg(key);
      const qty = l.quantity ?? 0;
      const discountLine = (l.discountPerUnitCents ?? 0) * qty;
      agg.tickets += qty;
      agg.grossCents += l.grossCents ?? 0;
      agg.discountCents += discountLine;
      agg.platformFeeCents += l.platformFeeCents ?? 0;
      agg.netCents += l.netCents ?? 0;
    }

    promoCodes.forEach((p) => {
      const agg = ensureAgg(p.id);
      agg.redemptions += p.redemptions.length;
      p.redemptions.forEach((r) => {
        if (r.userId) agg.users.add(r.userId);
        else if (r.guestEmail) agg.users.add(r.guestEmail.toLowerCase());
      });
    });

    return respondOk(ctx, {
      viewerRole: orgCtx.membership.role,
      promoCodes: promoCodes.map((p) => ({
        ...p,
        promoterUserId: p.promoterUserId ?? null,
        promoter: p.promoter ?? null,
        status:
          !p.active
            ? "INACTIVE"
            : p.validUntil && new Date(p.validUntil) < new Date()
              ? "EXPIRED"
              : "ACTIVE",
        redemptionsCount: statsMap.get(p.id)?.tickets ?? p.redemptions.length,
      })),
      events: organizationEvents,
      promoStats: promoCodes.map((p) => {
        const agg =
          statsMap.get(p.id) ??
          statsMap.get(p.code) ?? {
            tickets: 0,
            grossCents: 0,
            discountCents: 0,
            platformFeeCents: 0,
            netCents: 0,
            users: new Set<string>(),
            redemptions: 0,
          };
        return {
          promoCodeId: p.id,
          tickets: agg.tickets,
          grossCents: agg.grossCents,
          discountCents: agg.discountCents,
          platformFeeCents: agg.platformFeeCents,
          netCents: agg.netCents,
          usesTotal: agg.redemptions,
          usersUnique: agg.users.size,
          totalSavedCents: agg.discountCents,
        };
      }),
    });
  } catch (err) {
    console.error("[organização/promo][GET]", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

export async function POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const orgCtx = await requireOrganization(req);
    if ("error" in orgCtx) {
      const status =
        orgCtx.error === "UNAUTHENTICATED" ? 401 : orgCtx.error === "PROFILE_NOT_FOUND" ? 404 : 403;
      return fail(ctx, status, orgCtx.error ?? "FORBIDDEN");
    }
    const emailGate = ensureOrganizationEmailVerified(orgCtx.organization, { reasonCode: "PROMO" });
    if (!emailGate.ok) {
      const message =
        "message" in emailGate && typeof emailGate.message === "string"
          ? emailGate.message
          : emailGate.error ?? "Sem permissões.";
      return respondError(
        ctx,
        {
          errorCode: emailGate.error ?? "FORBIDDEN",
          message,
          retryable: false,
          details: emailGate,
        },
        { status: 403 },
      );
    }
    const access = await ensureMemberModuleAccess({
      organizationId: orgCtx.organization.id,
      userId: orgCtx.membership.userId,
      role: orgCtx.membership.role,
      rolePack: orgCtx.membership.rolePack,
      moduleKey: OrganizationModule.MARKETING,
      required: "EDIT",
    });
    if (!access.ok) {
      return fail(ctx, 403, "FORBIDDEN");
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return fail(ctx, 400, "BAD_REQUEST");
    }
    const promoRepo = (prisma as unknown as {
      promoCode?: {
        findFirst: typeof prisma.promoCode.findFirst;
        create: typeof prisma.promoCode.create;
      };
    }).promoCode;
    if (!promoRepo) {
      return fail(ctx, 500, "Promo codes indisponíveis nesta instância do Prisma.");
    }

    const {
      code,
      type,
      value,
      maxUses,
      perUserLimit,
      validFrom,
      validUntil,
      eventId,
      active,
      autoApply,
      minQuantity,
      minTotalCents,
      promoterUserId,
    } = body as {
      code?: string;
      type?: "PERCENTAGE" | "FIXED";
      value?: number;
      maxUses?: number | null;
      perUserLimit?: number | null;
      validFrom?: string | null;
      validUntil?: string | null;
      eventId?: number | null;
      active?: boolean;
      autoApply?: boolean;
      minQuantity?: number | null;
      minTotalCents?: number | null;
      promoterUserId?: string | null;
    };

    const cleanCode = (code || "").trim();
    const auto = Boolean(autoApply);
    if (!auto && !cleanCode) {
      return fail(ctx, 400, "Código em falta.");
    }
    if (type !== "PERCENTAGE" && type !== "FIXED") {
      return fail(ctx, 400, "Tipo inválido.");
    }
    const cleanValue = Number(value);
    if (!Number.isFinite(cleanValue) || cleanValue <= 0) {
      return fail(ctx, 400, "Valor inválido.");
    }
    const normalizedValue = Math.floor(cleanValue);

    let targetEventId: number | null = null;
    if (eventId !== null && eventId !== undefined) {
      const exists = await prisma.event.findFirst({
        where: { id: Number(eventId), organizationId: orgCtx.organization.id },
        select: { id: true },
      });
      if (!exists) {
        return fail(ctx, 400, "Evento inválido ou não pertence ao organização.");
      }
      targetEventId = Number(eventId);
    }

    const parseDate = (d?: string | null) => {
      if (!d) return null;
      const dt = new Date(d);
      return Number.isNaN(dt.getTime()) ? null : dt;
    };
    const normalizedValidFrom = parseDate(validFrom);
    const normalizedValidUntil = parseDate(validUntil);

    let resolvedPromoterId: string | null = null;
    if (typeof promoterUserId === "string") {
      const promoterMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId: orgCtx.organization.id, userId: promoterUserId },
        },
        select: { role: true },
      });
      if (!promoterMember || promoterMember.role !== "PROMOTER") {
        return fail(ctx, 400, "Promoter inválido.");
      }
      resolvedPromoterId = promoterUserId;
    }

    const resolvedActive = active ?? true;
    const finalCode =
      auto && !cleanCode
        ? buildAutoPromoCode({
            organizationId: orgCtx.organization.id,
            eventId: targetEventId,
            type,
            value: normalizedValue,
            maxUses: maxUses ?? null,
            perUserLimit: perUserLimit ?? null,
            validFrom: normalizedValidFrom,
            validUntil: normalizedValidUntil,
            minQuantity: minQuantity ?? null,
            minTotalCents: minTotalCents ?? null,
            promoterUserId: resolvedPromoterId,
            active: resolvedActive,
            autoApply: auto,
          })
        : cleanCode;
    if (!finalCode) {
      return fail(ctx, 400, "Código em falta.");
    }

    const created = await prisma.promoCode.create({
      data: {
        code: finalCode,
        type,
        value: normalizedValue,
        organizationId: orgCtx.organization.id,
        maxUses: maxUses ?? null,
        perUserLimit: perUserLimit ?? null,
        validFrom: normalizedValidFrom,
        validUntil: normalizedValidUntil,
        eventId: targetEventId,
        active: resolvedActive,
        autoApply: auto,
        minQuantity: minQuantity ?? null,
        minTotalCents: minTotalCents ?? null,
        promoterUserId: resolvedPromoterId,
      },
    });

    return respondOk(ctx, { promoCode: created });
  } catch (err) {
    console.error("[organização/promo][POST]", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

export async function PATCH(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const orgCtx = await requireOrganization(req);
    if ("error" in orgCtx) {
      const status =
        orgCtx.error === "UNAUTHENTICATED" ? 401 : orgCtx.error === "PROFILE_NOT_FOUND" ? 404 : 403;
      return fail(ctx, status, orgCtx.error ?? "FORBIDDEN");
    }
    const emailGate = ensureOrganizationEmailVerified(orgCtx.organization, { reasonCode: "PROMO" });
    if (!emailGate.ok) {
      const message =
        "message" in emailGate && typeof emailGate.message === "string"
          ? emailGate.message
          : emailGate.error ?? "Sem permissões.";
      return respondError(
        ctx,
        {
          errorCode: emailGate.error ?? "FORBIDDEN",
          message,
          retryable: false,
          details: emailGate,
        },
        { status: 403 },
      );
    }
    const access = await ensureMemberModuleAccess({
      organizationId: orgCtx.organization.id,
      userId: orgCtx.membership.userId,
      role: orgCtx.membership.role,
      rolePack: orgCtx.membership.rolePack,
      moduleKey: OrganizationModule.MARKETING,
      required: "EDIT",
    });
    if (!access.ok) {
      return fail(ctx, 403, "FORBIDDEN");
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.id !== "number") {
      return fail(ctx, 400, "BAD_REQUEST");
    }

    const promoRepo = (prisma as unknown as {
      promoCode?: {
        findUnique: typeof prisma.promoCode.findUnique;
        update: typeof prisma.promoCode.update;
      };
    }).promoCode;
    if (!promoRepo) {
      return fail(ctx, 500, "Promo codes indisponíveis nesta instância do Prisma.");
    }

    const promo = await promoRepo.findUnique({ where: { id: body.id } });
    if (!promo) {
      return fail(ctx, 404, "NOT_FOUND");
    }

    if (promo.organizationId && promo.organizationId !== orgCtx.organization.id) {
      return fail(ctx, 403, "FORBIDDEN");
    }
    if (!promo.organizationId && promo.eventId) {
      const evt = await prisma.event.findFirst({
        where: { id: promo.eventId, organizationId: orgCtx.organization.id },
        select: { id: true },
      });
      if (!evt) {
        return fail(ctx, 403, "FORBIDDEN");
      }
    } else if (!promo.organizationId && !promo.eventId) {
      return fail(ctx, 403, "FORBIDDEN");
    }

    const {
      active,
      autoApply,
      code,
      type,
      value,
      maxUses,
      perUserLimit,
      validFrom,
      validUntil,
      eventId,
      minQuantity,
      minTotalCents,
      minCartValueCents,
      name,
      description,
      promoterUserId,
    } = body as {
      active?: boolean;
      autoApply?: boolean;
      code?: string;
      type?: "PERCENTAGE" | "FIXED";
      value?: number;
      maxUses?: number | null;
      perUserLimit?: number | null;
      validFrom?: string | null;
      validUntil?: string | null;
      eventId?: number | null;
      minQuantity?: number | null;
      minTotalCents?: number | null;
      minCartValueCents?: number | null;
      name?: string | null;
      description?: string | null;
      promoterUserId?: string | null;
    };

    let targetEventId: number | null | undefined = undefined;
    if (eventId !== undefined && eventId !== null) {
      const exists = await prisma.event.findFirst({
        where: { id: Number(eventId), organizationId: orgCtx.organization.id },
        select: { id: true },
      });
      if (!exists) {
        return fail(ctx, 400, "Evento inválido ou não pertence ao organização.");
      }
      targetEventId = Number(eventId);
    } else if (eventId === null) {
      targetEventId = null;
    }

    const parseDate = (d?: string | null) => {
      if (!d) return null;
      const dt = new Date(d);
      return Number.isNaN(dt.getTime()) ? null : dt;
    };

    const dataUpdate: Record<string, unknown> = {};
    if (typeof active === "boolean") dataUpdate.active = active;
    if (typeof autoApply === "boolean") dataUpdate.autoApply = autoApply;
    if (typeof code === "string" && code.trim()) dataUpdate.code = code.trim();
    if (type === "PERCENTAGE" || type === "FIXED") dataUpdate.type = type;
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      dataUpdate.value = Math.floor(value);
    }
    if (maxUses !== undefined) dataUpdate.maxUses = maxUses;
    if (perUserLimit !== undefined) dataUpdate.perUserLimit = perUserLimit;
    if (validFrom !== undefined) dataUpdate.validFrom = parseDate(validFrom);
    if (validUntil !== undefined) dataUpdate.validUntil = parseDate(validUntil);
    if (targetEventId !== undefined) {
      dataUpdate.event =
        targetEventId === null ? { disconnect: true } : { connect: { id: targetEventId } };
    }
    if (minQuantity !== undefined) dataUpdate.minQuantity = minQuantity;
    if (minTotalCents !== undefined) dataUpdate.minTotalCents = minTotalCents;
    if (minCartValueCents !== undefined) dataUpdate.minCartValueCents = minCartValueCents;
    if (typeof name === "string") dataUpdate.name = name.trim() || null;
    if (typeof description === "string") dataUpdate.description = description.trim() || null;
    if (typeof promoterUserId === "string") {
      const promoterMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId: orgCtx.organization.id, userId: promoterUserId },
        },
        select: { role: true },
      });
      if (!promoterMember || promoterMember.role !== "PROMOTER") {
        return fail(ctx, 400, "Promoter inválido.");
      }
      dataUpdate.promoterUserId = promoterUserId;
    }
    if (promoterUserId === null) dataUpdate.promoterUserId = null;

    const updated = await prisma.promoCode.update({
      where: { id: promo.id },
      data: dataUpdate,
    });

    return respondOk(ctx, { promoCode: updated });
  } catch (err) {
    console.error("[organização/promo][PATCH]", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

export async function DELETE(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const orgCtx = await requireOrganization(req);
    if ("error" in orgCtx) {
      const status =
        orgCtx.error === "UNAUTHENTICATED" ? 401 : orgCtx.error === "PROFILE_NOT_FOUND" ? 404 : 403;
      return fail(ctx, status, orgCtx.error ?? "FORBIDDEN");
    }
    const access = await ensureMemberModuleAccess({
      organizationId: orgCtx.organization.id,
      userId: orgCtx.membership.userId,
      role: orgCtx.membership.role,
      rolePack: orgCtx.membership.rolePack,
      moduleKey: OrganizationModule.MARKETING,
      required: "EDIT",
    });
    if (!access.ok) {
      return fail(ctx, 403, "FORBIDDEN");
    }
    const body = await req.json().catch(() => null);
    if (!body || typeof body.id !== "number") {
      return fail(ctx, 400, "BAD_REQUEST");
    }

    const promo = await prisma.promoCode.findUnique({ where: { id: body.id } });
    if (!promo) {
      return fail(ctx, 404, "NOT_FOUND");
    }
    if (promo.organizationId && promo.organizationId !== orgCtx.organization.id) {
      return fail(ctx, 403, "FORBIDDEN");
    }
    if (!promo.organizationId && promo.eventId) {
      const evt = await prisma.event.findFirst({
        where: { id: promo.eventId, organizationId: orgCtx.organization.id },
        select: { id: true },
      });
      if (!evt) {
        return fail(ctx, 403, "FORBIDDEN");
      }
    } else if (!promo.organizationId && !promo.eventId) {
      return fail(ctx, 403, "FORBIDDEN");
    }

    await prisma.promoCode.delete({
      where: { id: promo.id },
    });
    return respondOk(ctx, {});
  } catch (err) {
    console.error("[organização/promo][DELETE]", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
